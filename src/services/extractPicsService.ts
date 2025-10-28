import axios from 'axios';
import redis from '../lib/redis';

const EXTRACT_PICS_API_KEY = process.env.EXTRACT_PICS_API_KEY || '';
const EXTRACT_PICS_ENDPOINT = 'https://extract.pics/api/v1/extract';
const CACHE_TTL = 86400; // 24 hours

export interface ExtractedImage {
  id: string;
  url: string;
}

export interface ExtractPicsResponse {
  images: ExtractedImage[];
  totalImages: number;
  url: string;
}

class ExtractPicsService {
  private apiKey: string;
  private endpoint: string;

  constructor() {
    this.apiKey = EXTRACT_PICS_API_KEY;
    this.endpoint = EXTRACT_PICS_ENDPOINT;
  }

  /**
   * Extract all images from a URL using extract.pics API
   * Uses basic mode (1 credit per extraction)
   */
  async extractImages(url: string): Promise<ExtractedImage[]> {
    // Check cache first
    const cacheKey = `extract_pics:${url}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`✅ Cache hit for image extraction: ${url}`);
      return JSON.parse(cached);
    }

    console.log(`🖼️  Extracting images from: ${url}`);

    try {
      const images = await this.extractWithRetry(url);

      // Cache result for 24 hours
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(images));
      console.log(`✅ Extracted ${images.length} images successfully`);

      return images;
    } catch (error: any) {
      console.error(`❌ Image extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract images with retry logic
   */
  private async extractWithRetry(url: string, maxRetries: number = 3): Promise<ExtractedImage[]> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/${maxRetries} - Calling extract.pics API...`);

        const response = await axios.post(
          this.endpoint,
          {
            url: url,
            mode: 'basic', // Basic mode: finds all images, no analysis
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
          }
        );

        const images = response.data.images || [];

        if (images.length === 0) {
          console.warn(`   ⚠️  No images found on page: ${url}`);
          return [];
        }

        console.log(`   ✅ API call successful on attempt ${attempt}`);
        console.log(`      Found ${images.length} images`);

        // Filter out tiny images (likely icons/decorations)
        const productImages = images.filter((img: ExtractedImage) => {
          // Basic filtering - can be enhanced later
          return !img.url.includes('icon') &&
                 !img.url.includes('logo') &&
                 !img.url.includes('favicon');
        });

        console.log(`      Product images (filtered): ${productImages.length}`);

        return productImages;

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
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get service info
   */
  getServiceInfo() {
    return {
      provider: 'extract.pics',
      configured: this.isConfigured(),
      mode: 'basic',
      creditsPerExtraction: 1,
    };
  }
}

export default new ExtractPicsService();
