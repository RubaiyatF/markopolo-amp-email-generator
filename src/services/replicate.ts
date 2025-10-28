import Replicate from 'replicate';
import { Product, CampaignContext, UserContext } from '../schemas';

/**
 * Replicate AI Service
 * Handles AI-powered template generation using Replicate API
 * 
 * Note: Requires REPLICATE_API_KEY environment variable
 */

interface TemplateGenerationPrompt {
  products: Product[];
  campaignContext: CampaignContext;
  userContext?: UserContext;
  variation: number;
}

class ReplicateService {
  private client: Replicate | null = null;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  constructor() {
    if (this.isConfigured()) {
      this.initializeClient();
    }
  }

  private isConfigured(): boolean {
    return !!process.env.REPLICATE_API_KEY;
  }

  private initializeClient(): void {
    this.client = new Replicate({
      auth: process.env.REPLICATE_API_KEY!,
    });
  }

  /**
   * Generate AMP email template using AI
   */
  async generateTemplate(prompt: TemplateGenerationPrompt): Promise<string> {
    if (!this.isConfigured()) {
      console.warn('Replicate API not configured. Using mock generation.');
      return this.generateMockTemplate(prompt);
    }

    try {
      const input = this.buildPrompt(prompt);
      
      // Retry logic with exponential backoff
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          const output = await this.callReplicateAPI(input);
          return this.extractTemplateFromOutput(output);
        } catch (error) {
          lastError = error as Error;
          console.warn(`Replicate API attempt ${attempt} failed:`, error);
          
          if (attempt < this.MAX_RETRIES) {
            await this.sleep(this.RETRY_DELAY * attempt); // Exponential backoff
          }
        }
      }

      throw new Error(`Replicate API failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
    } catch (error) {
      console.error('Template generation failed:', error);
      throw error;
    }
  }

  /**
   * Call Replicate API with prompt
   */
  private async callReplicateAPI(input: string): Promise<any> {
    if (!this.client) {
      throw new Error('Replicate client not initialized');
    }

    // Use appropriate model for email template generation
    const model = process.env.REPLICATE_MODEL || 'meta/llama-2-70b-chat:latest';

    const output = await this.client.run(model as any, {
      input: {
        prompt: input,
        max_new_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.1,
      },
    });

    return output;
  }

  /**
   * Build prompt from campaign data
   */
  private buildPrompt(prompt: TemplateGenerationPrompt): string {
    const { products, campaignContext, userContext, variation } = prompt;

    const productDetails = products.map((p, idx) => 
      `Product ${idx + 1}: ${p.name || 'Unnamed'} - $${p.price} ${p.currency || 'USD'}\n` +
      `  Description: ${p.description || 'No description'}\n` +
      `  URL: ${p.url || 'N/A'}`
    ).join('\n');

    return `Generate an AMP-compliant email template (variation ${variation}) for a ${campaignContext.type} campaign.

Campaign Details:
- Type: ${campaignContext.type}
- Goal: ${campaignContext.goal}
- Urgency: ${campaignContext.urgency || 'medium'}
${campaignContext.discount ? `- Discount: ${campaignContext.discount}%` : ''}

Products:
${productDetails}

${userContext ? `Recipient Context:
- Name: ${userContext.firstName || ''} ${userContext.lastName || ''}
- Email: ${userContext.email || 'recipient@example.com'}
` : ''}

Requirements:
1. Use AMP email format with proper DOCTYPE and structure
2. Include merge tags for personalization: {{firstName}}, {{lastName}}, {{email}}
3. Create compelling subject line and preheader
4. Include clear call-to-action buttons
5. Ensure mobile-responsive design
6. Follow AMP email best practices

Generate ONLY the AMP HTML template code, no explanations.`;
  }

  /**
   * Extract template from API output
   */
  private extractTemplateFromOutput(output: any): string {
    if (typeof output === 'string') {
      return output;
    }

    if (Array.isArray(output)) {
      return output.join('');
    }

    if (output.output) {
      return this.extractTemplateFromOutput(output.output);
    }

    throw new Error('Unable to extract template from Replicate output');
  }

  /**
   * Generate mock template (for development/testing)
   */
  private generateMockTemplate(prompt: TemplateGenerationPrompt): string {
    const { products, campaignContext, variation } = prompt;
    const product = products[0];

    return `<!doctype html>
<html amp4email>
<head>
  <meta charset="utf-8">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <style amp4email-boilerplate>body{visibility:hidden}</style>
  <style amp-custom>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #4285f4; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; }
    .product { border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .product img { max-width: 100%; height: auto; border-radius: 4px; }
    .cta-button { display: inline-block; background-color: #4285f4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Special Offer Just for You, {{firstName}}!</h1>
    </div>
    
    <div class="content">
      <p>Hi {{firstName}},</p>
      
      <p>We noticed you were interested in ${product.name || 'this amazing product'}. 
      ${campaignContext.type === 'abandoned_cart' ? "You left it in your cart - don't miss out!" : 
        campaignContext.type === 'price_drop' ? "Great news! The price just dropped!" :
        "We think you'll love this!"}</p>
      
      <div class="product">
        ${product.images?.[0] ? `<amp-img src="${product.images[0]}" width="400" height="300" layout="responsive"></amp-img>` : ''}
        <h2>${product.name || 'Premium Product'}</h2>
        <p>${product.description || 'An amazing product you\'ll love!'}</p>
        <p style="font-size: 24px; font-weight: bold; color: #4285f4;">
          $${product.price || '99.99'} ${product.currency || 'USD'}
          ${campaignContext.discount ? `<span style="font-size: 16px; color: #e91e63;">(${campaignContext.discount}% OFF!)</span>` : ''}
        </p>
        <a href="${product.url || '#'}" class="cta-button">
          ${campaignContext.type === 'abandoned_cart' ? 'Complete Your Purchase' :
            campaignContext.type === 'product_launch' ? 'Be the First to Own It' :
            campaignContext.type === 'price_drop' ? 'Get It Now' :
            'Shop Now'}
        </a>
      </div>
      
      ${campaignContext.urgency === 'high' ? '<p style="color: #e91e63; font-weight: bold;">⏰ Limited time offer - Act fast!</p>' : ''}
      
      <p>Best regards,<br>The Team</p>
    </div>
    
    <div class="footer">
      <p>This email was sent to {{email}}</p>
      <p><a href="#">Unsubscribe</a> | <a href="#">Preferences</a></p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.isConfigured() && this.client !== null;
  }

  /**
   * Validate AMP HTML output
   */
  async validateAMP(html: string): Promise<{ valid: boolean; errors: string[] }> {
    // Basic validation - in production, use AMP validator
    const errors: string[] = [];

    if (!html.includes('amp4email')) {
      errors.push('Missing amp4email attribute');
    }

    if (!html.includes('cdn.ampproject.org/v0.js')) {
      errors.push('Missing AMP runtime script');
    }

    if (!html.includes('amp-custom')) {
      errors.push('Missing amp-custom style tag');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default new ReplicateService();
