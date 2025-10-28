import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

/**
 * Vision Analysis Service
 * Analyzes email template images using GPT-4 Vision to extract design patterns
 *
 * Extracts:
 * - Color palette
 * - Layout type
 * - Typography style
 * - Campaign types (what the template is suitable for)
 * - Tone and mood
 * - Key design elements
 *
 * Configuration required:
 * - OPENAI_API_KEY: OpenAI API key
 * - OPENAI_VISION_MODEL: Vision model to use (default: gpt-4-vision-preview)
 */

export interface DesignAnalysis {
  colors: string[];
  layout_type: string;
  typography: string;
  campaign_types: string[];
  tone: string;
  description: string;
  key_elements: string[];
}

class VisionAnalysisService {
  private client: OpenAI | null = null;
  private visionModel: string;
  private initialized = false;

  constructor() {
    this.visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o';
  }

  private isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (!this.isConfigured()) {
      console.warn('⚠️  OpenAI not configured (missing OPENAI_API_KEY)');
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
      });

      console.log('✅ OpenAI vision client initialized');
      console.log('   Model:', this.visionModel);
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI vision client:', error);
      this.client = null;
    }
  }

  /**
   * Check if vision service is available
   */
  isAvailable(): boolean {
    this.ensureInitialized();
    return this.isConfigured() && this.client !== null;
  }

  /**
   * Analyze email template image from local file path
   */
  async analyzeTemplateFromFile(imagePath: string): Promise<DesignAnalysis> {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = this.getMimeType(ext);

    return this.analyzeTemplateFromBase64(base64Image, mimeType);
  }

  /**
   * Analyze email template image from URL
   */
  async analyzeTemplateFromUrl(imageUrl: string): Promise<DesignAnalysis> {
    if (!this.client) {
      console.warn('Vision client not configured. Returning mock analysis.');
      return this.generateMockAnalysis();
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.buildAnalysisPrompt(),
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      const analysisText = response.choices[0].message.content || '';
      return this.parseAnalysisResponse(analysisText);
    } catch (error: any) {
      console.error('❌ Failed to analyze template from URL:', error.message);
      throw error;
    }
  }

  /**
   * Analyze email template image from base64
   */
  async analyzeTemplateFromBase64(
    base64Image: string,
    mimeType: string = 'image/png'
  ): Promise<DesignAnalysis> {
    this.ensureInitialized();

    if (!this.client) {
      console.warn('Vision client not configured. Returning mock analysis.');
      return this.generateMockAnalysis();
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.buildAnalysisPrompt(),
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
        max_tokens: 1000,
        temperature: 0.3,
      });

      const analysisText = response.choices[0].message.content || '';
      return this.parseAnalysisResponse(analysisText);
    } catch (error: any) {
      console.error('❌ Failed to analyze template:', error.message);
      throw error;
    }
  }

  /**
   * Build the analysis prompt for GPT-4 Vision
   */
  private buildAnalysisPrompt(): string {
    return `Analyze this email template design and provide a structured analysis in JSON format.

Extract the following information:

1. **colors**: Array of hex color codes used in the design (3-5 main colors)
2. **layout_type**: The layout style (e.g., "single-column", "multi-column", "hero-image", "minimal", "grid", "card-based")
3. **typography**: Typography style (e.g., "modern-sans-serif", "classic-serif", "bold-display", "minimal")
4. **campaign_types**: Array of campaign types this template suits (e.g., "abandoned_cart", "product_launch", "price_drop", "newsletter", "promotional", "welcome", "announcement")
5. **tone**: Overall tone/mood (e.g., "professional", "friendly", "urgent", "elegant", "playful", "minimal")
6. **description**: A 1-2 sentence description of the template's visual style and purpose
7. **key_elements**: Array of notable design elements (e.g., "large-hero-image", "cta-button", "product-grid", "social-icons", "discount-badge")

Respond ONLY with valid JSON in this exact format:
{
  "colors": ["#HEXCODE1", "#HEXCODE2", ...],
  "layout_type": "type",
  "typography": "style",
  "campaign_types": ["type1", "type2"],
  "tone": "tone",
  "description": "description text",
  "key_elements": ["element1", "element2"]
}`;
  }

  /**
   * Parse the AI's response into structured data
   */
  private parseAnalysisResponse(response: string): DesignAnalysis {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = response.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      return {
        colors: parsed.colors || [],
        layout_type: parsed.layout_type || 'unknown',
        typography: parsed.typography || 'unknown',
        campaign_types: parsed.campaign_types || [],
        tone: parsed.tone || 'unknown',
        description: parsed.description || '',
        key_elements: parsed.key_elements || [],
      };
    } catch (error) {
      console.error('❌ Failed to parse vision analysis response:', error);
      console.log('Raw response:', response);

      // Return a partial analysis
      return {
        colors: [],
        layout_type: 'unknown',
        typography: 'unknown',
        campaign_types: [],
        tone: 'unknown',
        description: response.substring(0, 200),
        key_elements: [],
      };
    }
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

    return mimeTypes[ext] || 'image/png';
  }

  /**
   * Generate mock analysis for development/testing
   */
  private generateMockAnalysis(): DesignAnalysis {
    return {
      colors: ['#2563eb', '#f59e0b', '#10b981', '#ffffff', '#1f2937'],
      layout_type: 'hero-image',
      typography: 'modern-sans-serif',
      campaign_types: ['promotional', 'product_launch', 'abandoned_cart'],
      tone: 'professional',
      description: 'Modern email template with bold hero image, clean typography, and prominent call-to-action button.',
      key_elements: ['large-hero-image', 'cta-button', 'product-showcase', 'trust-badges'],
    };
  }

  /**
   * Batch analyze multiple templates
   */
  async analyzeMultipleTemplates(
    imagePaths: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, DesignAnalysis>> {
    const results = new Map<string, DesignAnalysis>();
    let completed = 0;

    for (const imagePath of imagePaths) {
      try {
        console.log(`🔍 Analyzing: ${path.basename(imagePath)}`);
        const analysis = await this.analyzeTemplateFromFile(imagePath);
        results.set(imagePath, analysis);

        completed++;
        if (onProgress) {
          onProgress(completed, imagePaths.length);
        }

        // Rate limiting: wait 1 second between requests to avoid API limits
        if (completed < imagePaths.length) {
          await this.sleep(1000);
        }
      } catch (error: any) {
        console.error(`❌ Failed to analyze ${imagePath}:`, error.message);
        // Continue with other templates
      }
    }

    return results;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new VisionAnalysisService();
