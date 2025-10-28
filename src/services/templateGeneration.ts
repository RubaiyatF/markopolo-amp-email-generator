import { Product, CampaignContext, UserContext, GenerationOptions } from '../schemas';
import imageProcessingService, { ProcessedImage } from './imageProcessing';
import mediaGenerationService, { MediaAsset } from './mediaGeneration';
import replicateMediaService, { EnhancedImage } from './replicateMedia';
import { getDesignByIndex } from './templateDesigns';
import templateLibrary from './templateLibrary';
import ragTemplateGenerator from './ragTemplateGenerator';
import deepseekTemplateGenerator from './deepseekTemplateGenerator';

export interface Template {
  id: string;
  variation_name: string;
  content: {
    subject: string;
    body: string;
    preheader: string;
  };
  amp_features: string[];
  merge_tags: string[];
  processed_images?: ProcessedImage[];
  media_assets?: MediaAsset[];
  enhanced_media?: EnhancedImage[];
}

export class TemplateGenerationService {
  /**
   * Generate AMP email templates with image processing and design variations
   * Now with RAG-powered template inspiration from Flodesk library
   */
  async generateTemplates(
    products: Product[],
    campaignContext: CampaignContext,
    userContext?: UserContext,
    options?: Partial<GenerationOptions>
  ): Promise<Template[]> {
    const variations = options?.variations || 3;
    const templates: Template[] = [];

    console.log(`🎨 Generating ${variations} template variations with image processing...`);

    // Step 1: Find similar templates from Flodesk library (RAG)
    let inspirationTemplates: any[] = [];
    try {
      console.log(`🔍 Searching for inspiration templates for campaign: ${campaignContext.type}`);
      inspirationTemplates = await templateLibrary.findSimilarTemplates(campaignContext, 3);

      if (inspirationTemplates.length > 0) {
        console.log(`✅ Found ${inspirationTemplates.length} inspiration templates:`);
        inspirationTemplates.forEach((t, idx) => {
          console.log(`   ${idx + 1}. ${t.filename} (score: ${t.score.toFixed(3)})`);
          if (t.design_analysis) {
            console.log(`      Layout: ${t.design_analysis.layout_type}, Tone: ${t.design_analysis.tone}`);
          }
        });
      } else {
        console.log('   No indexed templates found - using default designs');
      }
    } catch (error: any) {
      console.warn(`⚠️  Could not fetch inspiration templates: ${error.message}`);
      console.log('   Falling back to default designs');
    }

    // Step 2: Process all product images
    const processedImages = await this.processProductImages(products);

    // Step 3: Generate AI-enhanced media using Replicate (upscale, GIF, video)
    const enhancedMedia = await this.generateEnhancedMedia(products, processedImages, options);

    // Step 4: Generate media assets (badges, overlays, etc.)
    const mediaAssets = await this.generateMediaAssets(products, campaignContext);

    // Step 5: Generate templates using different designs (enhanced with RAG inspiration)
    for (let i = 0; i < variations; i++) {
      const template = await this.generateTemplateVariation(
        i,
        products,
        processedImages,
        mediaAssets,
        enhancedMedia,
        campaignContext,
        userContext,
        inspirationTemplates[i] // Pass inspiration template if available
      );

      templates.push(template);
    }

    console.log(`✅ Generated ${templates.length} templates with ${processedImages.length} processed images and ${enhancedMedia.length} enhanced media`);

    // Log Replicate usage and cost
    if (enhancedMedia.length > 0) {
      const totalReplicateCost = enhancedMedia.reduce((sum, m) => sum + m.cost_usd, 0);
      console.log(`💰 Replicate AI usage: ${enhancedMedia.length} media generated, cost: $${totalReplicateCost.toFixed(4)}`);
    }

    return templates;
  }

  /**
   * Process all product images
   */
  private async processProductImages(products: Product[]): Promise<ProcessedImage[]> {
    const processedImages: ProcessedImage[] = [];

    for (const product of products) {
      if (product.image) {
        try {
          console.log(`🖼️  Processing image for: ${product.name}`);
          const processed = await imageProcessingService.processImage(
            product.image,
            product.id || (product.name || 'product').toLowerCase().replace(/\s+/g, '-'),
            {
              maxWidth: 1200,
              maxHeight: 1200,
              quality: 85,
              generateThumbnail: true
            }
          );
          processedImages.push(processed);
        } catch (error: any) {
          console.error(`⚠️  Failed to process image for ${product.name}:`, error.message);
          // Fallback: Use original image
          processedImages.push({
            original_url: product.image,
            optimized_url: product.image,
            webp_url: product.image,
            thumbnail_url: product.image,
            width: 0,
            height: 0,
            format: 'unknown',
            size_bytes: 0
          });
        }
      }
    }

    return processedImages;
  }

