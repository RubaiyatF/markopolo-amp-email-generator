import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

/**
 * Template Cloning Service
 * Batch clones Flodesk email templates into AMP4Email HTML
 *
 * Features:
 * - Vision-based design extraction with pixel-level precision
 * - AMP4Email-compliant HTML generation
 * - Batch processing with progress tracking
 * - Error recovery and retry logic
 * - Metadata generation
 */

// Enhanced design analysis schema for template cloning
export interface DetailedDesignAnalysis {
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
    background: string;
    text: string;
    additional?: string[];
  };
  typography: {
    heading: {
      family: string;
      size: string;
      weight: number;
      lineHeight?: string;
    };
    subheading?: {
      family: string;
      size: string;
      weight: number;
    };
    body: {
      family: string;
      size: string;
      weight: number;
      lineHeight?: string;
    };
  };
  layout: {
    type: string; // single-column, multi-column, hero-image, etc.
    maxWidth: string;
    columnCount?: number;
  };
  spacing: {
    section: string;
    paragraph: string;
    elementGap?: string;
  };
  backgrounds: {
    [sectionName: string]: {
      type: 'solid' | 'gradient' | 'image';
      colors?: string[];
      direction?: string;
    };
  };
  buttons: Array<{
    backgroundColor: string;
    textColor: string;
    padding: string;
    borderRadius?: string;
    fontSize?: string;
  }>;
  borders: {
    radius?: string;
    color?: string;
    width?: string;
  };
  images: Array<{
    type: string; // hero, product, icon, etc.
    width?: string;
    height?: string;
    aspectRatio?: string;
  }>;
  sections: string[]; // ordered list of sections
}

export interface CloneMetadata {
  source_template: string;
  source_path: string;
  cloned_at: string;
  design_analysis: DetailedDesignAnalysis;
  generation_model: string;
  validation_status: 'passed' | 'failed';
  html_length: number;
  processing_time: number;
  retry_count: number;
  amp_features: string[];
  category?: string;
}

export interface BatchSummary {
  total_templates: number;
  successful_clones: number;
  failed_clones: number;
  total_processing_time: number;
  average_processing_time: number;
  total_cost_estimate: number;
  failed_template_list: string[];
  timestamp: string;
}

class TemplateCloningService {
  private client: OpenAI | null = null;
  private visionModel: string;
  private generationModel: string;
  private initialized = false;

