/**
 * Cart Handoff Service
 * Manages cart selection encoding and URL generation for e-commerce handoff
 */

import { featureFlagService } from '../config/featureFlags';
import prisma from '../lib/prisma';

export interface CartSelections {
  productId: string;
  variantId?: string;
  color?: string;
  size?: string;
  quantity: number;
  customizations?: Record<string, any>;
  productUrl: string;
  storeDomain: string;
}

export interface CompactCartData {
  p: string;    // productId
  v?: string;   // variantId
  c?: string;   // color
  s?: string;   // size
  q: number;    // quantity
  cu?: Record<string, any>;  // customizations
  u: string;    // productUrl
  sd: string;   // storeDomain
}

export interface HandoffResult {
  landingPageUrl: string;
  encodedData?: string;
  shortCode?: string;
  sessionId?: string;
  method: 'inline' | 'shortener' | 'session';
}

export class CartHandoffService {
  /**
   * Generate handoff URL with cart selections
   */
  public async generateHandoffUrl(
    selections: CartSelections,
    companyId: string
  ): Promise<HandoffResult> {
    const config = featureFlagService.getCartHandoffConfig();
    const landingPageBaseUrl = process.env.LANDING_PAGE_BASE_URL || 'https://cart.amp-platform.com';

    // Convert to compact format
    const compactData = this.toCompactFormat(selections);

    // Serialize and encode
    const jsonString = JSON.stringify(compactData);
    const encodedData = this.encodeData(jsonString);

    // Check URL length
    const inlineUrl = `${landingPageBaseUrl}?data=${encodedData}`;
    
    if (inlineUrl.length <= config.maxUrlLength) {
      // Use inline encoding (preferred)
      return {
        landingPageUrl: inlineUrl,
        encodedData,
        method: 'inline',
      };
    }

    // URL too long - use URL shortener or session storage
    if (config.urlShortenerEnabled) {
      const shortCode = await this.createShortUrl(selections, companyId);
      return {
        landingPageUrl: `${landingPageBaseUrl}?s=${shortCode}`,
        shortCode,
        method: 'shortener',
      };
    } else {
      // Fallback to session storage
      const sessionId = await this.createSession(selections, companyId);
      return {
        landingPageUrl: `${landingPageBaseUrl}?sid=${sessionId}`,
        sessionId,
        method: 'session',
      };
    }
  }

  /**
   * Convert selections to compact format
   */
  private toCompactFormat(selections: CartSelections): CompactCartData {
    const compact: CompactCartData = {
      p: selections.productId,
      q: selections.quantity,
      u: selections.productUrl,
      sd: selections.storeDomain,
    };

    if (selections.variantId) compact.v = selections.variantId;
    if (selections.color) compact.c = selections.color;
    if (selections.size) compact.s = selections.size;
    if (selections.customizations) compact.cu = selections.customizations;

    return compact;
  }

  /**
   * Encode data to Base64
   */
  private encodeData(jsonString: string): string {
    // Use URL-safe Base64 encoding
    return Buffer.from(jsonString, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Decode data from Base64
   */
  public decodeData(encodedData: string): CompactCartData {
    // Restore Base64 padding
    const base64 = encodedData
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const paddingLength = (4 - (base64.length % 4)) % 4;
    const paddedBase64 = base64 + '='.repeat(paddingLength);

    const jsonString = Buffer.from(paddedBase64, 'base64').toString('utf-8');
    return JSON.parse(jsonString);
  }

  /**
   * Create short URL entry
   */
  private async createShortUrl(
    selections: CartSelections,
    companyId: string
  ): Promise<string> {
    const config = featureFlagService.getCartHandoffConfig();
    const shortCode = this.generateShortCode();
    
    // Calculate expiration (24 hours by default)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.urlShortenerTTLHours);

    await prisma.urlShortener.create({
      data: {
        shortCode,
        selections: selections as any,
        storeDomain: selections.storeDomain,
        companyId,
        expiresAt,
      },
    });

    return shortCode;
  }

  /**
   * Retrieve selections from short code
   */
  public async getSelectionsFromShortCode(shortCode: string): Promise<CartSelections | null> {
    const entry = await prisma.urlShortener.findUnique({
      where: { shortCode },
    });

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt < new Date()) {
      // Expired - delete and return null
      await prisma.urlShortener.delete({ where: { shortCode } });
      return null;
    }

    return entry.selections as CartSelections;
  }

  /**
   * Create session storage entry
   */
  private async createSession(
    selections: CartSelections,
    companyId: string
  ): Promise<string> {
    const config = featureFlagService.getCartHandoffConfig();
    const sessionId = this.generateSessionId();

    // Calculate expiration (1 hour by default)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.sessionStorageTTLHours);

    await prisma.cartSelection.create({
      data: {
        sessionId,
        productId: selections.productId,
        variantId: selections.variantId,
        color: selections.color,
        size: selections.size,
        quantity: selections.quantity,
        customizations: selections.customizations as any,
        productUrl: selections.productUrl,
        storeDomain: selections.storeDomain,
        companyId,
        expiresAt,
      },
    });

    return sessionId;
  }

  /**
   * Retrieve selections from session ID
   */
  public async getSelectionsFromSession(sessionId: string): Promise<CartSelections | null> {
    const entry = await prisma.cartSelection.findUnique({
      where: { sessionId },
    });

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt < new Date()) {
      // Expired - delete and return null
      await prisma.cartSelection.delete({ where: { sessionId } });
      return null;
    }

    return {
      productId: entry.productId,
      variantId: entry.variantId || undefined,
      color: entry.color || undefined,
      size: entry.size || undefined,
      quantity: entry.quantity,
      customizations: entry.customizations as Record<string, any> | undefined,
      productUrl: entry.productUrl,
      storeDomain: entry.storeDomain,
    };
  }

  /**
   * Generate random short code
   */
  private generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate random session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Cleanup expired entries (should be run periodically)
   */
  public async cleanupExpired(): Promise<{ deletedUrls: number; deletedSessions: number }> {
    const now = new Date();

    const [deletedUrls, deletedSessions] = await Promise.all([
      prisma.urlShortener.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.cartSelection.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);

    return {
      deletedUrls: deletedUrls.count,
      deletedSessions: deletedSessions.count,
    };
  }

  /**
   * Detect e-commerce platform from domain
   */
  public detectPlatform(domain: string): 'shopify' | 'woocommerce' | 'magento' | 'bigcommerce' | 'custom' {
    const normalizedDomain = domain.toLowerCase();

    if (normalizedDomain.includes('myshopify.com')) {
      return 'shopify';
    }
    if (normalizedDomain.includes('mybigcommerce.com')) {
      return 'bigcommerce';
    }
    // These require URL pattern analysis or meta tag detection
    // For now, default to custom
    return 'custom';
  }
}

export const cartHandoffService = new CartHandoffService();
export default cartHandoffService;