  /**
   * Generate AI-enhanced media using Replicate API
   */
  private async generateEnhancedMedia(
    products: Product[],
    processedImages: ProcessedImage[],
    options?: Partial<GenerationOptions>
  ): Promise<EnhancedImage[]> {
    // Check if Replicate is configured
    if (!replicateMediaService.isConfigured()) {
      console.log('⚠️  Replicate API not configured - skipping AI media generation');
      return [];
    }

    const enhancedMedia: EnhancedImage[] = [];
    const enableMedia = options?.enable_media_generation !== false; // Default true

    if (!enableMedia) {
      console.log('ℹ️  Media generation disabled by options');
      return [];
    }

    try {
      // Only process first product's first image for now (to control costs)
      const firstImage = processedImages[0];
      if (!firstImage || !firstImage.optimized_url) {
        console.log('⚠️  No images available for AI enhancement');
        return [];
      }

      const productId = products[0]?.id || 'unknown';
      console.log(`🎨 Generating AI-enhanced media for product: ${productId}`);

      // Generate variations based on options
      const mediaOptions = {
        upscale: options?.upscale_images !== false,  // Default true
        enhance: options?.enhance_images === true,    // Default false
        gif: options?.generate_gif === true,          // Default false
        video: options?.generate_video === true       // Default false
      };

      // Estimate cost before generation
      const estimatedCost = replicateMediaService.estimateCost(mediaOptions);
      console.log(`💰 Estimated Replicate cost: $${estimatedCost.toFixed(4)}`);

      const generated = await replicateMediaService.generateMediaVariations(
        firstImage.optimized_url,
        productId,
        mediaOptions
      );

      enhancedMedia.push(...generated);

      return enhancedMedia;
    } catch (error: any) {
      console.error(`❌ Enhanced media generation failed:`, error.message);
      // Don't fail the entire template generation if media enhancement fails
      return [];
    }
  }

  /**
   * Generate media assets based on campaign context
   */
  private async generateMediaAssets(
    products: Product[],
    campaignContext: CampaignContext
  ): Promise<MediaAsset[]> {
    const mediaAssets: MediaAsset[] = [];
    const productId = products[0]?.id || 'product';

    try {
      // Create discount badge if applicable
      if (campaignContext.discount && campaignContext.discount > 0) {
        const discountBadge = await mediaGenerationService.createDiscountBadge(
          products[0].image || '',
          campaignContext.discount,
          productId
        );
        mediaAssets.push(discountBadge);
      }

      // Create urgency timer if high urgency
      if (campaignContext.urgency === 'high') {
        const urgencyTimer = await mediaGenerationService.createUrgencyTimer(
          24, // 24 hours remaining
          productId
        );
        mediaAssets.push(urgencyTimer);
      }

      // Create social proof badge for product launch
      if (campaignContext.type === 'product_launch') {
        const socialProof = await mediaGenerationService.createSocialProofBadge(
          5000,
          'pre-orders',
          productId
        );
        mediaAssets.push(socialProof);
      }
    } catch (error: any) {
      console.error(`⚠️  Failed to generate some media assets:`, error.message);
    }

    return mediaAssets;
  }

  /**
   * Generate a single template variation using a design system
   * Enhanced with RAG-powered inspiration from Flodesk templates
   */
  private async generateTemplateVariation(
    variationIndex: number,
    products: Product[],
    processedImages: ProcessedImage[],
    mediaAssets: MediaAsset[],
    enhancedMedia: EnhancedImage[],
    campaignContext: CampaignContext,
    userContext?: UserContext,
    inspirationTemplate?: any
  ): Promise<Template> {
    const variationName = String.fromCharCode(65 + variationIndex); // A, B, C...
    const design = getDesignByIndex(variationIndex);

    let inspirationNote = '';
    if (inspirationTemplate) {
      inspirationNote = ` (inspired by ${inspirationTemplate.filename})`;
      console.log(`🎨 Generating variation ${variationName} using "${design.name}" design${inspirationNote}`);

      // Apply design inspiration if available
      if (inspirationTemplate.design_analysis) {
        console.log(`   Applying inspiration: ${inspirationTemplate.design_analysis.layout_type} layout, ${inspirationTemplate.design_analysis.tone} tone`);
      }
    } else {
      console.log(`🎨 Generating variation ${variationName} using "${design.name}" design`);
    }

    // Generate HTML using the design system (potentially enhanced with DeepSeek R1 + RAG)
    const ampHtml = await this.applyInspirationToDesign(
      design,
      products,
      processedImages,
      campaignContext,
      variationIndex,
      userContext,
      inspirationTemplate
    );

    // Generate subject line variations
    const subject = this.generateSubjectLine(variationIndex, products[0], campaignContext, userContext);

    // Generate preheader
    const preheader = this.generatePreheader(variationIndex, products[0], campaignContext);

    const features = [
      'amp4email',
      'amp-img',
      'responsive-layout',
      design.name.toLowerCase().replace(/\s+/g, '-')
    ];

    // Add inspiration tag if used
    if (inspirationTemplate) {
      features.push('rag-inspired');
    }

    return {
      id: `tmpl_${Date.now()}_${variationIndex}`,
      variation_name: variationName,
      content: {
        subject,
        body: ampHtml,
        preheader
      },
      amp_features: features,
      merge_tags: this.detectMergeTags(ampHtml),
      processed_images: processedImages,
      media_assets: mediaAssets,
      enhanced_media: enhancedMedia
    };
  }

