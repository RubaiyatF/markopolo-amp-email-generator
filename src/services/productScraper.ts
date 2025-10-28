import axios from 'axios';
import redis from '../lib/redis';
import { Product } from '../schemas';
import extractPicsService from './extractPicsService';

const SCRAPER_BASE_URL = process.env.PRODUCT_SCRAPER_BASE_URL || 'https://product-scraper-217130114839.us-east1.run.app';
const CACHE_TTL = 86400; // 24 hours

export class ProductScraperService {
  /**
   * Extract product data from a single URL with retry logic and fallback
   * Now uses extract.pics for image extraction instead of screenshots
   */
  async extractProduct(url: string, category?: string): Promise<Product> {
    // Check cache first
    const cacheKey = `product:${url}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`✅ Cache hit for product: ${url}`);
      return JSON.parse(cached);
    }

    console.log(`🔍 Scraping product: ${url}`);

    // Try external API with retries
    try {
      const product = await this.extractWithRetry(url, category);

      // Cache result for 24 hours
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(product));
      console.log(`✅ Product scraped successfully: ${product.name}`);

      return product;
    } catch (apiError: any) {
      console.warn(`⚠️  External API failed after retries: ${apiError.message}`);
      console.log(`🔄 Falling back to direct HTML scraping...`);

      // Fallback: scrape directly from the product page
      try {
        const product = await this.extractFromHTML(url);

        // Cache result for 24 hours
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(product));
        console.log(`✅ Product scraped via fallback: ${product.name}`);

        return product;
      } catch (fallbackError: any) {
        console.error(`❌ Both API and fallback scraping failed for ${url}`);
        throw new Error(`Product extraction failed: API error: ${apiError.message}, Fallback error: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Extract product using external API with retry logic
   */
  private async extractWithRetry(url: string, category?: string, maxRetries: number = 3): Promise<Product> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/${maxRetries} - Calling external API...`);

        const response = await axios.post(
          `${SCRAPER_BASE_URL}/knowledge-base/enriched-extract`,
          {
            link: url,
            use_screenshot_images: false, // No longer using screenshots
            category: category || 'general'
          },
          {
            timeout: 90000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        // Extract product images using extract.pics
        let productImages: string[] = [];
        try {
          console.log(`   🖼️  Extracting product images using extract.pics...`);
          const extractedImages = await extractPicsService.extractImages(url);
          productImages = extractedImages.map(img => img.url);
          console.log(`   🖼️  Got ${productImages.length} product images from extract.pics`);
        } catch (error: any) {
          console.warn(`   ⚠️  Extract.pics failed: ${error.message}`);
          console.log(`   🖼️  Attempting fallback image extraction...`);
          const fallbackImage = await this.extractImageFromUrl(url);
          if (fallbackImage) {
            productImages = [fallbackImage];
          }
        }

        // Extract brand from data or fallback to domain
        let brand = response.data.brand;
        if (!brand) {
          try {
            const urlObj = new URL(url);
            brand = urlObj.hostname.replace('www.', '').split('.')[0];
            brand = brand.charAt(0).toUpperCase() + brand.slice(1);
          } catch (e) {
            brand = 'Unknown';
          }
        }

        const product: Product = {
          name: response.data.name || response.data.product_name || 'Product',
          price: parseFloat(response.data.price?.toString().replace(/[^0-9.]/g, '') || '0'),
          currency: response.data.currency || 'USD',
          images: productImages, // Array of product images
          url: response.data.url || url,
          description: response.data.description || '',
          brand: brand,
          id: response.data.id || response.data.resourceId || response.data.product_id || url
        };

        console.log(`   ✅ API call successful on attempt ${attempt}`);
        console.log(`      Product: ${product.name} - ${product.currency}${product.price}`);
        console.log(`      Brand: ${product.brand}, Images: ${productImages.length}`);

        return product;

      } catch (error: any) {
        lastError = error;
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        console.warn(`   ❌ Attempt ${attempt} failed: ${error.message}`);
        if (statusCode) {
          console.warn(`      Status: ${statusCode}`);
        }
        if (errorData) {
          console.warn(`      Response: ${JSON.stringify(errorData).substring(0, 200)}`);
        }

        // Don't retry on 4xx errors (except 429 rate limit)
        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          console.warn(`      Non-retryable error (${statusCode}), stopping retries`);
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`      Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        }
      }
    }

    throw lastError;
  }

  /**
   * Fallback: Extract product data directly from HTML
   */
  private async extractFromHTML(url: string): Promise<Product> {
    console.log(`   📄 Fetching HTML from: ${url}`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = response.data;

    // Extract product data from HTML
    const product: Partial<Product> = {
      url: url,
      currency: 'USD'
    };

    // Extract product name from title or h1
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    product.name = (h1Match?.[1] || titleMatch?.[1] || 'Product').trim().replace(/\s+/g, ' ');

    // Extract price from JSON-LD or meta tags
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const script of jsonLdMatch) {
        try {
          const jsonContent = script.replace(/<script[^>]*>|<\/script>/gi, '');
          const jsonData = JSON.parse(jsonContent);

          if (jsonData['@type'] === 'Product' || jsonData.offers) {
            const offers = jsonData.offers || jsonData;
            product.price = parseFloat(offers.price || offers.lowPrice || 0);
            product.currency = offers.priceCurrency || 'USD';
            product.description = jsonData.description;
            product.brand = jsonData.brand?.name || jsonData.brand;

            if (jsonData.image) {
              // Extract images from JSON-LD (will be overwritten by extract.pics later)
              const imageUrl = Array.isArray(jsonData.image) ? jsonData.image[0] : jsonData.image;
              if (!product.images) {
                product.images = [imageUrl];
              }
            }
            break;
          }
        } catch (e) {
          // Continue trying other scripts
        }
      }
    }

    // Fallback: Extract price from meta tags or common patterns
    if (!product.price) {
      const priceMatch = html.match(/["']price["']:\s*["']?(\d+(?:\.\d+)?)["']?/i) ||
                        html.match(/\$\s*(\d+(?:\.\d+)?)/);
      if (priceMatch) {
        product.price = parseFloat(priceMatch[1]);
      }
    }

    // Extract images using extract.pics
    let productImages: string[] = [];
    try {
      console.log(`   🖼️  Extracting product images using extract.pics...`);
      const extractedImages = await extractPicsService.extractImages(url);
      productImages = extractedImages.map(img => img.url);
      console.log(`   🖼️  Got ${productImages.length} product images from extract.pics`);
    } catch (error: any) {
      console.warn(`   ⚠️  Extract.pics failed: ${error.message}`);
      const fallbackImage = await this.extractImageFromUrl(url);
      if (fallbackImage) {
        productImages = [fallbackImage];
      }
    }
    product.images = productImages;

    // Extract brand from domain if not found
    if (!product.brand) {
      const urlObj = new URL(url);
      product.brand = urlObj.hostname.replace('www.', '').split('.')[0];
    }

    // Validate we have minimum required data
    if (!product.name || !product.price) {
      throw new Error('Failed to extract required product data from HTML');
    }

    console.log(`   ✅ Extracted from HTML: ${product.name} - $${product.price}`);

    return product as Product;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract multiple products in bulk
   */
  async extractBulk(urls: string[], companyId: string): Promise<Product[]> {
    if (urls.length === 0) {
      return [];
    }

    // Check if all URLs are cached
    const products: Product[] = [];
    const urlsToScrape: string[] = [];

    for (const url of urls) {
      const cached = await redis.get(`product:${url}`);
      if (cached) {
        products.push(JSON.parse(cached));
      } else {
        urlsToScrape.push(url);
      }
    }

    // If all cached, return immediately
    if (urlsToScrape.length === 0) {
      console.log(`✅ All ${urls.length} products found in cache`);
      return products;
    }

    // For single URL, use single extraction endpoint (more reliable)
    if (urlsToScrape.length === 1) {
      console.log(`🔍 Scraping single product...`);
      const product = await this.extractProduct(urlsToScrape[0]);
      return [...products, product];
    }

    console.log(`🔍 Scraping ${urlsToScrape.length} products in bulk...`);

    try {
      const response = await axios.post(
        `${SCRAPER_BASE_URL}/knowledge-base/bulk-enriched-extract`,
        {
          productLinks: urlsToScrape,
          companyId: companyId,
          use_screenshot_images: false, // No longer using screenshots
          category: 'general',
          max_concurrent: 5
        },
        {
          timeout: 300000, // 5 minute timeout for bulk
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const scrapedProducts = await Promise.all(response.data.products.map(async (p: any, idx: number) => {
        // Extract product images using extract.pics
        let productImages: string[] = [];
        try {
          console.log(`   🖼️  Product ${idx + 1}: Extracting images using extract.pics...`);
          const extractedImages = await extractPicsService.extractImages(urlsToScrape[idx]);
          productImages = extractedImages.map(img => img.url);
          console.log(`   🖼️  Product ${idx + 1}: Got ${productImages.length} images`);
        } catch (error: any) {
          console.warn(`   ⚠️  Product ${idx + 1}: Extract.pics failed, using fallback`);
          const fallbackImage = await this.extractImageFromUrl(urlsToScrape[idx]);
          if (fallbackImage) {
            productImages = [fallbackImage];
          }
        }

        // Extract brand from data or fallback to domain
        let brand = p.brand;
        if (!brand) {
          try {
            const urlObj = new URL(urlsToScrape[idx]);
            brand = urlObj.hostname.replace('www.', '').split('.')[0];
            brand = brand.charAt(0).toUpperCase() + brand.slice(1);
          } catch (e) {
            brand = 'Unknown';
          }
        }

        const product = {
          name: p.name || p.product_name || 'Product',
          price: parseFloat(p.price?.toString().replace(/[^0-9.]/g, '') || '0'),
          currency: p.currency || 'USD',
          images: productImages, // Array of product images
          url: p.url || urlsToScrape[idx],
          description: p.description || '',
          brand: brand,
          id: p.id || p.resourceId || p.product_id || urlsToScrape[idx]
        };

        console.log(`   ✅ Product ${idx + 1}: ${product.name} - ${product.currency}${product.price}`);

        return product;
      }));

      // Cache each scraped product
      for (let i = 0; i < scrapedProducts.length; i++) {
        const product = scrapedProducts[i];
        const url = urlsToScrape[i];
        await redis.setex(`product:${url}`, CACHE_TTL, JSON.stringify(product));
      }

      console.log(`✅ Bulk scraping completed: ${scrapedProducts.length} products`);

      return [...products, ...scrapedProducts];
    } catch (error: any) {
      console.error(`❌ Bulk extraction failed:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data).substring(0, 500));
      }
      throw new Error(`Bulk product extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract product image from URL as fallback
   * Scrapes Open Graph or meta tags from the product page
   */
  private async extractImageFromUrl(url: string): Promise<string | undefined> {
    try {
      console.log(`🖼️  Attempting to extract image from page: ${url}`);
      const response = await axios.get(url, { timeout: 10000 });
      const html = response.data;

      // Try Open Graph image
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogImageMatch) {
        console.log(`✅ Found OG image: ${ogImageMatch[1]}`);
        return ogImageMatch[1];
      }

      // Try Twitter image
      const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
      if (twitterImageMatch) {
        console.log(`✅ Found Twitter image: ${twitterImageMatch[1]}`);
        return twitterImageMatch[1];
      }

      // Try product JSON-LD
      const jsonLdMatch = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1]);
          if (jsonLd.image) {
            const imageUrl = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image;
            console.log(`✅ Found JSON-LD image: ${imageUrl}`);
            return imageUrl;
          }
        } catch (e) {
          // Invalid JSON, continue
        }
      }

      console.warn(`⚠️  No image found in page meta tags`);
      return undefined;
    } catch (error: any) {
      console.error(`❌ Failed to extract image from URL: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Calculate product data completeness score (0-100)
   */
  calculateCompleteness(product: Product): number {
    const fields = ['name', 'price', 'description', 'images', 'brand'];
    const presentFields = fields.filter(field => {
      const value = product[field as keyof Product];
      // Check if images array exists and has items
      if (field === 'images') {
        return Array.isArray(value) && value.length > 0;
      }
      return !!value;
    });
    return Math.round((presentFields.length / fields.length) * 100);
  }
}

export default new ProductScraperService();
