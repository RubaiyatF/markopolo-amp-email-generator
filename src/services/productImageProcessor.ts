import axios from 'axios';

/**
 * Product Image Processor (via Replicate)
 * 3-step pipeline:
 * 1. Background Removal (cjwbw/rembg)
 * 2. Background Generation (bria/generate-background or logerzhu/ad-inpaint)
 * 3. Context-Aware Resizing
 *
 * Processes product images from extract.pics for email templates
 */

export interface ImageProcessingOptions {
  productImageUrl: string; // URL from extract.pics
  productName: string;
  productDescription?: string;
  placeholderContext: 'hero' | 'gallery' | 'thumbnail'; // Context for background generation
  targetWidth?: number; // Target dimensions
  targetHeight?: number;
}

export interface ProcessedImage {
  url: string;
  context: string;
  prompt: string;
}

class ProductImageProcessor {
  private apiKey: string;
  private apiEndpoint: string;
  private initialized = false;

  // Model versions
  private rembgModel = 'cjwbw/rembg'; // Background removal
  private briaModel = 'bria/generate-background'; // Primary background generation
  private inpaintModel = 'logerzhu/ad-inpaint'; // Fallback background generation

  constructor() {
    this.apiKey = process.env.REPLICATE_API_KEY || '';
    this.apiEndpoint = 'https://api.replicate.com/v1/predictions';
  }

