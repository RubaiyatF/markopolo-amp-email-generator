import sharp from 'sharp';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Image Processing Service
 * Handles image optimization, resizing, format conversion, and CDN upload
 */

export interface ProcessedImage {
  original_url: string;
  optimized_url: string;
  webp_url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  format: string;
  size_bytes: number;
}

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  generateThumbnail?: boolean;
  thumbnailSize?: number;
}

class ImageProcessingService {
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
   * Download image from URL
   */
  private async downloadImage(url: string): Promise<Buffer> {
    try {
      console.log(`📥 Downloading image: ${url}`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      console.error(`❌ Failed to download image: ${url}`, error.message);
      throw new Error(`Image download failed: ${error.message}`);
    }
  }

  /**
   * Process and optimize a single image
   */
  async processImage(
    imageUrl: string,
    productId: string,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessedImage> {
    try {
      const {
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 85,
        format = 'webp',
        generateThumbnail = true,
        thumbnailSize = 300
      } = options;

      // Download original image
      const imageBuffer = await this.downloadImage(imageUrl);

      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();
      const originalFormat = metadata.format || 'jpeg';

      console.log(`🖼️  Processing image: ${metadata.width}x${metadata.height} ${originalFormat}`);

      // Generate optimized version (maintain aspect ratio)
      const optimizedBuffer = await sharp(imageBuffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality, progressive: true })
        .toBuffer();

      // Generate WebP version (best for web)
      const webpBuffer = await sharp(imageBuffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: quality + 5 }) // WebP can use slightly higher quality for same file size
        .toBuffer();

      // Generate thumbnail
      let thumbnailBuffer: Buffer | null = null;
      if (generateThumbnail) {
        thumbnailBuffer = await sharp(imageBuffer)
          .resize(thumbnailSize, thumbnailSize, {
            fit: 'cover',
            position: 'center'
          })
          .webp({ quality: 80 })
          .toBuffer();
      }

      // Get processed image dimensions
      const processedMetadata = await sharp(optimizedBuffer).metadata();

      // Upload to R2
      const timestamp = Date.now();
      const basePath = `images/${productId}`;

      const [optimizedUrl, webpUrl, thumbnailUrl] = await Promise.all([
        this.uploadToR2(optimizedBuffer, `${basePath}/optimized-${timestamp}.jpg`, 'image/jpeg'),
        this.uploadToR2(webpBuffer, `${basePath}/webp-${timestamp}.webp`, 'image/webp'),
        thumbnailBuffer
          ? this.uploadToR2(thumbnailBuffer, `${basePath}/thumb-${timestamp}.webp`, 'image/webp')
          : Promise.resolve('')
      ]);

      console.log(`✅ Image processed and uploaded: ${productId}`);

      return {
        original_url: imageUrl,
        optimized_url: optimizedUrl,
        webp_url: webpUrl,
        thumbnail_url: thumbnailUrl,
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0,
        format: 'jpeg',
        size_bytes: optimizedBuffer.length
      };

    } catch (error: any) {
      console.error(`❌ Image processing failed for ${imageUrl}:`, error.message);

      // Fallback: Return original URL if processing fails
      return {
        original_url: imageUrl,
        optimized_url: imageUrl,
        webp_url: imageUrl,
        thumbnail_url: imageUrl,
        width: 0,
        height: 0,
        format: 'unknown',
        size_bytes: 0
      };
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
          CacheControl: 'public, max-age=31536000', // Cache for 1 year
        })
      );

      const url = `${this.cdnBaseUrl}/${key}`;
      console.log(`📤 Uploaded to R2: ${url}`);
      return url;
    } catch (error: any) {
      console.error(`❌ R2 upload failed for ${key}:`, error.message);
      throw new Error(`R2 upload failed: ${error.message}`);
    }
  }

  /**
   * Process multiple images in parallel
   */
  async processBulkImages(
    imageUrls: string[],
    productId: string,
    options?: ImageProcessingOptions
  ): Promise<ProcessedImage[]> {
    console.log(`🔄 Processing ${imageUrls.length} images in bulk...`);

    const results = await Promise.allSettled(
      imageUrls.map((url, index) =>
        this.processImage(url, `${productId}-${index}`, options)
      )
    );

    const processedImages: ProcessedImage[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        processedImages.push(result.value);
      } else {
        console.error(`❌ Failed to process image ${i}:`, result.reason);
        // Add original URL as fallback
        processedImages.push({
          original_url: imageUrls[i],
          optimized_url: imageUrls[i],
          webp_url: imageUrls[i],
          thumbnail_url: imageUrls[i],
          width: 0,
          height: 0,
          format: 'unknown',
          size_bytes: 0
        });
      }
    }

    console.log(`✅ Bulk processing complete: ${processedImages.length}/${imageUrls.length} successful`);
    return processedImages;
  }

  /**
   * Create responsive image srcset
   */
  async generateResponsiveSrcSet(
    imageUrl: string,
    productId: string,
    sizes: number[] = [320, 640, 960, 1200]
  ): Promise<{ [size: number]: string }> {
    const imageBuffer = await this.downloadImage(imageUrl);
    const srcSet: { [size: number]: string } = {};

    await Promise.all(
      sizes.map(async (size) => {
        const resizedBuffer = await sharp(imageBuffer)
          .resize(size, null, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 85 })
          .toBuffer();

        const url = await this.uploadToR2(
          resizedBuffer,
          `images/${productId}/responsive-${size}w.webp`,
          'image/webp'
        );

        srcSet[size] = url;
      })
    );

    return srcSet;
  }

  /**
   * Check if service is properly configured
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

export default new ImageProcessingService();
