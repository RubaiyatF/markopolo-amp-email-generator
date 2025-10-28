import { Product, CampaignContext, UserContext } from '../schemas';
import { ProcessedImage } from './imageProcessing';

/**
 * Template Design System
 * Multiple unique email template layouts for A/B/C testing
 */

export interface TemplateDesign {
  name: string;
  description: string;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  generate: (
    products: Product[],
    processedImages: ProcessedImage[],
    campaignContext: CampaignContext,
    userContext?: UserContext
  ) => string;
}

/**
 * Design 1: Hero Image Layout
 * Large product image at top, bold CTA, clean design
 */
export const heroImageDesign: TemplateDesign = {
  name: 'Hero Image',
  description: 'Large hero image with bold typography and prominent CTA',
  colorScheme: {
    primary: '#2563eb',
    secondary: '#1e40af',
    accent: '#f59e0b',
    background: '#ffffff',
    text: '#1f2937'
  },
  generate: (products, processedImages, campaignContext, userContext) => {
    const product = products[0];
    const image = processedImages[0];
    const firstName = userContext?.firstName ? `{{firstName}}` : 'there';

    const urgencyBadge = campaignContext.urgency === 'high'
      ? '<div style="background: #ef4444; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 20px; font-weight: bold;">⏰ Limited Time Offer!</div>'
      : '';

    const discountBadge = campaignContext.discount
      ? `<div style="position: absolute; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 18px;">-${campaignContext.discount}% OFF</div>`
      : '';

    return `<!doctype html>
<html ⚡4email>
<head>
  <meta charset="utf-8">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <style amp4email-boilerplate>body{visibility:hidden}</style>
  <style amp-custom>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .hero-section { position: relative; overflow: hidden; }
    .hero-image { width: 100%; height: auto; display: block; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 28px; font-weight: 700; color: #1f2937; margin-bottom: 12px; }
    .subheading { font-size: 16px; color: #6b7280; margin-bottom: 32px; line-height: 1.6; }
    .product-name { font-size: 32px; font-weight: 800; color: #111827; margin-bottom: 16px; letter-spacing: -0.5px; }
    .price { font-size: 42px; font-weight: 900; color: #2563eb; margin-bottom: 20px; }
    .old-price { font-size: 24px; color: #9ca3af; text-decoration: line-through; margin-left: 12px; }
    .description { font-size: 16px; color: #4b5563; line-height: 1.8; margin-bottom: 32px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 18px 48px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3); transition: transform 0.2s; }
    .cta-button:hover { transform: translateY(-2px); }
    .features { background: #f3f4f6; padding: 24px; border-radius: 12px; margin: 32px 0; }
    .feature-item { display: flex; align-items: start; margin-bottom: 12px; }
    .feature-icon { color: #10b981; margin-right: 12px; font-size: 20px; }
    .footer { background: #f9fafb; padding: 32px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero-section">
      ${discountBadge}
      <amp-img src="${image?.webp_url || product.images?.[0] || ''}"
               width="600" height="600"
               layout="responsive"
               alt="${product.name}">
      </amp-img>
    </div>

    <div class="content">
      ${urgencyBadge}

      <h1 class="greeting">Hi ${firstName}! 👋</h1>
      <p class="subheading">We noticed you were interested in this amazing product</p>

      <h2 class="product-name">${product.name}</h2>

      ${product.price && Number(product.price) > 0 ? `
      <div>
        <span class="price">$${product.price}</span>
        ${campaignContext.discount ? `<span class="old-price">$${(Number(product.price) * (1 + campaignContext.discount / 100)).toFixed(2)}</span>` : ''}
      </div>
      ` : ''}

      <p class="description">${product.description || 'Discover this exceptional product that we think you\'ll love!'}</p>

      <a href="${product.url || '#'}" class="cta-button">
        ${campaignContext.type === 'abandoned_cart' ? 'Complete Your Purchase' : 'Shop Now'}
      </a>

      <div class="features">
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span>Free shipping on orders over $50</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span>30-day money-back guarantee</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span>Premium quality materials</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>This email was sent to {{email}}</p>
      <p style="margin-top: 8px;">Questions? We're here to help!</p>
    </div>
  </div>
</body>
</html>`;
  }
};