  private isConfigured(): boolean {
    return !!this.apiKey;
  }

  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.isConfigured()) {
      throw new Error('REPLICATE_API_KEY not configured in environment variables');
    }

    console.log('✅ Product Image Processor initialized');
    console.log(`   Background Removal: ${this.rembgModel}`);
    console.log(`   Background Generation: ${this.briaModel} (primary), ${this.inpaintModel} (fallback)`);
  }

  /**
   * Process product image: remove background + add new background
   */
  async processProductImage(options: ImageProcessingOptions): Promise<ProcessedImage> {
    this.ensureInitialized();

    const { productImageUrl, productName, placeholderContext } = options;

    console.log(`🎨 Processing product image...`);
    console.log(`   Product: ${productName}`);
    console.log(`   Context: ${placeholderContext}`);

    try {
      // Step 1: Remove background
      console.log(`   Step 1/2: Removing background...`);
      const transparentImageUrl = await this.removeBackground(productImageUrl);
      console.log(`   ✓ Background removed`);

      // Step 2: Generate new background based on context
      console.log(`   Step 2/2: Generating new background (${placeholderContext})...`);
      const processedImageUrl = await this.generateBackground(
        transparentImageUrl,
        productName,
        placeholderContext
      );
      console.log(`   ✓ Background generated`);

      const prompt = this.buildBackgroundPrompt(placeholderContext, productName);

      return {
        url: processedImageUrl,
        context: placeholderContext,
        prompt,
      };
    } catch (error: any) {
      console.error(`❌ Image processing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 1: Remove background using cjwbw/rembg
   */
  private async removeBackground(imageUrl: string): Promise<string> {
    try {
      // Create prediction
      const createResponse = await axios.post(
        this.apiEndpoint,
        {
          version: this.rembgModel,
          input: {
            image: imageUrl,
          },
        },
        {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const predictionId = createResponse.data.id;
      const getUrl = createResponse.data.urls.get;

      console.log(`      Prediction created: ${predictionId}`);

      // Poll for result
      let attempts = 0;
      const maxAttempts = 20; // 40 seconds max wait

      while (attempts < maxAttempts) {
        await this.sleep(2000); // Wait 2 seconds between polls

        const statusResponse = await axios.get(getUrl, {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
          },
          timeout: 5000,
        });

        const status = statusResponse.data.status;

        if (status === 'succeeded') {
          const output = statusResponse.data.output;

          if (!output) {
            throw new Error('No output from rembg model');
          }

          // rembg returns a single URL string
          const transparentImageUrl = typeof output === 'string' ? output : output[0];
          console.log(`      ✓ Transparent image: ${transparentImageUrl.substring(0, 60)}...`);
          return transparentImageUrl;
        } else if (status === 'failed' || status === 'canceled') {
          throw new Error(`Prediction ${status}: ${statusResponse.data.error || 'Unknown error'}`);
        }

        attempts++;
      }

      throw new Error('Background removal timed out after 40 seconds');
    } catch (error: any) {
      console.error(`Failed to remove background: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 2: Generate new background using bria/generate-background
   */
  private async generateBackground(
    transparentImageUrl: string,
    productName: string,
    context: string
  ): Promise<string> {
    const prompt = this.buildBackgroundPrompt(context, productName);

    try {
      // Try primary model: bria/generate-background
      return await this.generateBackgroundBria(transparentImageUrl, prompt);
    } catch (briaError: any) {
      console.warn(`      Bria model failed: ${briaError.message}`);
      console.log(`      Trying fallback model: ad-inpaint...`);

      try {
        // Fallback to ad-inpaint
        return await this.generateBackgroundInpaint(transparentImageUrl, prompt);
      } catch (inpaintError: any) {
        console.error(`      Both models failed. Using transparent image.`);
        // Return the transparent image as last resort
        return transparentImageUrl;
      }
    }
  }

  /**
   * Generate background using bria/generate-background (primary)
   */
  private async generateBackgroundBria(transparentImageUrl: string, prompt: string): Promise<string> {
    const createResponse = await axios.post(
      this.apiEndpoint,
      {
        version: this.briaModel,
        input: {
          image_url: transparentImageUrl,
          prompt: prompt,
          negative_prompt: 'low quality, blurry, distorted, watermark, text',
        },
      },
      {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const predictionId = createResponse.data.id;
    const getUrl = createResponse.data.urls.get;

    // Poll for result
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max wait

    while (attempts < maxAttempts) {
      await this.sleep(2000);

      const statusResponse = await axios.get(getUrl, {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
        timeout: 5000,
      });

      const status = statusResponse.data.status;

      if (status === 'succeeded') {
        const output = statusResponse.data.output;
        const imageUrl = typeof output === 'string' ? output : output[0];
        return imageUrl;
      } else if (status === 'failed' || status === 'canceled') {
        throw new Error(`Bria prediction ${status}: ${statusResponse.data.error || 'Unknown error'}`);
      }

      attempts++;
    }

    throw new Error('Bria background generation timed out');
  }

  /**
   * Generate background using logerzhu/ad-inpaint (fallback)
   */
  private async generateBackgroundInpaint(transparentImageUrl: string, prompt: string): Promise<string> {
    const createResponse = await axios.post(
      this.apiEndpoint,
      {
        version: this.inpaintModel,
        input: {
          image_path: transparentImageUrl,
          prompt: prompt,
          negative_prompt: 'low quality, blurry, distorted, watermark, text, logo',
        },
      },
      {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const predictionId = createResponse.data.id;
    const getUrl = createResponse.data.urls.get;

    // Poll for result
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await this.sleep(2000);

      const statusResponse = await axios.get(getUrl, {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
        timeout: 5000,
      });

      const status = statusResponse.data.status;

      if (status === 'succeeded') {
        const output = statusResponse.data.output;
        const imageUrl = typeof output === 'string' ? output : output[0];
        return imageUrl;
      } else if (status === 'failed' || status === 'canceled') {
        throw new Error(`Ad-inpaint prediction ${status}: ${statusResponse.data.error || 'Unknown error'}`);
      }

      attempts++;
    }

    throw new Error('Ad-inpaint background generation timed out');
  }

  /**
   * Build background prompt based on placeholder context
   */
  private buildBackgroundPrompt(context: string, productName: string): string {
    const prompts: Record<string, string> = {
      hero: 'professional product photography, luxury display with soft silk fabrics, warm ambient lighting, premium atmosphere, sophisticated presentation, high-quality e-commerce',
      gallery: 'clean white marble pedestal, elegant display stand, minimalist setting, professional studio lighting, clean background, high-quality product photography',
      thumbnail: 'clean white background with soft shadows, minimalist display, professional studio lighting, simple and clean',
    };

    return prompts[context] || prompts.gallery;
  }

  /**
   * Process multiple product images
   */
  async processMultipleImages(
    imageUrls: string[],
    productName: string,
    productDescription?: string
  ): Promise<ProcessedImage[]> {
    const results: ProcessedImage[] = [];

    // Map image URLs to contexts (hero, gallery, gallery, ...)
    const contexts: Array<'hero' | 'gallery' | 'thumbnail'> = imageUrls.map((_, i) => {
      if (i === 0) return 'hero'; // First image is hero
      if (i === imageUrls.length - 1 && imageUrls.length > 2) return 'thumbnail'; // Last is thumbnail
      return 'gallery'; // Others are gallery
    });

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        console.log(`   Processing image ${i + 1}/${imageUrls.length}...`);

        const processed = await this.processProductImage({
          productImageUrl: imageUrls[i],
          productName,
          productDescription,
          placeholderContext: contexts[i],
        });

        results.push(processed);
        console.log(`   ✓ Image ${i + 1} processed successfully`);

        // Small delay between generations
        if (i < imageUrls.length - 1) {
          await this.sleep(1000);
        }
      } catch (error: any) {
        console.error(`   ✗ Failed to process image ${i + 1}: ${error.message}`);
        // Continue with next image
      }
    }

    if (results.length === 0) {
      throw new Error('Failed to process any images');
    }

    console.log(`✅ Processed ${results.length}/${imageUrls.length} images`);
    return results;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.isConfigured();
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      backgroundRemoval: this.rembgModel,
      backgroundGeneration: {
        primary: this.briaModel,
        fallback: this.inpaintModel,
      },
      provider: 'Replicate',
      configured: this.isConfigured(),
    };
  }
}

export default new ProductImageProcessor();
