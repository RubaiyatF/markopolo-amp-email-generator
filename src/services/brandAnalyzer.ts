/**
 * Brand Analyzer Service
 * Extracts brand visual identity from e-commerce domain
 * Analyzes colors, typography, tone, spacing, and logo
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { featureFlagService } from '../config/featureFlags';

export interface BrandGuidelines {
  domain: string;
  primaryColor: string;
  secondaryColors: string[];
  accentColor: string;
  fontFamily: {
    heading: string;
    body: string;
  };
  logoUrl: string | null;
  tone: 'formal' | 'casual' | 'playful' | 'professional' | 'luxury';
  spacing: 'compact' | 'comfortable' | 'spacious';
  confidence: number;
  analyzedPages: string[];
}

interface ColorFrequency {
  color: string;
  frequency: number;
  context: 'background' | 'text' | 'button' | 'accent' | 'general';
}

interface FontUsage {
  fontFamily: string;
  frequency: number;
  context: 'heading' | 'body' | 'ui';
}

export class BrandAnalyzerService {
  private readonly DEFAULT_PRIMARY_COLOR = '#1a73e8';
  private readonly DEFAULT_HEADING_FONT = 'Georgia, serif';
  private readonly DEFAULT_BODY_FONT = 'Arial, sans-serif';
  private readonly DEFAULT_TONE = 'professional';
  private readonly DEFAULT_SPACING = 'comfortable';

  /**
   * Analyze brand from domain
   */
  public async analyzeBrand(
    domain: string,
    depth: 'shallow' | 'standard' | 'deep' = 'standard'
  ): Promise<BrandGuidelines> {
    const config = featureFlagService.getBrandAnalysisConfig();
    const analysisDepth = depth || config.depth;

    // Normalize domain
    const normalizedDomain = this.normalizeDomain(domain);
    
    // Determine pages to analyze based on depth
    const pagesToAnalyze = this.getPagesToAnalyze(normalizedDomain, analysisDepth);

    // Fetch and parse pages
    const pageData = await this.fetchPages(pagesToAnalyze);

    // Extract visual identity
    const colors = this.extractColors(pageData);
    const fonts = this.extractFonts(pageData);
    const logo = this.extractLogo(pageData);
    const tone = this.analyzeTone(pageData);
    const spacing = this.analyzeSpacing(pageData);

    // Calculate confidence score
    const confidence = this.calculateConfidence(colors, fonts, pageData.length);

    return {
      domain: normalizedDomain,
      primaryColor: colors.primary,
      secondaryColors: colors.secondary,
      accentColor: colors.accent,
      fontFamily: {
        heading: fonts.heading,
        body: fonts.body,
      },
      logoUrl: logo,
      tone,
      spacing,
      confidence,
      analyzedPages: pagesToAnalyze,
    };
  }

  /**
   * Normalize domain to consistent format
   */
  private normalizeDomain(domain: string): string {
    // Remove protocol if present
    let normalized = domain.replace(/^https?:\/\//, '');
    // Remove www. if present
    normalized = normalized.replace(/^www\./, '');
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    return normalized;
  }

  /**
   * Determine pages to analyze based on depth
   */
  private getPagesToAnalyze(domain: string, depth: 'shallow' | 'standard' | 'deep'): string[] {
    const baseUrl = `https://${domain}`;
    
    switch (depth) {
      case 'shallow':
        return [baseUrl];
      
      case 'standard':
        return [
          baseUrl,
          `${baseUrl}/about`,
          `${baseUrl}/about-us`,
        ];
      
      case 'deep':
        return [
          baseUrl,
          `${baseUrl}/about`,
          `${baseUrl}/about-us`,
          `${baseUrl}/brand`,
          `${baseUrl}/our-story`,
          `${baseUrl}/products`,
          `${baseUrl}/shop`,
        ];
      
      default:
        return [baseUrl];
    }
  }

  /**
   * Fetch and parse pages
   */
  private async fetchPages(urls: string[]): Promise<Array<{ url: string; html: string; $ : cheerio.CheerioAPI }>> {
    const results: Array<{ url: string; html: string; $: cheerio.CheerioAPI }> = [];

    for (const url of urls) {
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AMPEmailBot/1.0; +https://amp-platform.com)',
          },
        });

        const html = response.data;
        const $ = cheerio.load(html);

        results.push({ url, html, $ });
      } catch (error) {
        // Page not found or error - continue with available pages
        console.warn(`Failed to fetch ${url}:`, error);
      }
    }

    // Must have at least homepage
    if (results.length === 0) {
      throw new Error('Failed to fetch any pages for brand analysis');
    }

    return results;
  }

  /**
   * Extract colors from pages
   */
  private extractColors(pageData: Array<{ url: string; html: string; $: cheerio.CheerioAPI }>): {
    primary: string;
    secondary: string[];
    accent: string;
  } {
    const colorFrequencies: Map<string, ColorFrequency> = new Map();

    for (const { $, html } of pageData) {
      // Extract colors from inline styles
      $('[style*="color"]').each((_, el) => {
        const style = $(el).attr('style') || '';
        const colors = this.extractColorsFromCSS(style);
        colors.forEach(color => {
          const context = this.determineColorContext($(el));
          this.incrementColorFrequency(colorFrequencies, color, context);
        });
      });

      // Extract colors from style tags
      $('style').each((_, el) => {
        const css = $(el).html() || '';
        const colors = this.extractColorsFromCSS(css);
        colors.forEach(color => {
          this.incrementColorFrequency(colorFrequencies, color, 'general');
        });
      });

      // Extract colors from link elements (external stylesheets) - analyze if loaded
      // For simplicity, we'll focus on inline and style tags
    }

    // Filter out common neutrals (black, white, grays)
    const filteredColors = Array.from(colorFrequencies.values())
      .filter(cf => !this.isNeutralColor(cf.color))
      .sort((a, b) => b.frequency - a.frequency);

    // Identify primary color (highest frequency)
    const primaryColor = filteredColors[0]?.color || this.DEFAULT_PRIMARY_COLOR;

    // Identify secondary colors (next 2-3 most frequent)
    const secondaryColors = filteredColors.slice(1, 4).map(cf => cf.color);

    // Identify accent color (from button/CTA context)
    const accentColorCandidate = Array.from(colorFrequencies.values())
      .filter(cf => cf.context === 'button' && !this.isNeutralColor(cf.color))
      .sort((a, b) => b.frequency - a.frequency)[0];
    
    const accentColor = accentColorCandidate?.color || primaryColor;

    return {
      primary: primaryColor,
      secondary: secondaryColors,
      accent: accentColor,
    };
  }

  /**
   * Extract colors from CSS text
   */
  private extractColorsFromCSS(css: string): string[] {
    const colors: string[] = [];
    
    // Match hex colors (#RGB, #RRGGBB)
    const hexMatches = css.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g);
    if (hexMatches) {
      colors.push(...hexMatches.map(c => this.normalizeHexColor(c)));
    }

    // Match rgb/rgba colors
    const rgbMatches = css.match(/rgba?\([^)]+\)/g);
    if (rgbMatches) {
      colors.push(...rgbMatches.map(c => this.rgbToHex(c)));
    }

    return colors;
  }

  /**
   * Normalize hex color to 6-digit format
   */
  private normalizeHexColor(hex: string): string {
    hex = hex.toUpperCase();
    if (hex.length === 4) {
      // Convert #RGB to #RRGGBB
      return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return hex;
  }

  /**
   * Convert RGB to hex
   */
  private rgbToHex(rgb: string): string {
    const matches = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!matches) return '#000000';

    const r = parseInt(matches[1]);
    const g = parseInt(matches[2]);
    const b = parseInt(matches[3]);

    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  }

  /**
   * Determine color context from element
   */
  private determineColorContext($el: cheerio.Cheerio<any>): ColorFrequency['context'] {
    const tagName = $el.prop('tagName')?.toLowerCase();
    const classes = $el.attr('class') || '';
    const id = $el.attr('id') || '';

    if (tagName === 'button' || classes.includes('btn') || classes.includes('button')) {
      return 'button';
    }
    if (tagName === 'a' || classes.includes('link')) {
      return 'accent';
    }
    if (classes.includes('bg-') || classes.includes('background')) {
      return 'background';
    }
    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'p' || tagName === 'span') {
      return 'text';
    }

    return 'general';
  }

  /**
   * Increment color frequency
   */
  private incrementColorFrequency(
    map: Map<string, ColorFrequency>,
    color: string,
    context: ColorFrequency['context']
  ): void {
    const existing = map.get(color);
    if (existing) {
      existing.frequency++;
      // Upgrade context if more specific
      if (context === 'button' || context === 'accent') {
        existing.context = context;
      }
    } else {
      map.set(color, { color, frequency: 1, context });
    }
  }

  /**
   * Check if color is neutral (black, white, gray)
   */
  private isNeutralColor(hex: string): boolean {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Pure black or white
    if ((r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255)) {
      return true;
    }

    // Grayscale (all components similar)
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (maxDiff < 30) {
      return true;
    }

    return false;
  }

  /**
   * Extract fonts from pages
   */
  private extractFonts(pageData: Array<{ url: string; html: string; $: cheerio.CheerioAPI }>): {
    heading: string;
    body: string;
  } {
    const fontUsages: Map<string, FontUsage> = new Map();

    for (const { $ } of pageData) {
      // Extract heading fonts (h1-h3)
      $('h1, h2, h3').each((_, el) => {
        const fontFamily = this.extractFontFamily($(el));
        if (fontFamily) {
          this.incrementFontUsage(fontUsages, fontFamily, 'heading');
        }
      });

      // Extract body fonts (p, div, span)
      $('p, div, span').slice(0, 50).each((_, el) => {
        const fontFamily = this.extractFontFamily($(el));
        if (fontFamily) {
          this.incrementFontUsage(fontUsages, fontFamily, 'body');
        }
      });
    }

    // Find most common heading font
    const headingFonts = Array.from(fontUsages.values())
      .filter(fu => fu.context === 'heading')
      .sort((a, b) => b.frequency - a.frequency);
    const headingFont = headingFonts[0]?.fontFamily || this.DEFAULT_HEADING_FONT;

    // Find most common body font
    const bodyFonts = Array.from(fontUsages.values())
      .filter(fu => fu.context === 'body')
      .sort((a, b) => b.frequency - a.frequency);
    const bodyFont = bodyFonts[0]?.fontFamily || this.DEFAULT_BODY_FONT;

    return {
      heading: this.normalizeFontFamily(headingFont),
      body: this.normalizeFontFamily(bodyFont),
    };
  }

  /**
   * Extract font-family from element
   */
  private extractFontFamily($el: cheerio.Cheerio<any>): string | null {
    const style = $el.attr('style') || '';
    const match = style.match(/font-family:\s*([^;]+)/i);
    return match ? match[1].trim() : null;
  }

  /**
   * Increment font usage
   */
  private incrementFontUsage(
    map: Map<string, FontUsage>,
    fontFamily: string,
    context: FontUsage['context']
  ): void {
    const key = `${fontFamily}-${context}`;
    const existing = map.get(key);
    if (existing) {
      existing.frequency++;
    } else {
      map.set(key, { fontFamily, frequency: 1, context });
    }
  }

  /**
   * Normalize font family (add fallback stack)
   */
  private normalizeFontFamily(fontFamily: string): string {
    // Remove quotes
    fontFamily = fontFamily.replace(/['"]/g, '');

    // If already has fallback, return as-is
    if (fontFamily.includes(',')) {
      return fontFamily;
    }

    // Add appropriate fallback
    if (this.isSerifFont(fontFamily)) {
      return `${fontFamily}, Georgia, serif`;
    } else {
      return `${fontFamily}, Arial, sans-serif`;
    }
  }

  /**
   * Check if font is serif
   */
  private isSerifFont(fontFamily: string): boolean {
    const serifFonts = ['Georgia', 'Times', 'Garamond', 'Baskerville', 'Palatino', 'serif'];
    return serifFonts.some(serif => fontFamily.toLowerCase().includes(serif.toLowerCase()));
  }

  /**
   * Extract logo from pages
   */
  private extractLogo(pageData: Array<{ url: string; html: string; $: cheerio.CheerioAPI }>): string | null {
    for (const { $ } of pageData) {
      // Look for logo in header
      const headerLogo = $('header img[alt*="logo" i], header img[class*="logo" i]').first().attr('src');
      if (headerLogo) {
        return this.normalizeUrl(headerLogo, pageData[0].url);
      }

      // Look for logo in nav
      const navLogo = $('nav img[alt*="logo" i], nav img[class*="logo" i]').first().attr('src');
      if (navLogo) {
        return this.normalizeUrl(navLogo, pageData[0].url);
      }

      // Look for logo by class
      const classLogo = $('img[class*="logo" i]').first().attr('src');
      if (classLogo) {
        return this.normalizeUrl(classLogo, pageData[0].url);
      }
    }

    return null;
  }

  /**
   * Normalize relative URLs
   */
  private normalizeUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    if (url.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      return `${urlObj.protocol}//${urlObj.host}${url}`;
    }
    return url;
  }

  /**
   * Analyze brand tone from content
   */
  private analyzeTone(pageData: Array<{ url: string; html: string; $: cheerio.CheerioAPI }>): BrandGuidelines['tone'] {
    let textContent = '';

    for (const { $ } of pageData) {
      // Collect text from key areas
      textContent += $('h1, h2, h3').text() + ' ';
      textContent += $('p').slice(0, 20).text() + ' ';
      textContent += $('.hero, .about, .description').text() + ' ';
    }

    textContent = textContent.toLowerCase();

    // Formal indicators
    const formalIndicators = ['pursuant', 'hereby', 'aforementioned', 'compliance', 'regulations'];
    const formalScore = formalIndicators.filter(word => textContent.includes(word)).length;

    // Casual indicators
    const casualIndicators = ['hey', 'awesome', 'cool', 'yeah', 'gonna'];
    const casualScore = casualIndicators.filter(word => textContent.includes(word)).length;

    // Playful indicators
    const playfulIndicators = ['fun', 'exciting', 'amazing', '!', 'love'];
    const playfulScore = playfulIndicators.filter(word => textContent.includes(word)).length;

    // Luxury indicators
    const luxuryIndicators = ['exclusive', 'premium', 'luxury', 'bespoke', 'curated', 'artisan'];
    const luxuryScore = luxuryIndicators.filter(word => textContent.includes(word)).length;

    // Determine tone
    const scores = {
      formal: formalScore,
      casual: casualScore,
      playful: playfulScore,
      luxury: luxuryScore,
    };

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      return this.DEFAULT_TONE;
    }

    const toneEntry = Object.entries(scores).find(([_, score]) => score === maxScore);
    return (toneEntry?.[0] as BrandGuidelines['tone']) || this.DEFAULT_TONE;
  }

  /**
   * Analyze spacing from page layout
   */
  private analyzeSpacing(pageData: Array<{ url: string; html: string; $: cheerio.CheerioAPI }>): BrandGuidelines['spacing'] {
    const spacingValues: number[] = [];

    for (const { $ } of pageData) {
      // Analyze padding and margin in inline styles
      $('[style*="padding"], [style*="margin"]').slice(0, 50).each((_, el) => {
        const style = $(el).attr('style') || '';
        const paddingMatch = style.match(/padding:\s*(\d+)px/);
        const marginMatch = style.match(/margin:\s*(\d+)px/);
        
        if (paddingMatch) spacingValues.push(parseInt(paddingMatch[1]));
        if (marginMatch) spacingValues.push(parseInt(marginMatch[1]));
      });
    }

    if (spacingValues.length === 0) {
      return this.DEFAULT_SPACING;
    }

    // Calculate average spacing
    const avgSpacing = spacingValues.reduce((a, b) => a + b, 0) / spacingValues.length;

    if (avgSpacing < 20) {
      return 'compact';
    } else if (avgSpacing > 28) {
      return 'spacious';
    } else {
      return 'comfortable';
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    colors: { primary: string; secondary: string[]; accent: string },
    fonts: { heading: string; body: string },
    pagesAnalyzed: number
  ): number {
    let confidence = 0;

    // Base confidence from pages analyzed
    confidence += Math.min(pagesAnalyzed * 20, 40);

    // Colors found
    if (colors.primary !== this.DEFAULT_PRIMARY_COLOR) {
      confidence += 20;
    }
    if (colors.secondary.length > 0) {
      confidence += 15;
    }
    if (colors.accent !== this.DEFAULT_PRIMARY_COLOR) {
      confidence += 10;
    }

    // Fonts found
    if (fonts.heading !== this.DEFAULT_HEADING_FONT) {
      confidence += 10;
    }
    if (fonts.body !== this.DEFAULT_BODY_FONT) {
      confidence += 5;
    }

    return Math.min(confidence, 100);
  }
}

export const brandAnalyzer = new BrandAnalyzerService();
export default brandAnalyzer;