/**
 * Design 2: Minimal Clean Layout
 * Minimalist design with lots of whitespace, elegant typography
 */
export const minimalDesign: TemplateDesign = {
  name: 'Minimal Clean',
  description: 'Minimalist design with elegant typography and clean layout',
  colorScheme: {
    primary: '#000000',
    secondary: '#333333',
    accent: '#666666',
    background: '#ffffff',
    text: '#000000'
  },
  generate: (products, processedImages, campaignContext, userContext) => {
    const product = products[0];
    const image = processedImages[0];
    const firstName = userContext?.firstName ? `{{firstName}}` : 'there';

    return `<!doctype html>
<html ⚡4email>
<head>
  <meta charset="utf-8">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <style amp4email-boilerplate>body{visibility:hidden}</style>
  <style amp-custom>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #ffffff; color: #000000; }
    .container { max-width: 540px; margin: 0 auto; padding: 60px 40px; }
    .logo-area { text-align: center; margin-bottom: 60px; border-bottom: 1px solid #e5e5e5; padding-bottom: 40px; }
    .brand { font-size: 14px; font-weight: 400; letter-spacing: 3px; text-transform: uppercase; }
    .product-image { text-align: center; margin-bottom: 48px; }
    .product-name { font-size: 28px; font-weight: 300; text-align: center; margin-bottom: 16px; letter-spacing: 1px; }
    .price { font-size: 20px; font-weight: 400; text-align: center; margin-bottom: 32px; }
    .description { font-size: 15px; line-height: 1.8; text-align: center; color: #666666; margin-bottom: 48px; max-width: 400px; margin-left: auto; margin-right: auto; }
    .cta-button { display: inline-block; background: #000000; color: #ffffff; padding: 16px 64px; text-decoration: none; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; border-radius: 0; }
    .cta-container { text-align: center; margin-bottom: 60px; }
    .footer { text-align: center; padding-top: 40px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999999; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-area">
      <div class="brand">${product.brand || 'Premium Collection'}</div>
    </div>

    <div class="product-image">
      <amp-img src="${image?.webp_url || product.images?.[0] || ''}"
               width="400" height="400"
               layout="intrinsic"
               alt="${product.name}">
      </amp-img>
    </div>

    <h1 class="product-name">${product.name}</h1>

    ${product.price && Number(product.price) > 0 ? `
    <div class="price">${product.currency || 'USD'} $${product.price}</div>
    ` : ''}

    <p class="description">${product.description || 'Timeless design meets exceptional quality.'}</p>

    <div class="cta-container">
      <a href="${product.url || '#'}" class="cta-button">Shop Now</a>
    </div>

    <div class="footer">
      <p>COMPLIMENTARY SHIPPING & RETURNS</p>
      <p style="margin-top: 16px;">{{email}}</p>
    </div>
  </div>
</body>
</html>`;
  }
};

/**
 * Design 3: Bold & Vibrant Layout
 * High-energy design with vibrant colors and dynamic elements
 */
