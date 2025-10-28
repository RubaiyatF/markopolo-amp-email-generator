import axios from 'axios';
import fs from 'fs';
import sharp from 'sharp';

/**
 * Product Photo Generator (via Replicate)
 * Uses visoar/product-photo via Replicate for professional product photography
 *
 * Takes existing product images and generates professional product shots with different backgrounds
 */

export interface ImageGenerationOptions {
  productScreenshot: string; // URL to product image
  productName: string;
  productDescription?: string;
  count?: number; // number of images to generate (1-4)
  style?: string; // e.g., "product shot", "lifestyle", "closeup"
}

export interface GeneratedImage {
  url: string;
  index: number;
  prompt: string;
}

class GeminiImageGenerator {
  private apiKey: string;
  private modelVersion: string;
  private apiEndpoint: string;
  private initialized = false;

  constructor() {
    this.apiKey = process.env.REPLICATE_API_KEY || '';
    // Using ideogram with enhanced visoar-style prompts for best quality
    this.modelVersion = 'ideogram-ai/ideogram-v3-turbo';
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

    console.log('✅ Ideogram Image Generator initialized (Enhanced Prompts)');
    console.log(`   Model: ideogram-ai/ideogram-v3-turbo`);
  }

  /**
   * Generate product images from screenshot
   * Uses visoar/product-photo to generate all images in one API call
   */
  async generateImagesFromScreenshot(options: ImageGenerationOptions): Promise<GeneratedImage[]> {
    this.ensureInitialized();

    const { productScreenshot, productName, productDescription, count = 3, style = 'product shot' } = options;

    // Limit to 4 images (model maximum)
    const imageCount = Math.min(count, 4);

    console.log(`🎨 Generating ${imageCount} product images...`);
    console.log(`   Product: ${productName}`);
    console.log(`   Style: ${style}`);

    const images: GeneratedImage[] = [];

    // Generate images one at a time (ideogram doesn't support batch)
    for (let i = 0; i < imageCount; i++) {
      try {
        console.log(`   Generating image ${i + 1}/${imageCount}...`);

        // Build visoar-style scene prompt for this image
        const scenePrompt = this.buildScenePromptForIndex(productName, productDescription, i, imageCount);

        // Generate single image
        const imageUrls = await this.generateProductPhotos(productScreenshot, scenePrompt, 1);

        if (imageUrls && imageUrls.length > 0) {
          images.push({
            url: imageUrls[0],
            index: i,
            prompt: scenePrompt,
          });

          console.log(`   ✓ Image ${i + 1} generated successfully`);
        }

        // Small delay between generations to avoid rate limiting
        if (i < imageCount - 1) {
          await this.sleep(1000);
        }
      } catch (error: any) {
        console.error(`   ✗ Failed to generate image ${i + 1}: ${error.message}`);
        // Continue with next image
      }
    }

    if (images.length === 0) {
      // Fallback to product screenshot
      const fallbackUrl = productScreenshot.startsWith('http')
        ? productScreenshot
        : `https://via.placeholder.com/600x600?text=Product`;

      console.log(`   Using fallback: product screenshot`);

      images.push({
        url: fallbackUrl,
        index: 0,
        prompt: 'Fallback to original product image',
      });
    }

    console.log(`✅ Generated ${images.length}/${imageCount} images`);

    return images;
  }

  /**
   * Generate product photos using ideogram-ai/ideogram-v3-turbo
   * With enhanced visoar-style prompts and negative prompts
   */
  private async generateProductPhotos(
    productImageUrl: string,
    scenePrompt: string,
    imageCount: number
  ): Promise<string[]> {
    try {
      // Build negative prompt to avoid unwanted elements
      const negativePrompt = 'low quality, out of frame, illustration, 3d, sepia, painting, cartoons, sketch, watermark, text, Logo, advertisement, blur, distorted, deformed, disfigured, cartoon, anime';

      // Step 1: Create prediction (ideogram format with negative prompt)
      const createResponse = await axios.post(
        this.apiEndpoint,
        {
          version: this.modelVersion,
          input: {
            prompt: scenePrompt,
            negative_prompt: negativePrompt,
            aspect_ratio: '1:1',
            magic_prompt_option: 'Auto',
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

      console.log(`   Prediction created: ${predictionId}`);

      // Step 2: Poll for result
      let attempts = 0;
      const maxAttempts = 30; // 60 seconds max wait (ideogram is fast)

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
            throw new Error('No output from model');
          }

          // Ideogram returns a single string URL
          if (typeof output === 'string') {
            console.log(`   ✓ Generated image: ${output.substring(0, 60)}...`);
            return [output]; // Return as array for consistency
          }

          // Fallback: handle array format (just in case)
          if (Array.isArray(output)) {
            const imageUrls = output.map((item: any) => {
              if (typeof item === 'string') return item;
              if (item && item.url) return item.url;
              throw new Error(`Invalid image output format: ${typeof item}`);
            });
            console.log(`   ✓ Generated ${imageUrls.length} images`);
            return imageUrls;
          }

          throw new Error(`Unexpected output format: ${typeof output}`);
        } else if (status === 'failed' || status === 'canceled') {
          throw new Error(`Prediction ${status}: ${statusResponse.data.error || 'Unknown error'}`);
        }

        attempts++;
      }

      throw new Error('Prediction timed out after 60 seconds');

    } catch (error: any) {
      console.error(`Failed to generate product photos: ${error.message}`);
      if (error.response?.data) {
        console.error(`   API Error:`, JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Build scene description prompt for a specific image index
   * Creates context-aware prompts based on position
   */
  private buildScenePromptForIndex(
    productName: string,
    description: string | undefined,
    index: number,
    total: number
  ): string {
    let scene = '';

    // visoar/product-photo works best with scene/background descriptions
    if (total === 1) {
      scene = 'clean white background with soft shadows, minimalist display, professional studio lighting';
    } else if (index === 0) {
      // First image: Clean, professional display
      scene = 'on a white marble pedestal with elegant display stand, minimalist setting, professional studio lighting, clean background';
    } else if (index === 1) {
      // Second image: Lifestyle/modern setting
      scene = 'in a modern stylish room with aesthetic decor, soft natural lighting, complementary colored background, lifestyle setting';
    } else if (index === 2) {
      // Third image: Premium/luxury display
      scene = 'on a luxury display with soft silk fabrics around it, warm ambient lighting, premium atmosphere, sophisticated presentation';
    } else {
      // Additional images: Creative backgrounds
      scene = 'with creative artistic elements around it, unique background composition, professional photography setup';
    }

    return `product ${scene}, high-quality e-commerce photography, sharp focus`;
  }

  /**
   * Build scene description prompt for product photo generation (legacy - for batch generation)
   */
  private buildScenePrompt(productName: string, description: string | undefined, imageCount: number): string {
    const scenes: string[] = [];

    for (let i = 0; i < imageCount; i++) {
      scenes.push(this.buildScenePromptForIndex(productName, description, i, imageCount));
    }

    return scenes.join(' | ');
  }

  /**
   * Generate images from product data (simplified)
   */
  async generateProductImages(
    productScreenshot: string,
    productName: string,
    count: number = 3
  ): Promise<string[]> {
    const result = await this.generateImagesFromScreenshot({
      productScreenshot,
      productName,
      count,
    });

    return result.map(img => img.url);
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
      model: 'visoar/product-photo',
      provider: 'Replicate',
      configured: this.isConfigured(),
      maxImages: 4,
      batchMode: true,
    };
  }
}

export default new GeminiImageGenerator();
