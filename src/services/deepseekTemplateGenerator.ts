import Replicate from 'replicate';
import { Product, CampaignContext, UserContext } from '../schemas';
import templateLibrary from './templateLibrary';
import aiModelConfig from '../config/ai-models.config';

/**
 * DeepSeek R1 Template Generator with Qdrant RAG
 * Uses DeepSeek R1 reasoning model + Qdrant vector DB for intelligent template generation
 */

export interface DeepSeekTemplateOptions {
  products: Product[];
  campaignContext: CampaignContext;
  userContext?: UserContext;
  variationIndex: number;
  ragContext?: any;
}

class DeepSeekTemplateGenerator {
  private replicate: Replicate | null = null;
  private modelConfig = aiModelConfig.templateModel;

  constructor() {
    if (process.env.REPLICATE_API_KEY) {
      this.replicate = new Replicate({
        auth: process.env.REPLICATE_API_KEY,
      });
      console.log(`✅ DeepSeek R1 initialized: ${this.modelConfig.name}`);
    } else {
      console.warn('⚠️  REPLICATE_API_KEY not set - DeepSeek R1 disabled');
    }
  }

  /**
   * Generate AMP email template using DeepSeek R1 + Qdrant RAG
   */
  async generateTemplate(options: DeepSeekTemplateOptions): Promise<string> {
    if (!this.replicate) {
      console.warn('DeepSeek R1 not configured, falling back to default generation');
      return this.generateFallbackTemplate(options);
    }

    const { products, campaignContext, userContext, variationIndex } = options;

    try {
      console.log(`🧠 Generating template with DeepSeek R1 (variation ${variationIndex})...`);

      // Step 1: Get RAG context from Qdrant (similar templates)
      const ragContext = await this.fetchRAGContext(campaignContext);

      // Step 2: Build enriched prompt with RAG context
      const prompt = this.buildRAGEnrichedPrompt(
        products,
        campaignContext,
        userContext,
        variationIndex,
        ragContext
      );

      console.log(`   📚 Using ${ragContext.length} similar templates from Qdrant`);

      // Step 3: Generate with DeepSeek R1
      const startTime = Date.now();
      const output = await this.replicate.run(
        this.modelConfig.modelId as `${string}/${string}`,
        {
          input: {
            prompt: prompt,
            temperature: aiModelConfig.defaults.template.temperature,
            max_tokens: aiModelConfig.defaults.template.maxTokens,
            top_p: aiModelConfig.defaults.template.topP,
          }
        }
      );

      const generationTime = Date.now() - startTime;

      // Extract template from output
      let template: string;
      if (Array.isArray(output)) {
        template = output.join('');
      } else if (typeof output === 'string') {
        template = output;
      } else {
        throw new Error('Unexpected output format from DeepSeek R1');
      }

      // Clean and validate template
      template = this.cleanTemplate(template);

      console.log(`   ✅ Template generated in ${(generationTime / 1000).toFixed(2)}s`);
      console.log(`   📏 Length: ${template.length} characters`);

      return template;

    } catch (error: any) {
      console.error(`❌ DeepSeek R1 generation failed:`, error.message);
      console.log('   ⚠️  Falling back to default generation');
      return this.generateFallbackTemplate(options);
    }
  }

