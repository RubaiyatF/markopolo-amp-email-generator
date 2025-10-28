import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Product, CampaignContext, UserContext } from '../schemas';

/**
 * Gemini Template Generator (via OpenRouter)
 * Uses Google Gemini 2.5 Flash via OpenRouter for intelligent template cloning
 *
 * Flow:
 * 1. Randomly pick a template image from flodesk_templates library
 * 2. Use Gemini vision to analyze the template and clone/adapt it for the product
 * 3. Each variation uses a unique random template for diversity
 */

export interface GeminiTemplateOptions {
  products: Product[];
  campaignContext: CampaignContext;
  userContext?: UserContext;
  variationIndex?: number;
}

export interface GeminiTemplateResult {
  html: string;
  imagePlaceholders: string[];
  processingTime: number;
  model: string;
  selectedTemplate?: string; // filename of the randomly selected template
}

class GeminiTemplateGenerator {
  private apiKey: string;
  private modelName: string;
  private apiEndpoint: string;
  private initialized = false;
  private templatesDir: string;
  private usedTemplates: Set<string> = new Set(); // Track used templates for variations

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.modelName = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    this.apiEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
    this.templatesDir = path.join(process.cwd(), 'flodesk_templates');
  }

  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured in environment variables');
    }

    console.log('✅ Gemini Template Generator initialized');
    console.log(`   Model: ${this.modelName}`);
  }

  /**
   * Randomly pick a template from flodesk_templates library
   * Ensures unique templates for multiple variations
   */
  private pickRandomTemplate(): string {
    const templates = fs.readdirSync(this.templatesDir).filter(f => f.endsWith('.png'));

    // Filter out already used templates
    const availableTemplates = templates.filter(t => !this.usedTemplates.has(t));

    // If all templates used, reset the set
    if (availableTemplates.length === 0) {
      this.usedTemplates.clear();
      availableTemplates.push(...templates);
    }

    // Pick random template
    const randomIndex = Math.floor(Math.random() * availableTemplates.length);
    const selectedTemplate = availableTemplates[randomIndex];

    // Mark as used
    this.usedTemplates.add(selectedTemplate);

    return selectedTemplate;
  }

  /**
   * Convert template image to base64
   */
  private templateToBase64(templateFilename: string): string {
    const templatePath = path.join(this.templatesDir, templateFilename);
    const imageBuffer = fs.readFileSync(templatePath);
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;
  }

  /**
   * Generate template using Gemini with random template inspiration
   */
  async generateTemplate(options: GeminiTemplateOptions): Promise<GeminiTemplateResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const { products, campaignContext, userContext, variationIndex = 0 } = options;
    const product = products[0];

    try {
      console.log(`🧠 Generating template with Gemini (variation ${variationIndex})...`);

      // Step 1: Randomly pick a template from flodesk_templates
      console.log('🎲 Randomly picking template from flodesk_templates...');
      const selectedTemplate = this.pickRandomTemplate();
      const templateBase64 = this.templateToBase64(selectedTemplate);
      console.log(`   ✓ Selected template: ${selectedTemplate}`);

      // Step 2: Build prompt for Gemini to clone the template
      const prompt = this.buildCloningPrompt(product, campaignContext, userContext, variationIndex);

      // Step 3: Use first product image for brand extraction (if available)
      let productImageUrl = '';
      if (product.images && product.images.length > 0) {
        // Use first product image for brand identity extraction
        productImageUrl = product.images[0];
      }

      // Step 4: Generate with Gemini (with BOTH product image and template image)
      const content: any[] = [
        {
          type: 'text',
          text: prompt,
        },
      ];

      // Add product image first (for brand identity extraction)
      if (productImageUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: productImageUrl,
          },
        });
      }

      // Add template image second (for structure cloning)
      content.push({
        type: 'image_url',
        image_url: {
          url: templateBase64,
        },
      });

      const requestBody = {
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        max_tokens: 8000,
        temperature: 0.4,
      };

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
        throw new Error('No response from Gemini API');
      }

      let html = choices[0].message.content || '';
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
        selectedTemplate,
      };
    } catch (error: any) {
      console.error(`❌ Gemini generation failed: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Build prompt for Gemini to clone template using visual analysis
   */
  private buildCloningPrompt(
    product: Product,
    campaignContext: CampaignContext,
    userContext: UserContext | undefined,
    variationIndex: number
  ): string {
    const firstName = userContext?.firstName || 'there';
    const showPrice = product.price && Number(product.price) > 0;

    // Determine variation style
    const variations = [
      { name: 'A', style: 'Bold and energetic', approach: 'vibrant colors and strong CTAs' },
      { name: 'B', style: 'Minimal and elegant', approach: 'clean layout with subtle accents' },
      { name: 'C', style: 'Modern and professional', approach: 'balanced design with brand focus' }
    ];
    const currentVariation = variations[variationIndex] || variations[0];

    return `You are an expert AMP email template designer. Your task is to create a NEW email template by visually analyzing the provided reference template image and adapting it for the product.

**CAMPAIGN CONTEXT:**
- Type: ${campaignContext.type}
- Goal: ${campaignContext.goal}
- Urgency: ${campaignContext.urgency || 'medium'}
${campaignContext.discount ? `- Discount: ${campaignContext.discount}%` : ''}

**PRODUCT INFORMATION:**
- Name: ${product.name}
- Brand: ${product.brand || 'Brand'}
${showPrice ? `- Price: ${product.currency || 'USD'} ${product.price}` : '- Price: Not available (DO NOT show pricing)'}
- Description: ${product.description || 'Discover this exceptional product'}
- Product URL: ${product.url || '#'}

**PERSONALIZATION:**
Use merge tags: {{firstName}} and {{email}}

**VARIATION REQUIREMENT:**
- Variation: ${currentVariation.name}
- Style: ${currentVariation.style}
- Approach: ${currentVariation.approach}

**YOUR TASK:**
You will receive TWO images:
1. **Product page screenshot** - Extract brand identity (colors, fonts, design style) - THIS IS THE PRIMARY SOURCE FOR DESIGN
2. **Email template reference** - Use ONLY for structure and layout - DO NOT USE ITS COLORS

**CRITICAL: BRAND COLORS MUST COME FROM PRODUCT PAGE, NOT TEMPLATE!**

**STEP 1: Analyze Product Page Screenshot (PRIMARY SOURCE)**
Extract and use these EXACT brand elements:
- **Brand Colors**: COPY the exact primary, secondary, accent colors from the product page
- **Typography Style**: MATCH the font characteristics (serif/sans-serif, weight, style)
- **Design Aesthetic**: REPLICATE the minimal/bold/elegant/modern style from brand
- **Brand Voice**: MATCH the professional/casual/energetic tone

**STEP 2: Clone Email Template Structure (LAYOUT ONLY)**
From the reference email template, use ONLY:
- **Layout Structure**: Sections, spacing, alignment
- **Email Components**: Header, hero, body, footer placement
- **Visual Hierarchy**: How information is organized
- **DO NOT USE THE TEMPLATE'S COLORS** - colors must come from product page!

**STEP 3: Combine Brand + Structure**
Apply the product page's brand identity to the email template structure.
REMEMBER: Colors, fonts, and design aesthetic MUST match the product page, NOT the template!

**STRICT REQUIREMENTS:**
1. **AMP4Email Compliance:**
   - Start with: <!doctype html>
   - Use: <html ⚡4email> or <html amp4email>
   - Include: <script async src="https://cdn.ampproject.org/v0.js"></script>
   - Include: <style amp4email-boilerplate>body{visibility:hidden}</style>
   - All CSS in <style amp-custom> (max 75KB)
   - Use <amp-img> with width/height/layout attributes

2. **Image Placeholders (IMPORTANT - Use different labels):**
   - **Header/Logo images**: alt="brand_logo_placeholder", src="https://via.placeholder.com/150x50?text=Logo"
   - **Footer social icons**: alt="social_icon_placeholder", src="https://via.placeholder.com/24x24?text=Icon"
   - **Product images (body/content)**: alt="product_image_placeholder", src="https://via.placeholder.com/600x400?text=Product"
   - ONLY product images will be AI-generated - logos and icons remain as placeholders

3. **Content Requirements:**
   - Product name: ${product.name}
   - ${showPrice ? `Price: ${product.currency} ${product.price} (show prominently)` : 'DO NOT show price - unavailable'}
   - CTA button linking to: ${product.url || '#'}
   - Greeting: "Hi {{firstName}}!"
   - Footer with {{email}} merge tag

4. **Design Requirements:**
   - **COLORS**: Use ONLY colors from the PRODUCT PAGE screenshot, NOT from the template
   - **LAYOUT**: Replicate the template's layout structure (sections, spacing, alignment)
   - **TYPOGRAPHY**: Match the product page's typography style, NOT the template's fonts
   - **BRAND CONSISTENCY**: The final email must look like it's from the product's brand
   - **Variation Style**: Maintain ${currentVariation.style} while using brand colors

5. **CTA Text (based on campaign):**
   ${this.getCTAText(campaignContext.type)}

**OUTPUT FORMAT:**
Return ONLY the complete HTML code. NO explanations, NO markdown code blocks, NO commentary.
Start with <!doctype html> and end with </html>.

Generate the AMP email template now:`;
  }

  /**
   * Get CTA text based on campaign type
   */
  private getCTAText(campaignType: string): string {
    const ctaMap: Record<string, string> = {
      abandoned_cart: '"Complete Your Purchase" or "Return to Cart"',
      product_launch: '"Be the First" or "Shop Now"',
      promotional: '"Shop the Sale" or "Get This Deal"',
      price_drop: '"Claim Discount" or "Get It Now"',
      newsletter: '"Read More" or "Explore"',
    };
    return ctaMap[campaignType] || '"Shop Now" or "Learn More"';
  }

  /**
   * Clean HTML output
   */
  private cleanHTML(html: string): string {
    let cleaned = html.trim();

    // Remove markdown code blocks
    if (cleaned.startsWith('```html')) {
      cleaned = cleaned.replace(/```html\n?/g, '').replace(/```\n?$/g, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```\n?/g, '');
    }

    // Ensure proper doctype
    if (!cleaned.toLowerCase().startsWith('<!doctype')) {
      cleaned = `<!doctype html>\n${cleaned}`;
    }

    return cleaned.trim();
  }

  /**
   * Extract ONLY product image placeholder positions (not logos or social icons)
   */
  private extractImagePlaceholders(html: string): string[] {
    const placeholders: string[] = [];
    // Only match product_image_placeholder, NOT brand_logo or social_icon placeholders
    const imgRegex = /<(?:img|amp-img)[^>]*alt="product_image_placeholder"[^>]*>/gi;
    const matches = html.match(imgRegex);

    if (matches) {
      matches.forEach((match, index) => {
        placeholders.push(`product_image_${index + 1}`);
      });
    }

    return placeholders;
  }

  /**
   * Replace ONLY product image placeholders with URLs (not logos or social icons)
   */
  replaceImagePlaceholders(html: string, imageUrls: string[]): string {
    let updatedHtml = html;
    // Only replace product_image_placeholder, NOT brand_logo or social_icon placeholders
    const placeholderRegex = /<((?:img|amp-img)[^>]*alt="product_image_placeholder"[^>]*)>/gi;
    const matches = [...html.matchAll(placeholderRegex)];

    matches.forEach((match, index) => {
      if (index < imageUrls.length) {
        const fullTag = match[0];
        const tagContent = match[1];

        // Replace src with actual image URL
        let updatedTag = fullTag.replace(
          /src="[^"]*"/i,
          `src="${imageUrls[index]}"`
        );

        // Update alt text
        updatedTag = updatedTag.replace(
          /alt="product_image_placeholder"/i,
          `alt="Product Image ${index + 1}"`
        );

        updatedHtml = updatedHtml.replace(fullTag, updatedTag);
      }
    });

    return updatedHtml;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      model: this.modelName,
      provider: 'OpenRouter',
      ragEnabled: true,
      configured: this.isConfigured(),
    };
  }
}

export default new GeminiTemplateGenerator();