  /**
   * Apply inspiration from Flodesk templates to enhance the design
   * Now uses DeepSeek R1 with Qdrant RAG for intelligent template generation
   */
  private async applyInspirationToDesign(
    design: any,
    products: Product[],
    processedImages: ProcessedImage[],
    campaignContext: CampaignContext,
    variationIndex: number,
    userContext?: UserContext,
    inspirationTemplate?: any
  ): Promise<string> {
    // Check if DeepSeek R1 is configured
    const useDeepSeek = deepseekTemplateGenerator.isConfigured();

    if (useDeepSeek) {
      console.log(`   🧠 Using DeepSeek R1 with Qdrant RAG for template generation`);

      try {
        const template = await deepseekTemplateGenerator.generateTemplate({
          products,
          campaignContext,
          userContext,
          variationIndex,
          ragContext: inspirationTemplate
        });

        return template;
      } catch (error: any) {
        console.error(`   ❌ DeepSeek R1 generation failed: ${error.message}`);
        console.log(`   ⚠️  Falling back to RAG template generator`);
      }
    }

    // Fallback 1: Use RAG generator if we have inspiration template
    if (inspirationTemplate?.design_analysis) {
      console.log(`   🎨 Using RAG template generator with inspiration from ${inspirationTemplate.filename}`);

      return ragTemplateGenerator.generate(
        products,
        processedImages,
        campaignContext,
        userContext,
        inspirationTemplate
      );
    }

    // Fallback 2: Generate base HTML from existing design system
    console.log(`   ⚠️  No RAG inspiration available, using default design: ${design.name}`);
    return design.generate(products, processedImages, campaignContext, userContext);
  }

  /**
   * Generate subject line variations
   */
  private generateSubjectLine(
    variation: number,
    product: Product,
    campaignContext: CampaignContext,
    userContext?: UserContext
  ): string {
    const firstName = userContext?.firstName ? `{{firstName}}` : 'there';
    const productName = product.name || 'this product';

    const subjects = [
      // Variation A: Personal and friendly
      `${firstName}, check out ${productName}`,

      // Variation B: Promotional with emoji
      `🔥 Special offer: ${productName} at $${product.price}`,

      // Variation C: Urgency-driven
      `⏰ Limited time: ${productName} - Don't miss out!`
    ];

    // Customize based on campaign type
    if (campaignContext.type === 'abandoned_cart') {
      return variation === 0
        ? `${firstName}, you left something behind...`
        : variation === 1
        ? `🛒 Your cart is waiting! ${productName} still available`
        : `⏰ Last chance: Complete your order for ${productName}`;
    }

    if (campaignContext.type === 'price_drop') {
      return variation === 0
        ? `${firstName}, great news! ${productName} price dropped`
        : variation === 1
        ? `💰 Price Alert: ${productName} now $${product.price}`
        : `🔥 Flash Sale: ${productName} - Lowest price ever!`;
    }

    if (campaignContext.type === 'product_launch') {
      return variation === 0
        ? `${firstName}, introducing ${productName}`
        : variation === 1
        ? `🆕 Just launched: ${productName} is here!`
        : `✨ Be the first to own ${productName}`;
    }

    return subjects[variation % subjects.length];
  }

