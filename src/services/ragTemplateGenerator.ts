import { Product, CampaignContext, UserContext } from '../schemas';
import { ProcessedImage } from './imageProcessing';
import { DesignAnalysis } from './visionAnalysis';

/**
 * RAG-Powered Template Generator
 * Creates unique templates based on Flodesk template inspiration
 */

export class RAGTemplateGenerator {
  /**
   * Generate a template using RAG inspiration
   */
  generate(
    products: Product[],
    processedImages: ProcessedImage[],
    campaignContext: CampaignContext,
    userContext: UserContext | undefined,
    inspirationTemplate: {
      filename: string;
      design_analysis: DesignAnalysis;
    }
  ): string {
    const product = products[0];
    const image = processedImages[0];
    const firstName = userContext?.firstName ? `{{firstName}}` : 'there';
    const analysis = inspirationTemplate.design_analysis;

    // Extract design parameters from RAG template
    const colors = analysis.colors || ['#2563eb', '#1e40af', '#f59e0b', '#ffffff', '#1f2937'];
    const layoutType = analysis.layout_type || 'single-column';
    const typography = analysis.typography || 'modern-sans-serif';
    const tone = analysis.tone || 'professional';

    // Build dynamic CSS based on inspiration
    const primaryColor = colors[0] || '#2563eb';
    const secondaryColor = colors[1] || '#1e40af';
    const accentColor = colors[2] || '#f59e0b';
    const bgColor = colors[3] || '#ffffff';
    const textColor = colors[4] || '#000000';

    // Choose font based on typography style
    const fontFamily = this.getFontFamily(typography);

    // Build layout based on layout type
    const layoutStyles = this.getLayoutStyles(layoutType);

    // Build tone-based messaging
    const greeting = this.getGreeting(tone, firstName);
    const ctaText = this.getCTAText(tone, campaignContext);

    // Generate the AMP HTML template
    return `<!-- Inspired by ${inspirationTemplate.filename}
  Color Palette: ${colors.join(', ')}
  Layout: ${layoutType}
  Typography: ${typography}
  Tone: ${tone}
-->
<!doctype html>
<html ⚡4email>
<head>
  <meta charset="utf-8">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <style amp4email-boilerplate>body{visibility:hidden}</style>
  <style amp-custom>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${fontFamily};
      background-color: ${bgColor};
      color: ${textColor};
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${bgColor};
      ${layoutStyles.container}
    }
    .hero-section {
      position: relative;
      overflow: hidden;
      ${layoutStyles.hero}
    }
    .hero-image {
      width: 100%;
      height: auto;
      display: block;
      ${layoutStyles.image}
    }
    .content {
      padding: ${layoutType === 'minimal-centered' ? '60px 40px' : '40px 30px'};
      ${layoutStyles.content}
    }
    .greeting {
      font-size: ${layoutType === 'bold-header' ? '36px' : '28px'};
      font-weight: ${tone === 'elegant' ? '300' : '700'};
      color: ${primaryColor};
      margin-bottom: 16px;
      ${tone === 'elegant' ? 'letter-spacing: 1px;' : ''}
    }
    .subheading {
      font-size: 16px;
      color: ${textColor};
      opacity: 0.7;
      margin-bottom: 32px;
      line-height: 1.6;
    }
    .product-name {
      font-size: ${layoutType === 'large-product' ? '36px' : '28px'};
      font-weight: ${tone === 'bold' ? '900' : '600'};
      color: ${textColor};
      margin-bottom: 16px;
      ${tone === 'elegant' ? 'text-transform: uppercase; letter-spacing: 2px;' : ''}
    }
    .price {
      font-size: ${tone === 'bold' ? '48px' : '32px'};
      font-weight: ${tone === 'bold' ? '900' : '600'};
      color: ${accentColor};
      margin-bottom: 24px;
    }
    .description {
      font-size: 16px;
      color: ${textColor};
      opacity: 0.8;
      line-height: 1.8;
      margin-bottom: 32px;
      ${layoutType === 'minimal-centered' ? 'text-align: center; max-width: 400px; margin-left: auto; margin-right: auto;' : ''}
    }
    .cta-button {
      display: inline-block;
      background: ${primaryColor};
      color: ${bgColor === '#ffffff' || bgColor === '#FFFFFF' ? '#ffffff' : textColor};
      padding: ${tone === 'elegant' ? '16px 48px' : '18px 48px'};
      text-decoration: none;
      border-radius: ${tone === 'elegant' ? '0' : '12px'};
      font-weight: ${tone === 'bold' ? '800' : '600'};
      font-size: 16px;
      ${tone === 'elegant' ? 'letter-spacing: 2px; text-transform: uppercase; font-size: 12px;' : ''}
      ${tone === 'bold' ? 'box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3);' : ''}
    }
    .cta-container {
      ${layoutType === 'minimal-centered' ? 'text-align: center;' : ''}
      margin-bottom: 32px;
    }
    .footer {
      background: ${tone === 'elegant' ? bgColor : '#f9fafb'};
      padding: 32px;
      text-align: center;
      color: ${textColor};
      opacity: 0.6;
      font-size: ${tone === 'elegant' ? '11px' : '14px'};
      ${tone === 'elegant' ? 'border-top: 1px solid #e5e5e5; letter-spacing: 1px;' : ''}
    }
    ${layoutStyles.additional || ''}
  </style>
</head>
<body>
  <div class="container">
    <div class="hero-section">
      <amp-img src="${image?.webp_url || product.images?.[0] || ''}"
               width="600" height="600"
               layout="responsive"
               alt="${product.name}"
               class="hero-image">
      </amp-img>
    </div>

    <div class="content">
      <h1 class="greeting">${greeting}</h1>
      <p class="subheading">${this.getSubheading(tone, campaignContext)}</p>

      <h2 class="product-name">${product.name}</h2>

      ${product.price && Number(product.price) > 0 ? `
      <div class="price">
        ${product.currency || 'USD'} $${product.price}
      </div>
      ` : ''}

      <p class="description">${product.description || 'Discover this exceptional product.'}</p>

      <div class="cta-container">
        <a href="${product.url || '#'}" class="cta-button">
          ${ctaText}
        </a>
      </div>
    </div>

    <div class="footer">
      <p>${this.getFooterText(tone)}</p>
      <p style="margin-top: 8px;">{{email}}</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Get font family based on typography style
   */
  private getFontFamily(typography: string): string {
    const fontMap: { [key: string]: string } = {
      'modern-sans-serif': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      'classic-serif': 'Georgia, "Times New Roman", serif',
      'elegant-serif': '"Playfair Display", Georgia, serif',
      'bold-sans': '"Arial Black", "Helvetica Bold", sans-serif',
      'minimal': 'Helvetica, Arial, sans-serif'
    };

    return fontMap[typography] || fontMap['modern-sans-serif'];
  }

  /**
   * Get layout styles based on layout type
   */
  private getLayoutStyles(layoutType: string): {
    container: string;
    hero: string;
    image: string;
    content: string;
    additional?: string;
  } {
    const layouts: { [key: string]: any } = {
      'single-column': {
        container: '',
        hero: '',
        image: '',
        content: ''
      },
      'minimal-centered': {
        container: 'padding: 40px 20px;',
        hero: 'text-align: center;',
        image: 'max-width: 400px; margin: 0 auto;',
        content: 'text-align: center;'
      },
      'bold-header': {
        container: '',
        hero: 'border-bottom: 4px solid currentColor;',
        image: '',
        content: ''
      },
      'large-product': {
        container: '',
        hero: 'margin-bottom: 40px;',
        image: '',
        content: ''
      }
    };

    return layouts[layoutType] || layouts['single-column'];
  }

  /**
   * Get greeting based on tone
   */
  private getGreeting(tone: string, firstName: string): string {
    const greetings: { [key: string]: string } = {
      'professional': `Hello ${firstName}`,
      'friendly': `Hey ${firstName}! 👋`,
      'bold': `HEY ${firstName.toUpperCase()}!`,
      'elegant': `Dear ${firstName}`,
      'playful': `Hi there ${firstName}! ✨`
    };

    return greetings[tone] || greetings['friendly'];
  }

  /**
   * Get subheading based on tone
   */
  private getSubheading(tone: string, campaignContext: CampaignContext): string {
    const subheadings: { [key: string]: { [key: string]: string } } = {
      'abandoned_cart': {
        'professional': 'You left items in your cart',
        'friendly': "Don't forget about these items!",
        'bold': "YOUR CART IS WAITING! 🛒",
        'elegant': 'Your carefully selected items await',
        'playful': 'Psst... you forgot something! 🙈'
      },
      'product_launch': {
        'professional': 'Introducing our latest product',
        'friendly': "We've got something special for you",
        'bold': 'NEW ARRIVAL ALERT! 🚨',
        'elegant': 'Discover our newest addition',
        'playful': 'Fresh off the press! Check this out 🎉'
      },
      'promotional': {
        'professional': 'Special offer for you',
        'friendly': "Here's a deal you'll love",
        'bold': 'MEGA SALE! DONT MISS OUT! 🔥',
        'elegant': 'An exclusive offer awaits',
        'playful': 'Treat yourself! You deserve it 🎁'
      }
    };

    const campaignType = campaignContext.type || 'promotional';
    return subheadings[campaignType]?.[tone] || "We think you'll love this";
  }

  /**
   * Get CTA text based on tone and campaign
   */
  private getCTAText(tone: string, campaignContext: CampaignContext): string {
    if (campaignContext.type === 'abandoned_cart') {
      return tone === 'bold' ? 'GRAB IT NOW!' : tone === 'elegant' ? 'Complete Purchase' : 'Return to Cart';
    }

    const ctas: { [key: string]: string } = {
      'professional': 'Shop Now',
      'friendly': 'Check It Out',
      'bold': 'GET IT NOW!',
      'elegant': 'Discover More',
      'playful': "Let's Go! ✨"
    };

    return ctas[tone] || 'Shop Now';
  }

  /**
   * Get footer text based on tone
   */
  private getFooterText(tone: string): string {
    const footers: { [key: string]: string } = {
      'professional': 'Thank you for your interest',
      'friendly': "Questions? We're here to help!",
      'bold': "NEED HELP? WE'RE HERE 24/7!",
      'elegant': 'Complimentary Shipping & Returns',
      'playful': 'Made with love just for you'
    };

    return footers[tone] || 'Questions? Reply to this email';
  }
}

export default new RAGTemplateGenerator();
