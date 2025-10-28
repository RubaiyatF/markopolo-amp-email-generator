import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * OpenRouter Template Generator Service
 * Uses OpenRouter API with Google Gemini 2.5 Flash for image-to-AMP HTML template generation
 *
 * Features:
 * - Converts template images to fully responsive AMP HTML
 * - Matches colors, fonts, layout, and spacing precisely
 * - Generates image placeholders for later replacement
 * - Supports batch processing
 */

export interface OpenRouterGenerationResult {
  html: string;
  imagePlaceholders: string[];
  processingTime: number;
  model: string;
}

class OpenRouterTemplateGenerator {
  private apiKey: string;
  private modelName: string;
  private apiEndpoint: string;
  private initialized = false;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.modelName = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    this.apiEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
  }

  private isConfigured(): boolean {
    return !!this.apiKey;
  }

  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.isConfigured()) {
      throw new Error('OPENROUTER_API_KEY not configured in environment variables');
    }

    console.log('✅ OpenRouter Template Generator initialized');
    console.log(`   Model: ${this.modelName}`);
  }

  /**
   * Build the prompt for image-to-HTML conversion
   */
  private buildPrompt(): string {
    return `Create a fully responsive and interactive HTML email template that is a highly accurate recreation of the provided image.

Pay close attention to the following details to ensure accuracy:

- Match the color scheme, layout, and spacing of the original design precisely.
- Match the font in the HTML file to match the image's typography.
- Do not include the header section from the top of the image (the part with "All templates / Wellness resources roundup", "flodesk", "Share", and "Customize it"). The template should begin with the main content.
- For all images in the template, set the alt attribute to "image_placeholder" and make sure the placeholder image's text also says "image_placeholder".
- Accurately follow everything from button patterns to other patterns.

Return ONLY the HTML code. Do not include any explanations or markdown code blocks.`;
  }

  /**
   * Resize image if it exceeds size limits
   */
  private async resizeImageIfNeeded(imageBuffer: Buffer): Promise<Buffer> {
    const MAX_SIZE_MB = 4; // OpenRouter supports up to 4MB
    const MAX_WIDTH = 2048;

    const sizeInMB = imageBuffer.length / (1024 * 1024);

    if (sizeInMB > MAX_SIZE_MB) {
      console.log(`   Resizing image (${sizeInMB.toFixed(2)}MB > ${MAX_SIZE_MB}MB)...`);

      const resized = await sharp(imageBuffer)
        .resize(MAX_WIDTH, null, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ quality: 85, compressionLevel: 9 })
        .toBuffer();

      const newSizeInMB = resized.length / (1024 * 1024);
      console.log(`   Resized to ${newSizeInMB.toFixed(2)}MB`);

      return resized;
    }

    return imageBuffer;
  }

  /**
   * Generate AMP HTML template from image file
   */
  async generateFromImage(imagePath: string): Promise<OpenRouterGenerationResult> {
    this.ensureInitialized();

    const startTime = Date.now();

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    console.log(`🔄 Generating template from: ${path.basename(imagePath)}`);

    try {
      // Read and potentially resize image
      let imageBuffer: Buffer = fs.readFileSync(imagePath);
      const resizedBuffer = await this.resizeImageIfNeeded(imageBuffer);

      const base64Image = resizedBuffer.toString('base64');
      const mimeType = this.getMimeType(path.extname(imagePath));

      // Build request payload (OpenAI-compatible format)
      const requestBody = {
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.buildPrompt(),
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 8000,
        temperature: 0.3,
      };

      // Make HTTP request
      const response = await axios.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://amp-email-platform.com',
            'X-Title': 'AMP Email Template Generator',
          },
          timeout: 120000, // 2 minute timeout
        }
      );

      // Extract HTML from response
      const choices = response.data.choices;
      if (!choices || choices.length === 0) {
        throw new Error('No response from OpenRouter API');
      }

      let html = choices[0].message.content || '';

      // Clean HTML (remove markdown wrappers if present)
      html = this.cleanHTML(html);

      // Extract image placeholders
      const imagePlaceholders = this.extractImagePlaceholders(html);

      const processingTime = Date.now() - startTime;

      console.log(`✅ Template generated successfully`);
      console.log(`   HTML Length: ${html.length} characters`);
      console.log(`   Image Placeholders: ${imagePlaceholders.length}`);
      console.log(`   Processing Time: ${processingTime}ms`);

      return {
        html,
        imagePlaceholders,
        processingTime,
        model: this.modelName,
      };
    } catch (error: any) {
      console.error(`❌ OpenRouter generation failed: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Generate AMP HTML template from base64 image
   */
  async generateFromBase64(
    base64Image: string,
    mimeType: string = 'image/png'
  ): Promise<OpenRouterGenerationResult> {
    this.ensureInitialized();

    const startTime = Date.now();

    console.log(`🔄 Generating template from base64 image`);

    try {
      // Build request payload
      const requestBody = {
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.buildPrompt(),
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 8000,
        temperature: 0.3,
      };

      // Make HTTP request
      const response = await axios.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://amp-email-platform.com',
            'X-Title': 'AMP Email Template Generator',
          },
          timeout: 120000,
        }
      );

      const choices = response.data.choices;
      if (!choices || choices.length === 0) {
        throw new Error('No response from OpenRouter API');
      }

      let html = choices[0].message.content || '';
      html = this.cleanHTML(html);

      const imagePlaceholders = this.extractImagePlaceholders(html);
      const processingTime = Date.now() - startTime;

      console.log(`✅ Template generated successfully`);
      console.log(`   HTML Length: ${html.length} characters`);
      console.log(`   Image Placeholders: ${imagePlaceholders.length}`);
      console.log(`   Processing Time: ${processingTime}ms`);

      return {
        html,
        imagePlaceholders,
        processingTime,
        model: this.modelName,
      };
    } catch (error: any) {
      console.error(`❌ OpenRouter generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean HTML output (remove markdown wrappers)
   */
  private cleanHTML(html: string): string {
    let cleaned = html.trim();

    // Remove markdown code blocks
    if (cleaned.startsWith('```html')) {
      cleaned = cleaned.replace(/```html\n?/g, '').replace(/```\n?$/g, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```\n?/g, '');
    }

    return cleaned.trim();
  }

  /**
   * Extract image placeholder positions from HTML
   */
  private extractImagePlaceholders(html: string): string[] {
    const placeholders: string[] = [];
    const imgRegex = /<(?:img|amp-img)[^>]*alt="image_placeholder"[^>]*>/gi;
    const matches = html.match(imgRegex);

    if (matches) {
      matches.forEach((match, index) => {
        placeholders.push(`image_placeholder_${index + 1}`);
      });
    }

    return placeholders;
  }

  /**
   * Replace image placeholders with generated images
   */
  async replaceImagePlaceholders(
    html: string,
    imageUrls: string[]
  ): Promise<string> {
    let updatedHtml = html;
    const placeholderRegex = /<(?:img|amp-img)([^>]*alt="image_placeholder"[^>]*)>/gi;
    const matches = [...html.matchAll(placeholderRegex)];

    matches.forEach((match, index) => {
      if (index < imageUrls.length) {
        const imgTag = match[0];
        // Replace src or placeholder with actual image URL
        let updatedTag = imgTag.replace(
          /src="[^"]*"/,
          `src="${imageUrls[index]}"`
        );

        // Also update any placeholder text in style or other attributes
        updatedTag = updatedTag.replace(
          /image_placeholder/g,
          `Product Image ${index + 1}`
        );

        updatedHtml = updatedHtml.replace(imgTag, updatedTag);
      }
    });

    return updatedHtml;
  }

  /**
   * Batch generate templates from multiple images
   */
  async batchGenerate(
    imagePaths: string[],
    outputDir: string,
    onProgress?: (current: number, total: number, imageName: string) => void
  ): Promise<OpenRouterGenerationResult[]> {
    this.ensureInitialized();

    const results: OpenRouterGenerationResult[] = [];

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`\n🚀 Starting batch generation of ${imagePaths.length} templates...`);

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const imageName = path.basename(imagePath);

      console.log(`\n[${i + 1}/${imagePaths.length}] Processing: ${imageName}`);

      try {
        const result = await this.generateFromImage(imagePath);
        results.push(result);

        // Save HTML to file
        const htmlFileName = imageName.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '.html');
        const htmlPath = path.join(outputDir, htmlFileName);
        fs.writeFileSync(htmlPath, result.html, 'utf-8');
        console.log(`   Saved: ${htmlFileName}`);

        if (onProgress) {
          onProgress(i + 1, imagePaths.length, imageName);
        }

        // Rate limiting: 2 second delay between requests
        if (i < imagePaths.length - 1) {
          console.log('   ⏳ Rate limit delay (2s)...');
          await this.sleep(2000);
        }
      } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}`);
        // Continue with next image
      }
    }

    console.log(`\n✅ Batch generation complete! Generated ${results.length}/${imagePaths.length} templates`);

    return results;
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext.toLowerCase()] || 'image/png';
  }

  /**
   * Sleep utility for rate limiting
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
}

export default new OpenRouterTemplateGenerator();
