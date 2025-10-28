import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ProcessedImage } from './imageProcessing';

/**
 * Media Generation Service
 * Creates enhanced media assets: badges, overlays, composite images, and animations
 */

export interface MediaAsset {
  type: 'badge' | 'overlay' | 'composite' | 'animated';
  url: string;
  width: number;
  height: number;
  format: string;
}

export interface BadgeOptions {
  text: string;
  backgroundColor?: string;
  textColor?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

class MediaGenerationService {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private cdnBaseUrl: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || 'amp-email-templates';
    this.cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.magpie.to';
    this.initializeR2Client();
  }

  private initializeR2Client(): void {
    const r2Endpoint = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  /**
   * Create a discount badge overlay on product image
   */
  async createDiscountBadge(
    imageUrl: string,
    discountPercentage: number,
    productId: string
  ): Promise<MediaAsset> {
    try {
      console.log(`🏷️  Creating discount badge: ${discountPercentage}% off`);

      // Create SVG badge
      const badgeSize = 120;
      const badgeSvg = `
        <svg width="${badgeSize}" height="${badgeSize}">
          <circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2 - 2}" fill="#ef4444" />
          <text
            x="${badgeSize / 2}"
            y="${badgeSize / 2 - 10}"
            font-family="Arial, sans-serif"
            font-size="32"
            font-weight="bold"
            fill="white"
            text-anchor="middle"
            dominant-baseline="middle"
          >-${discountPercentage}%</text>
          <text
            x="${badgeSize / 2}"
            y="${badgeSize / 2 + 20}"
            font-family="Arial, sans-serif"
            font-size="14"
            font-weight="bold"
            fill="white"
            text-anchor="middle"
          >OFF</text>
        </svg>
      `;

      const badgeBuffer = Buffer.from(badgeSvg);

      // For now, return the badge as a standalone image
      // In a full implementation, this would overlay on the product image
      const pngBadge = await sharp(badgeBuffer)
        .png()
        .toBuffer();

      const url = await this.uploadToR2(
        pngBadge,
        `media/${productId}/discount-badge-${Date.now()}.png`,
        'image/png'
      );

      console.log(`✅ Discount badge created: ${url}`);

      return {
        type: 'badge',
        url,
        width: badgeSize,
        height: badgeSize,
        format: 'png'
      };
    } catch (error: any) {
      console.error(`❌ Failed to create discount badge:`, error.message);
      throw error;
    }
  }

  /**
   * Create a product showcase grid (2x2 or custom layout)
   */
  async createProductGrid(
    images: ProcessedImage[],
    productId: string,
    columns: number = 2
  ): Promise<MediaAsset> {
    try {
      console.log(`🎨 Creating product grid: ${images.length} images`);

      if (images.length === 0) {
        throw new Error('No images provided for grid');
      }

      const imageSize = 300; // Size of each image in the grid
      const gap = 10; // Gap between images
      const rows = Math.ceil(images.length / columns);

      const canvasWidth = (imageSize * columns) + (gap * (columns - 1));
      const canvasHeight = (imageSize * rows) + (gap * (rows - 1));

      // Create composites array for sharp
      const composites: any[] = [];

      for (let i = 0; i < images.length; i++) {
        const row = Math.floor(i / columns);
        const col = i % columns;

        const left = col * (imageSize + gap);
        const top = row * (imageSize + gap);

        // Download and resize image
        const axios = require('axios');
        const response = await axios.get(images[i].optimized_url || images[i].original_url, {
          responseType: 'arraybuffer'
        });
        const imageBuffer = Buffer.from(response.data);

        const resizedImage = await sharp(imageBuffer)
          .resize(imageSize, imageSize, {
            fit: 'cover',
            position: 'center'
          })
          .toBuffer();

        composites.push({
          input: resizedImage,
          left,
          top
        });
      }

      // Create base canvas
      const gridImage = await sharp({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
        .composite(composites)
        .png()
        .toBuffer();

      const url = await this.uploadToR2(
        gridImage,
        `media/${productId}/grid-${Date.now()}.png`,
        'image/png'
      );

      console.log(`✅ Product grid created: ${url}`);

      return {
        type: 'composite',
        url,
        width: canvasWidth,
        height: canvasHeight,
        format: 'png'
      };
    } catch (error: any) {
      console.error(`❌ Failed to create product grid:`, error.message);
      throw error;
    }
  }

  /**
   * Create an urgency timer graphic
   */
  async createUrgencyTimer(
    hoursRemaining: number,
    productId: string
  ): Promise<MediaAsset> {
    try {
      console.log(`⏰ Creating urgency timer: ${hoursRemaining}h remaining`);

      const width = 400;
      const height = 120;

      const timerSvg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#ef4444;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#dc2626;stop-opacity:1" />
            </linearGradient>
          </defs>

          <rect width="${width}" height="${height}" rx="15" fill="url(#grad1)" />

          <text x="${width / 2}" y="35"
                font-family="Arial, sans-serif"
                font-size="16"
                font-weight="bold"
                fill="white"
                text-anchor="middle">
            ⏰ OFFER ENDS IN
          </text>

          <text x="${width / 2}" y="80"
                font-family="Arial, sans-serif"
                font-size="36"
                font-weight="bold"
                fill="white"
                text-anchor="middle">
            ${hoursRemaining} HOURS
          </text>
        </svg>
      `;

      const timerBuffer = Buffer.from(timerSvg);
      const pngTimer = await sharp(timerBuffer)
        .png()
        .toBuffer();

      const url = await this.uploadToR2(
        pngTimer,
        `media/${productId}/timer-${Date.now()}.png`,
        'image/png'
      );

      console.log(`✅ Urgency timer created: ${url}`);

      return {
        type: 'badge',
        url,
        width,
        height,
        format: 'png'
      };
    } catch (error: any) {
      console.error(`❌ Failed to create urgency timer:`, error.message);
      throw error;
    }
  }

  /**
   * Create a "New Arrival" badge
   */
  async createNewArrivalBadge(productId: string): Promise<MediaAsset> {
    try {
      console.log(`🆕 Creating new arrival badge`);

      const width = 150;
      const height = 50;

      const badgeSvg = `
        <svg width="${width}" height="${height}">
          <rect width="${width}" height="${height}" rx="25" fill="#10b981" />
          <text x="${width / 2}" y="${height / 2 + 6}"
                font-family="Arial, sans-serif"
                font-size="18"
                font-weight="bold"
                fill="white"
                text-anchor="middle">
            ✨ NEW
          </text>
        </svg>
      `;

      const badgeBuffer = Buffer.from(badgeSvg);
      const pngBadge = await sharp(badgeBuffer)
        .png()
        .toBuffer();

      const url = await this.uploadToR2(
        pngBadge,
        `media/${productId}/new-badge-${Date.now()}.png`,
        'image/png'
      );

      console.log(`✅ New arrival badge created: ${url}`);

      return {
        type: 'badge',
        url,
        width,
        height,
        format: 'png'
      };
    } catch (error: any) {
      console.error(`❌ Failed to create new arrival badge:`, error.message);
      throw error;
    }
  }

  /**
   * Create a social proof badge (e.g., "5000+ sold")
   */
  async createSocialProofBadge(
    count: number,
    label: string,
    productId: string
  ): Promise<MediaAsset> {
    try {
      console.log(`👥 Creating social proof badge: ${count} ${label}`);

      const width = 200;
      const height = 60;

      const badgeSvg = `
        <svg width="${width}" height="${height}">
          <rect width="${width}" height="${height}" rx="8" fill="#f3f4f6" stroke="#e5e7eb" stroke-width="2" />
          <text x="${width / 2}" y="25"
                font-family="Arial, sans-serif"
                font-size="20"
                font-weight="bold"
                fill="#1f2937"
                text-anchor="middle">
            ${count.toLocaleString()}+
          </text>
          <text x="${width / 2}" y="45"
                font-family="Arial, sans-serif"
                font-size="12"
                fill="#6b7280"
                text-anchor="middle">
            ${label.toUpperCase()}
          </text>
        </svg>
      `;

      const badgeBuffer = Buffer.from(badgeSvg);
      const pngBadge = await sharp(badgeBuffer)
        .png()
        .toBuffer();

      const url = await this.uploadToR2(
        pngBadge,
        `media/${productId}/social-proof-${Date.now()}.png`,
        'image/png'
      );

      console.log(`✅ Social proof badge created: ${url}`);

      return {
        type: 'badge',
        url,
        width,
        height,
        format: 'png'
      };
    } catch (error: any) {
      console.error(`❌ Failed to create social proof badge:`, error.message);
      throw error;
    }
  }

  /**
   * Upload buffer to Cloudflare R2
   */
  private async uploadToR2(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('R2 client not initialized');
    }

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000',
        })
      );

      return `${this.cdnBaseUrl}/${key}`;
    } catch (error: any) {
      console.error(`❌ R2 upload failed for ${key}:`, error.message);
      throw new Error(`R2 upload failed: ${error.message}`);
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(
      this.s3Client &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
    );
  }
}

export default new MediaGenerationService();