export const boldVibrantDesign: TemplateDesign = {
  name: 'Bold & Vibrant',
  description: 'High-energy design with vibrant gradients and bold typography',
  colorScheme: {
    primary: '#ec4899',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
    background: '#1f2937',
    text: '#ffffff'
  },
  generate: (products, processedImages, campaignContext, userContext) => {
    const product = products[0];
    const image = processedImages[0];
    const firstName = userContext?.firstName ? `{{firstName}}` : 'Friend';

    const discountText = campaignContext.discount
      ? `<div class="discount-banner">SAVE ${campaignContext.discount}% TODAY ONLY! 🔥</div>`
      : '';

    return `<!doctype html>
<html ⚡4email>
<head>
  <meta charset="utf-8">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <style amp4email-boilerplate>body{visibility:hidden}</style>
  <style amp-custom>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1f2937 0%, #111827 100%); }
    .container { max-width: 600px; margin: 0 auto; }
    .discount-banner { background: linear-gradient(90deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 16px; text-align: center; font-weight: 800; font-size: 16px; letter-spacing: 1px; }
    .header { padding: 40px 30px; text-align: center; }
    .headline { font-size: 48px; font-weight: 900; background: linear-gradient(135deg, #ec4899 0%, #f59e0b 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 16px; line-height: 1.2; }
    .subheadline { color: #d1d5db; font-size: 18px; font-weight: 300; }
    .product-showcase { background: #374151; border-radius: 24px; margin: 0 20px 32px; overflow: hidden; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); }
    .product-image-container { position: relative; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 4px; }
    .product-details { padding: 32px; }
    .product-name { font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 16px; }
    .price-tag { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ec4899 100%); color: #000000; font-size: 36px; font-weight: 900; padding: 12px 32px; border-radius: 12px; margin-bottom: 24px; }
    .description { color: #d1d5db; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 20px 60px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 15px 35px rgba(236, 72, 153, 0.4); }
    .cta-container { text-align: center; margin-bottom: 32px; }
    .trust-badges { display: flex; justify-content: space-around; padding: 24px; background: #1f2937; }
    .badge { text-align: center; color: #9ca3af; font-size: 12px; }
    .badge-icon { font-size: 24px; margin-bottom: 8px; }
    .footer { background: #111827; padding: 32px; text-align: center; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    ${discountText}

    <div class="header">
      <h1 class="headline">HEY ${firstName.toUpperCase()}!</h1>
      <p class="subheadline">Your cart is calling... 📞</p>
    </div>

    <div class="product-showcase">
      <div class="product-image-container">
        <amp-img src="${image?.webp_url || product.images?.[0] || ''}"
                 width="600" height="600"
                 layout="responsive"
                 alt="${product.name}">
        </amp-img>
      </div>

      <div class="product-details">
        <h2 class="product-name">${product.name}</h2>

        ${product.price && Number(product.price) > 0 ? `
        <div class="price-tag">$${product.price}</div>
        ` : ''}

        <p class="description">${product.description || 'Get it before it\'s gone! Limited stock available.'}</p>

        <div class="cta-container">
          <a href="${product.url || '#'}" class="cta-button">
            ${campaignContext.type === 'abandoned_cart' ? 'Grab It Now!' : 'Shop Now'}
          </a>
        </div>
      </div>
    </div>

    <div class="trust-badges">
      <div class="badge">
        <div class="badge-icon">🚚</div>
        <div>Free Shipping</div>
      </div>
      <div class="badge">
        <div class="badge-icon">🔒</div>
        <div>Secure Checkout</div>
      </div>
      <div class="badge">
        <div class="badge-icon">↩️</div>
        <div>Easy Returns</div>
      </div>
    </div>

    <div class="footer">
      <p>You're receiving this because you left items in your cart</p>
      <p style="margin-top: 12px;">{{email}}</p>
    </div>
  </div>
</body>
</html>`;
  }
};

/**
 * Get all available designs
 */
export const templateDesigns: TemplateDesign[] = [
  heroImageDesign,
  minimalDesign,
  boldVibrantDesign
];

/**
 * Get design by variation index
 */
export function getDesignByIndex(index: number): TemplateDesign {
  return templateDesigns[index % templateDesigns.length];
}

/**
 * Get design by name
 */
export function getDesignByName(name: string): TemplateDesign | undefined {
  return templateDesigns.find(d => d.name.toLowerCase() === name.toLowerCase());
}

export default {
  designs: templateDesigns,
  getByIndex: getDesignByIndex,
  getByName: getDesignByName
};