  /**
   * Generate preheader text
   */
  private generatePreheader(
    variation: number,
    product: Product,
    campaignContext: CampaignContext
  ): string {
    if (campaignContext.type === 'abandoned_cart') {
      return variation === 0
        ? `${product.name} is still in your cart - complete your purchase today`
        : variation === 1
        ? `Don't miss out on ${product.name} - it's waiting for you!`
        : `Last chance to get ${product.name} before it sells out`;
    }

    if (campaignContext.discount) {
      return `Save ${campaignContext.discount}% on ${product.name} - Limited time offer`;
    }

    return `${product.name} is waiting for you - Shop now and enjoy!`;
  }

  /**
   * Build AI prompt for template generation (for future Replicate API integration)
   */
  private buildPrompt(
    products: Product[],
    _context: CampaignContext,
    user?: UserContext,
    variation: number = 0
  ): string {
    const toneMap = [
      'Conservative, professional tone',
      'Energetic, promotional tone',
      'Urgency-driven, scarcity messaging'
    ];

    return `
Generate an AMP email template for a ${_context.type} campaign with ${_context.goal} goal.

Products:
${products.map(p => `- ${p.name}: $${p.price} - ${p.description?.substring(0, 100)}`).join('\n')}

Requirements:
- Valid AMP HTML email format
- Mobile-optimized responsive design
- Prominent call-to-action button
- ${toneMap[variation] || 'Professional tone'}
${user ? `- Include personalization with {{firstName}} and {{email}} merge tags` : ''}
- Subject line and preheader text

Generate the complete AMP HTML email.
    `.trim();
  }

  /**
   * Generate mock template (placeholder for Replicate API)
   */
  private generateMockTemplate(
    variation: number,
    products: Product[],
    _context: CampaignContext,
    user?: UserContext
  ): Template {
    const variationName = String.fromCharCode(65 + variation); // A, B, C...
    const productName = products[0]?.name || 'Product';
    const price = products[0]?.price || '0';

    const firstName = user?.firstName ? `{{firstName}}` : 'there';
    
    const ampHtml = `
<!doctype html>
<html ⚡4email>
<head>
  <meta charset="utf-8">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <style amp4email-boilerplate>body{visibility:hidden}</style>
  <style amp-custom>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .header { text-align: center; padding: 20px; }
    .product { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .cta-button { background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
    .price { font-size: 24px; color: #28a745; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Hi ${firstName}!</h1>
    <p>We have something special for you</p>
  </div>
  
  <div class="product">
    <h2>${productName}</h2>
    <p class="price">$${price}</p>
    <p>${products[0]?.description?.substring(0, 150) || 'Check out this amazing product!'}</p>
    <a href="${products[0]?.url || '#'}" class="cta-button">Shop Now</a>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #666;">
    <p>Questions? Reply to this email at {{email}}</p>
  </div>
</body>
</html>
    `.trim();

    const subject = variation === 0 
      ? `${firstName}, check out ${productName}`
      : variation === 1
      ? `🔥 Special offer: ${productName} at $${price}`
      : `⏰ Limited time: ${productName} - Don't miss out!`;

    return {
      id: `tmpl_${Date.now()}_${variation}`,
      variation_name: variationName,
      content: {
        subject,
        body: ampHtml,
        preheader: `${productName} is waiting for you`
      },
      amp_features: ['amp4email', 'responsive-layout'],
      merge_tags: this.detectMergeTags(ampHtml)
    };
  }

  /**
   * Detect merge tags in content
   */
  detectMergeTags(content: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [...content.matchAll(regex)];
    return [...new Set(matches.map(m => m[1].trim()))];
  }

  /**
   * Validate AMP HTML compliance (placeholder)
   */
  async validateAMPCompliance(html: string): Promise<boolean> {
    // In production, use amphtml-validator library
    return html.includes('⚡4email') || html.includes('amp4email');
  }

  /**
   * Generate fallback HTML from AMP HTML
   */
  generateFallback(ampHtml: string): string {
    return ampHtml
      .replace(/⚡4email/g, '')
      .replace(/<amp-/g, '<div data-amp-fallback ')
      .replace(/<\/amp-/g, '</div');
  }

  /**
   * Preserve merge tags during generation
   */
  preserveMergeTags(content: string, userContext?: UserContext): string {
    if (!userContext) return content;

    // Ensure merge tags are not altered
    if (userContext.firstName && !content.includes('{{firstName}}')) {
      content = content.replace(/Dear (customer|subscriber|friend)/i, 'Dear {{firstName}}');
    }

    if (userContext.email && !content.includes('{{email}}')) {
      content = content.replace(/contact us/i, 'contact us at {{email}}');
    }

    return content;
  }
}

export default new TemplateGenerationService();