  constructor() {
    this.visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o';
    this.generationModel = process.env.OPENAI_GENERATION_MODEL || 'gpt-4o-mini';
  }

  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    console.log('✅ Template Cloning Service initialized');
    console.log(`   Vision Model: ${this.visionModel}`);
    console.log(`   Generation Model: ${this.generationModel}`);
  }

  /**
   * Extract detailed design specifications from template image
   */
  async extractDesignSpecs(imagePath: string): Promise<DetailedDesignAnalysis> {
    this.ensureInitialized();

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = this.getMimeType(path.extname(imagePath));

    const prompt = this.buildVisionPrompt();

    try {
      const response = await this.client!.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.2, // Low temperature for precision
      });

      const analysisText = response.choices[0].message.content || '';
      return this.parseDesignSpecs(analysisText);
    } catch (error: any) {
      console.error(`❌ Vision analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build comprehensive vision analysis prompt
   */
  private buildVisionPrompt(): string {
    return `You are a precise email template design analyzer. Analyze this email template image with PIXEL-LEVEL PRECISION and extract complete design specifications.

YOU MUST RESPOND WITH VALID JSON ONLY. NO explanatory text, NO markdown, JUST JSON.

Extract the following design elements:

**1. COLOR PALETTE**
- Primary color (main brand color)
- Secondary color (if present)
- Accent color (for highlights, CTAs)
- Background color
- Text color (body text)
- Additional colors used

Provide as exact HEX codes (e.g., #2563eb).

**2. TYPOGRAPHY**
- Heading: font family (e.g., Arial, Helvetica), size in px, weight (e.g., 700), line-height
- Subheading: font family, size, weight (if present)
- Body text: font family, size in px, weight, line-height

**3. LAYOUT STRUCTURE**
- Layout type: single-column, multi-column, hero-image, card-based, grid, minimal
- Max width in px (typical: 600px)
- Column count (if multi-column)

**4. SPACING SYSTEM**
- Section padding (vertical spacing between major sections) in px
- Paragraph spacing (gap between paragraphs) in px
- Element gaps (spacing between related elements) in px

**5. BACKGROUND STYLES**
For each major section (header, hero, body, footer), specify:
- Type: solid, gradient, or image
- Colors (hex codes)
- Gradient direction if applicable (e.g., "to bottom", "135deg")

**6. BUTTON STYLES**
For each button style present:
- Background color (hex)
- Text color (hex)
- Padding (e.g., "16px 32px")
- Border radius (e.g., "8px")
- Font size

**7. BORDERS AND DECORATION**
- Border radius for cards/sections (if present)
- Border color and width
- Shadow specifications (if visible)

**8. IMAGES**
For each image type:
- Type: hero, product, icon, badge, background
- Width and height (if determinable)
- Aspect ratio

**9. SECTION ORDER**
List sections in order: e.g., ["header", "hero", "features", "cta", "footer"]

Respond ONLY with valid JSON in this exact format:
{
  "colors": {
    "primary": "#HEXCODE",
    "secondary": "#HEXCODE",
    "accent": "#HEXCODE",
    "background": "#HEXCODE",
    "text": "#HEXCODE",
    "additional": ["#HEXCODE1", "#HEXCODE2"]
  },
  "typography": {
    "heading": {"family": "FontName", "size": "32px", "weight": 700, "lineHeight": "1.2"},
    "subheading": {"family": "FontName", "size": "20px", "weight": 600},
    "body": {"family": "FontName", "size": "16px", "weight": 400, "lineHeight": "1.6"}
  },
  "layout": {
    "type": "hero-image",
    "maxWidth": "600px",
    "columnCount": 1
  },
  "spacing": {
    "section": "40px",
    "paragraph": "16px",
    "elementGap": "24px"
  },
  "backgrounds": {
    "header": {"type": "solid", "colors": ["#ffffff"]},
    "hero": {"type": "gradient", "colors": ["#667eea", "#764ba2"], "direction": "to bottom"}
  },
  "buttons": [
    {"backgroundColor": "#2563eb", "textColor": "#ffffff", "padding": "16px 32px", "borderRadius": "8px", "fontSize": "16px"}
  ],
  "borders": {
    "radius": "8px",
    "color": "#e5e7eb",
    "width": "1px"
  },
  "images": [
    {"type": "hero", "width": "600px", "height": "400px", "aspectRatio": "3:2"}
  ],
  "sections": ["header", "hero", "body", "cta", "footer"]
}`;
  }

  /**
   * Parse design specifications from vision response
   */
  private parseDesignSpecs(response: string): DetailedDesignAnalysis {
    try {
      let jsonText = response.trim();

      // Remove markdown code blocks
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);
      return parsed as DetailedDesignAnalysis;
    } catch (error) {
      console.error('❌ Failed to parse design specs:', error);
      console.log('Raw response:', response.substring(0, 500));
      throw new Error('Failed to parse vision analysis response');
    }
  }

  /**
   * Generate AMP4Email HTML from design specifications
   */
  async generateAMPHTML(
    designSpecs: DetailedDesignAnalysis,
    sourceTemplate: string,
    retryCount: number = 0
  ): Promise<string> {
    this.ensureInitialized();

    const prompt = this.buildHTMLGenerationPrompt(designSpecs, sourceTemplate);

    try {
      const response = await this.client!.chat.completions.create({
        model: this.generationModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert email template developer specializing in AMP4Email. Generate pixel-perfect HTML based on design specifications.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      });

      let html = response.choices[0].message.content || '';

      // Clean HTML (remove markdown code blocks if present)
      html = this.cleanHTML(html);

      return html;
    } catch (error: any) {
      console.error(`❌ HTML generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build HTML generation prompt with design specs
   */
  private buildHTMLGenerationPrompt(specs: DetailedDesignAnalysis, sourceTemplate: string): string {
    return `Generate a pixel-perfect AMP4Email HTML template based on these design specifications.

**SOURCE TEMPLATE**: ${sourceTemplate}

**DESIGN SPECIFICATIONS**:
${JSON.stringify(specs, null, 2)}

**REQUIREMENTS**:

1. **AMP4Email Compliance**:
   - Start with: <!doctype html>
   - HTML tag: <html ⚡4email>
   - Include: <script async src="https://cdn.ampproject.org/v0.js"></script>
   - Include boilerplate: <style amp4email-boilerplate>body{visibility:hidden}</style>
   - All CSS in single <style amp-custom> tag (max 75KB)
   - Use <amp-img> instead of <img> with width, height, and layout attributes

2. **Color Accuracy**:
   - Use EXACT hex codes from specifications
   - Apply colors consistently across matching elements
   - Preserve gradient directions and color stops

3. **Typography Precision**:
   - Use specified font families, sizes, weights
   - Apply correct line-heights
   - Use web-safe fonts (Arial, Helvetica, Georgia, Times New Roman, Courier, Verdana, Tahoma)

4. **Layout Fidelity**:
   - Follow section order exactly
   - Maintain max-width constraint
   - Preserve column structure
   - Apply correct spacing values

5. **Placeholder Content**:
   - Product name: {{productName}}
   - Product image: {{productImage}}
   - Product price: {{productPrice}}
   - Customer name: {{firstName}}
   - CTA link: {{ctaLink}}

6. **Structure**:
   - Center-aligned container with max-width
   - Responsive design (mobile-friendly)
   - Proper semantic HTML structure

Generate ONLY the HTML code, NO explanations, NO markdown code blocks. Start directly with <!doctype html>.`;
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
   * Validate AMP compliance
   */
  validateAMP(html: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required elements
    if (!html.includes('<!doctype html>') && !html.toLowerCase().startsWith('<!doctype html>')) {
      errors.push('Missing DOCTYPE declaration');
    }

    if (!html.includes('⚡4email') && !html.includes('amp4email')) {
      errors.push('Missing AMP4Email attribute on <html> tag');
    }

    if (!html.includes('https://cdn.ampproject.org/v0.js')) {
      errors.push('Missing AMP script');
    }

    if (!html.includes('amp4email-boilerplate')) {
      errors.push('Missing AMP boilerplate style');
    }

    if (!html.includes('<style amp-custom>')) {
      errors.push('Missing <style amp-custom> tag');
    }

    // Check prohibited elements
    if (html.match(/<img[^>]*(?!amp-img)/)) {
      errors.push('Contains <img> tags (use <amp-img> instead)');
    }

    if (html.includes('<script') && !html.includes('cdn.ampproject.org')) {
      errors.push('Contains prohibited script tags');
    }

    // Check CSS size
    const cssMatch = html.match(/<style amp-custom>([\s\S]*?)<\/style>/);
    if (cssMatch && cssMatch[1].length > 75000) {
      errors.push(`CSS size exceeds 75KB limit (${cssMatch[1].length} bytes)`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clone a single template
   */
  async cloneTemplate(
    imagePath: string,
    outputDir: string,
    maxRetries: number = 3
  ): Promise<CloneMetadata> {
    const startTime = Date.now();
    const sourceTemplate = path.basename(imagePath);
    const templateName = sourceTemplate.replace(path.extname(imagePath), '');
    let retryCount = 0;

    console.log(`\n🔄 Processing: ${sourceTemplate}`);

    // Step 1: Extract design specifications
    console.log('   Vision analysis...');
    const designAnalysis = await this.extractDesignSpecs(imagePath);
    console.log(`   ✓ Design specs extracted`);

    // Step 2: Generate HTML
    let html = '';
    let validationResult = { valid: false, errors: [] as string[] };

    while (retryCount < maxRetries) {
      try {
        console.log(`   HTML generation... (attempt ${retryCount + 1}/${maxRetries})`);
        html = await this.generateAMPHTML(designAnalysis, sourceTemplate, retryCount);

        // Step 3: Validate AMP compliance
        validationResult = this.validateAMP(html);

        if (validationResult.valid) {
          console.log('   ✓ AMP validation passed');
          break;
        } else {
          console.log(`   ⚠️  Validation errors: ${validationResult.errors.join(', ')}`);
          retryCount++;

          if (retryCount < maxRetries) {
            console.log('   Retrying with corrections...');
            // Add a small delay before retry
            await this.sleep(1000);
          }
        }
      } catch (error: any) {
        console.error(`   ❌ Generation error: ${error.message}`);
        retryCount++;

        if (retryCount >= maxRetries) {
          throw error;
        }

        await this.sleep(1000);
      }
    }

    // Step 4: Save HTML file
    const htmlPath = path.join(outputDir, `${templateName}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`   Saved: ${templateName}.html`);

    // Step 5: Generate metadata
    const processingTime = Date.now() - startTime;
    const metadata: CloneMetadata = {
      source_template: sourceTemplate,
      source_path: imagePath,
      cloned_at: new Date().toISOString(),
      design_analysis: designAnalysis,
      generation_model: this.generationModel,
      validation_status: validationResult.valid ? 'passed' : 'failed',
      html_length: html.length,
      processing_time: processingTime,
      retry_count: retryCount,
      amp_features: this.extractAMPFeatures(html),
      category: this.categorizeTemplate(designAnalysis),
    };

    // Save metadata
    const metadataPath = path.join(outputDir, 'metadata', `${templateName}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    return metadata;
  }

  /**
   * Batch clone all templates
   */
  async batchCloneTemplates(
    templatesDir: string,
    outputDir: string,
    onProgress?: (current: number, total: number, template: string) => void
  ): Promise<BatchSummary> {
    this.ensureInitialized();

    const startTime = Date.now();

    // Get all PNG files
    const templateFiles = fs
      .readdirSync(templatesDir)
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .map((f) => path.join(templatesDir, f));

    const totalTemplates = templateFiles.length;
    console.log(`\n🚀 Starting batch clone of ${totalTemplates} templates...`);

    const results: CloneMetadata[] = [];
    const failedTemplates: string[] = [];

    for (let i = 0; i < templateFiles.length; i++) {
      const imagePath = templateFiles[i];
      const templateName = path.basename(imagePath);

      console.log(`\n[${i + 1}/${totalTemplates}] Processing: ${templateName}`);

      try {
        const metadata = await this.cloneTemplate(imagePath, outputDir);
        results.push(metadata);

        if (metadata.validation_status === 'failed') {
          failedTemplates.push(templateName);
        }

        if (onProgress) {
          onProgress(i + 1, totalTemplates, templateName);
        }

        // Rate limiting: 2 second delay between templates
        if (i < templateFiles.length - 1) {
          console.log('   ⏳ Rate limit delay (2s)...');
          await this.sleep(2000);
        }
      } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}`);
        failedTemplates.push(templateName);

        // Continue with next template
        continue;
      }
    }

    const totalTime = Date.now() - startTime;
    const successfulClones = results.filter((r) => r.validation_status === 'passed').length;

    // Generate batch summary
    const summary: BatchSummary = {
      total_templates: totalTemplates,
      successful_clones: successfulClones,
      failed_clones: failedTemplates.length,
      total_processing_time: totalTime,
      average_processing_time: totalTime / totalTemplates,
      total_cost_estimate: this.estimateCost(totalTemplates, results.reduce((sum, r) => sum + r.retry_count, 0)),
      failed_template_list: failedTemplates,
      timestamp: new Date().toISOString(),
    };

    // Save summary
    const summaryPath = path.join(outputDir, 'metadata', 'batch_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

    // Print final summary
    this.printSummary(summary);

    return summary;
  }

  /**
   * Print batch summary
   */
  private printSummary(summary: BatchSummary): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 BATCH CLONE COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total Templates: ${summary.total_templates}`);
    console.log(`✅ Successful: ${summary.successful_clones}/${summary.total_templates}`);
    console.log(`❌ Failed: ${summary.failed_clones}/${summary.total_templates}`);
    console.log(`⏱️  Total Time: ${(summary.total_processing_time / 1000 / 60).toFixed(2)} minutes`);
    console.log(`💰 Estimated Cost: $${summary.total_cost_estimate.toFixed(4)}`);

    if (summary.failed_template_list.length > 0) {
      console.log(`\n⚠️  Failed Templates:`);
      summary.failed_template_list.forEach((t) => console.log(`   - ${t}`));
    }

    console.log('='.repeat(60) + '\n');
  }

  /**
   * Extract AMP features used in HTML
   */
  private extractAMPFeatures(html: string): string[] {
    const features: string[] = [];

    if (html.includes('<amp-img')) features.push('amp-img');
    if (html.includes('<amp-carousel')) features.push('amp-carousel');
    if (html.includes('<amp-accordion')) features.push('amp-accordion');
    if (html.includes('<amp-form')) features.push('amp-form');

    return features;
  }

  /**
   * Categorize template based on design analysis
   */
  private categorizeTemplate(analysis: DetailedDesignAnalysis): string {
    const layout = analysis.layout.type.toLowerCase();

    if (layout.includes('hero')) return 'hero';
    if (layout.includes('grid') || layout.includes('card')) return 'product-grid';
    if (layout.includes('minimal')) return 'minimal';
    if (layout.includes('multi')) return 'newsletter';

    return 'general';
  }

  /**
   * Estimate API costs
   */
  private estimateCost(totalTemplates: number, totalRetries: number): number {
    // Vision analysis: $0.002 per call (GPT-4o)
    const visionCost = totalTemplates * 0.002;

    // HTML generation: $0.0005 per call (GPT-4o Mini)
    const generationCalls = totalTemplates + totalRetries;
    const generationCost = generationCalls * 0.0005;

    return visionCost + generationCost;
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
}

export default new TemplateCloningService();
