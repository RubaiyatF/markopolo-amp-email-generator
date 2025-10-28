import Replicate from 'replicate';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Replicate Media Generation Service
 * Uses Replicate API for AI-powered image/video/GIF generation
 *
 * Models used:
 * - Image upscaling: nightmareai/real-esrgan
 * - Image to video: stability-ai/stable-video-diffusion
 * - GIF generation: andreasjansson/stable-diffusion-animation
 * - Image enhancement: tencentarc/gfpgan
 */

export interface EnhancedImage {
  type: 'upscaled' | 'enhanced' | 'gif' | 'video';
  original_url: string;
  enhanced_url: string;
  width: number;
  height: number;
  format: string;
  cost_usd: number;
}

class ReplicateMediaService {
  private client: Replicate | null = null;
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private cdnBaseUrl: string;
  private isInitialized: boolean = false;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || 'amp-email-templates';
    this.cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.magpie.to';
    this.initialize();
  }

  private initialize(): void {
    if (process.env.REPLICATE_API_KEY) {
      this.client = new Replicate({
        auth: process.env.REPLICATE_API_KEY,
      });
      console.log('✅ Replicate API initialized');
      this.isInitialized = true;
    } else {
      console.warn('⚠️  REPLICATE_API_KEY not set - media generation disabled');
    }

    // Initialize R2 client for CDN storage
    if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      const r2Endpoint = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: r2Endpoint,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
      console.log('✅ R2 CDN initialized for media storage');
    } else {
      console.warn('⚠️  R2 credentials not set - CDN upload disabled');
    }
  }

  /**
   * Upscale product image using Real-ESRGAN (4x upscaling)
   */
  async upscaleImage(imageUrl: string, productId: string): Promise<EnhancedImage> {
    if (!this.isInitialized) {
      throw new Error('Replicate API not initialized - missing REPLICATE_API_KEY');
    }

    try {
      console.log(`🔍 Upscaling image: ${imageUrl}`);

      const output = await this.client!.run(
        "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b" as any,
        {
          input: {
            image: imageUrl,
            scale: 4,
            face_enhance: false
          }
        }
      );

      const upscaledUrl = Array.isArray(output) ? output[0] : output;

      // Upload to R2 CDN
      const cdnUrl = await this.uploadToR2(
        upscaledUrl as string,
        `media/${productId}/upscaled-${Date.now()}.png`,
        'image/png'
      );

      console.log(`✅ Image upscaled: ${cdnUrl}`);

      return {
        type: 'upscaled',
        original_url: imageUrl,
        enhanced_url: cdnUrl,
        width: 0, // Replicate doesn't return dimensions
        height: 0,
        format: 'png',
        cost_usd: 0.005 // Approximate cost per run
      };
    } catch (error: any) {
      console.error(`❌ Image upscaling failed:`, error.message);
      throw error;
    }
  }

  /**
   * Enhance product image using GFPGAN (face/quality enhancement)
   */
  async enhanceImage(imageUrl: string, productId: string): Promise<EnhancedImage> {
    if (!this.isInitialized) {
      throw new Error('Replicate API not initialized - missing REPLICATE_API_KEY');
    }

    try {
      console.log(`✨ Enhancing image: ${imageUrl}`);

      const output = await this.client!.run(
        "tencentarc/gfpgan:9283608cc6b7be6b65a8e44983db012355fde4132009bf99d976b2f0896856a3" as any,
        {
          input: {
            img: imageUrl,
            version: "v1.4",
            scale: 2
          }
        }
      );

      const enhancedUrl = Array.isArray(output) ? output[0] : output;

      // Upload to R2 CDN
      const cdnUrl = await this.uploadToR2(
        enhancedUrl as string,
        `media/${productId}/enhanced-${Date.now()}.png`,
        'image/png'
      );

      console.log(`✅ Image enhanced: ${cdnUrl}`);

      return {
        type: 'enhanced',
        original_url: imageUrl,
        enhanced_url: cdnUrl,
        width: 0,
        height: 0,
        format: 'png',
        cost_usd: 0.005
      };
    } catch (error: any) {
      console.error(`❌ Image enhancement failed:`, error.message);
      throw error;
    }
  }

  /**
   * Generate animated GIF from product image
   */
  async generateGIF(imageUrl: string, productId: string, prompt?: string): Promise<EnhancedImage> {
    if (!this.isInitialized) {
      throw new Error('Replicate API not initialized - missing REPLICATE_API_KEY');
    }

    try {
      console.log(`🎬 Generating GIF from image: ${imageUrl}`);

      const output = await this.client!.run(
        "andreasjansson/stable-diffusion-animation:ca1f5e306e5721e19c473e0d094e6603f0456fe759c10715fcd6c1b79242d4a5" as any,
        {
          input: {
            prompt_start: prompt || "product showcase, professional lighting, clean background",
            prompt_end: prompt || "product showcase, professional lighting, clean background, zoomed in",
            init_image: imageUrl,
            num_frames: 30,
            num_inference_steps: 50
          }
        }
      );

      const gifUrl = Array.isArray(output) ? output[0] : output;

      // Upload to R2 CDN
      const cdnUrl = await this.uploadToR2(
        gifUrl as string,
        `media/${productId}/animated-${Date.now()}.gif`,
        'image/gif'
      );

      console.log(`✅ GIF generated: ${cdnUrl}`);

      return {
        type: 'gif',
        original_url: imageUrl,
        enhanced_url: cdnUrl,
        width: 512,
        height: 512,
        format: 'gif',
        cost_usd: 0.02 // Approximate cost for GIF generation
      };
    } catch (error: any) {
      console.error(`❌ GIF generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Generate video from product image using Stable Video Diffusion
   */
  async generateVideo(imageUrl: string, productId: string): Promise<EnhancedImage> {
    if (!this.isInitialized) {
      throw new Error('Replicate API not initialized - missing REPLICATE_API_KEY');
    }

    try {
      console.log(`🎥 Generating video from image: ${imageUrl}`);

      const output = await this.client!.run(
        "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438" as any,
        {
          input: {
            input_image: imageUrl,
            video_length: "14_frames_with_svd",
            sizing_strategy: "maintain_aspect_ratio",
            frames_per_second: 6,
            motion_bucket_id: 127,
            cond_aug: 0.02
          }
        }
      );

      const videoUrl = Array.isArray(output) ? output[0] : output;

      // Upload to R2 CDN
      const cdnUrl = await this.uploadToR2(
        videoUrl as string,
        `media/${productId}/video-${Date.now()}.mp4`,
        'video/mp4'
      );

      console.log(`✅ Video generated: ${cdnUrl}`);

      return {
        type: 'video',
        original_url: imageUrl,
        enhanced_url: cdnUrl,
        width: 1024,
        height: 576,
        format: 'mp4',
        cost_usd: 0.01 // Approximate cost per video
      };
    } catch (error: any) {
      console.error(`❌ Video generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Generate multiple media variations from a product image
   */
  async generateMediaVariations(
    imageUrl: string,
    productId: string,
    options: {
      upscale?: boolean;
      enhance?: boolean;
      gif?: boolean;
      video?: boolean;
    } = {}
  ): Promise<EnhancedImage[]> {
    const media: EnhancedImage[] = [];
    const { upscale = true, enhance = false, gif = false, video = false } = options;

    console.log(`🎨 Generating media variations for product: ${productId}`);
    console.log(`   Options: upscale=${upscale}, enhance=${enhance}, gif=${gif}, video=${video}`);

    try {
      // Run in parallel for faster processing
      const promises: Promise<EnhancedImage>[] = [];

      if (upscale) {
        promises.push(this.upscaleImage(imageUrl, productId));
      }

      if (enhance) {
        promises.push(this.enhanceImage(imageUrl, productId));
      }

      if (gif) {
        promises.push(this.generateGIF(imageUrl, productId));
      }

      if (video) {
        promises.push(this.generateVideo(imageUrl, productId));
      }

      const results = await Promise.allSettled(promises);

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          media.push(result.value);
        } else {
          console.error(`❌ Media generation ${idx + 1} failed:`, result.reason);
        }
      });

      const totalCost = media.reduce((sum, m) => sum + m.cost_usd, 0);
      console.log(`✅ Generated ${media.length} media variations (total cost: $${totalCost.toFixed(4)})`);

      return media;
    } catch (error: any) {
      console.error(`❌ Media variations generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Upload generated media to R2 CDN
   */
  private async uploadToR2(
    sourceUrl: string,
    key: string,
    contentType: string
  ): Promise<string> {
    if (!this.s3Client) {
      // If R2 is not configured, return the Replicate URL directly
      console.warn('⚠️  R2 not configured, returning Replicate URL');
      return sourceUrl;
    }

    try {
      // Download from Replicate
      const response = await axios.get(sourceUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });

      const buffer = Buffer.from(response.data);

      // Upload to R2
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
      // Fallback to Replicate URL
      return sourceUrl;
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.isInitialized;
  }

  /**
   * Get estimated cost for media generation
   */
  estimateCost(options: {
    upscale?: boolean;
    enhance?: boolean;
    gif?: boolean;
    video?: boolean;
  }): number {
    let cost = 0;
    if (options.upscale) cost += 0.005;
    if (options.enhance) cost += 0.005;
    if (options.gif) cost += 0.02;
    if (options.video) cost += 0.01;
    return cost;
  }
}

export default new ReplicateMediaService();