  /**
   * Fetch similar templates from Qdrant RAG
   */
  private async fetchRAGContext(campaignContext: CampaignContext): Promise<any[]> {
    try {
      // Use existing template library service (Qdrant integration)
      const similarTemplates = await templateLibrary.findSimilarTemplates(
        campaignContext,
        5 // Get top 5 similar templates
      );

      return similarTemplates;
    } catch (error: any) {
      console.warn(`⚠️  RAG context fetch failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Build RAG-enriched prompt for DeepSeek R1
   */
  private buildRAGEnrichedPrompt(
    products: Product[],
    campaignContext: CampaignContext,
    userContext: UserContext | undefined,
    variationIndex: number,
    ragContext: any[]
  ): string {
    const product = products[0];
    const firstName = userContext?.firstName || 'there';

    // Extract design patterns from RAG templates
    const designPatterns = ragContext.map((t, idx) => ({
      filename: t.filename,
      colors: t.design_analysis?.colors || [],
      layout: t.design_analysis?.layout_type || 'single-column',
      typography: t.design_analysis?.typography || 'modern-sans-serif',
      tone: t.design_analysis?.tone || 'professional',
      score: t.score
    }));

    // Determine variation style based on index
    const variations = [
      { name: 'A', style: 'Bold and energetic', colorScheme: 'vibrant gradients' },
      { name: 'B', style: 'Minimal and elegant', colorScheme: 'neutral tones' },
      { name: 'C', style: 'Modern and professional', colorScheme: 'brand colors' }
    ];

    const currentVariation = variations[variationIndex] || variations[0];

    const prompt = `You are an expert email template designer specializing in AMP email templates for e-commerce campaigns.

TASK: Generate a high-converting AMP email template for a ${campaignContext.type} campaign.

CAMPAIGN CONTEXT:
- Type: ${campaignContext.type}
- Goal: ${campaignContext.goal}
- Urgency: ${campaignContext.urgency || 'medium'}
${campaignContext.discount ? `- Discount: ${campaignContext.discount}%` : ''}

PRODUCT INFORMATION:
- Name: ${product.name}
- Price: ${product.price ? `${product.currency || 'USD'} $${product.price}` : 'Not available (hide pricing)'}
- Description: ${product.description || 'Discover this exceptional product'}
- Image URL: ${product.image || 'placeholder'}
- Product URL: ${product.url || '#'}
${product.brand ? `- Brand: ${product.brand}` : ''}

RECIPIENT PERSONALIZATION:
- First Name: {{firstName}} (merge tag - use this for personalization)
- Email: {{email}} (merge tag)

VARIATION REQUIREMENT:
- Variation: ${currentVariation.name}
- Style: ${currentVariation.style}
- Color Scheme: ${currentVariation.colorScheme}

DESIGN INSPIRATION (from Qdrant RAG - Top ${ragContext.length} similar templates):
${designPatterns.slice(0, 3).map((p, idx) => `
${idx + 1}. Template: ${p.filename}
   - Colors: ${p.colors.join(', ') || 'default palette'}
   - Layout: ${p.layout}
   - Typography: ${p.typography}
   - Tone: ${p.tone}
   - Similarity Score: ${(p.score * 100).toFixed(1)}%
`).join('')}

REQUIREMENTS:
1. Generate ONLY valid AMP4Email HTML (use ⚡4email or amp4email attribute)
2. Include required AMP script: <script async src="https://cdn.ampproject.org/v0.js"></script>
3. Include amp4email-boilerplate: <style amp4email-boilerplate>body{visibility:hidden}</style>
4. All styles in <style amp-custom> tag (max 75KB)
5. Use merge tags: {{firstName}} and {{email}}
6. ${product.price && Number(product.price) > 0 ? 'Include pricing prominently' : 'DO NOT show pricing - price unavailable'}
7. Mobile-responsive design (max-width: 600px container)
8. Include prominent CTA button linking to: ${product.url || '#'}
9. Use product image: ${product.image || 'placeholder'}
10. Follow ${currentVariation.style} style with ${currentVariation.colorScheme}

DESIGN GUIDELINES:
- Incorporate color schemes from RAG templates above
- Use ${designPatterns[0]?.layout || 'single-column'} layout as primary inspiration
- Typography style: ${designPatterns[0]?.typography || 'modern-sans-serif'}
- Tone: ${designPatterns[0]?.tone || 'professional'}
- Add relevant product features section
- Include trust signals (shipping, returns, etc.)

CTA TEXT (choose appropriate):
- abandoned_cart: "Complete Your Purchase" or "Return to Cart"
- product_launch: "Be the First to Own It" or "Shop Now"
- promotional: "Grab This Deal" or "Shop the Sale"
- price_drop: "Get It Now" or "Claim Discount"

OUTPUT FORMAT:
Return ONLY the complete AMP HTML template. No explanations, no markdown code blocks, just the HTML.

Begin with <!doctype html> and end with </html>

Generate the template now:`;

    return prompt;
  }

  /**
   * Clean and validate generated template
   */
  private cleanTemplate(template: string): string {
    // Remove markdown code blocks if present
    template = template.replace(/```html\n?/g, '').replace(/```\n?/g, '');

    // Ensure it starts with <!doctype html>
    if (!template.trim().toLowerCase().startsWith('<!doctype')) {
      template = `<!doctype html>\n${template}`;
    }

    // Ensure amp4email attribute exists
    if (!template.includes('⚡4email') && !template.includes('amp4email')) {
      template = template.replace(/<html/i, '<html ⚡4email');
    }

    return template.trim();
  }

  /**
   * Fallback template generation (if DeepSeek R1 fails)
   */
  private generateFallbackTemplate(options: DeepSeekTemplateOptions): string {
    const { products, campaignContext, userContext } = options;
    const product = products[0];
    const firstName = userContext?.firstName ? '{{firstName}}' : 'there';

    const showPrice = product.price && Number(product.price) > 0;

    return `<!doctype html>
<html ⚡4email>
<head>
  <meta charset="utf-8">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <style amp4email-boilerplate>body{visibility:hidden}</style>
  <style amp-custom>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .hero-image { width: 100%; height: auto; display: block; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 28px; font-weight: 700; color: #1f2937; margin-bottom: 16px; }
    .product-name { font-size: 32px; font-weight: 800; color: #111827; margin-bottom: 20px; }
    .price { font-size: 36px; font-weight: 900; color: #667eea; margin-bottom: 24px; }
    .description { font-size: 16px; color: #4b5563; line-height: 1.8; margin-bottom: 32px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 48px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; }
    .footer { background: #f9fafb; padding: 32px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">✨ Special Offer for You</h1>
    </div>

    ${product.image ? `<amp-img src="${product.image}" width="600" height="600" layout="responsive" alt="${product.name}" class="hero-image"></amp-img>` : ''}

    <div class="content">
      <div class="greeting">Hi ${firstName}!</div>

      <h2 class="product-name">${product.name}</h2>

      ${showPrice ? `<div class="price">${product.currency || 'USD'} $${product.price}</div>` : ''}

      <p class="description">${product.description || 'Discover this exceptional product.'}</p>

      <a href="${product.url || '#'}" class="cta-button">
        ${campaignContext.type === 'abandoned_cart' ? 'Complete Your Purchase' : 'Shop Now'}
      </a>
    </div>

    <div class="footer">
      <p>Sent to {{email}}</p>
      <p style="margin-top: 8px;">Questions? Reply to this email</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.replicate;
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      model: this.modelConfig.name,
      provider: this.modelConfig.provider,
      modelId: this.modelConfig.modelId,
      ragEnabled: this.modelConfig.ragEnabled,
      configured: this.isConfigured()
    };
  }
}

export default new DeepSeekTemplateGenerator();
