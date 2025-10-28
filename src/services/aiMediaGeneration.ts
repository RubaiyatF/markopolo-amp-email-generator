import Replicate from 'replicate';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import aiModelConfig from '../config/ai-models.config';

/**
 * AI-Powered Media Generation Service
 * Uses Recraft V3, Flux Dev for images and Wan 2.1 for videos/GIFs
 */

export interface AIImageOptions {
  prompt: string;
  width?: number;
  height?: number;
  numOutputs?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
}

export interface AIVideoOptions {
  imageUrl: string;
  prompt?: string;
  duration?: number;
  fps?: number;
}

export interface GeneratedMedia {
  type: 'image' | 'video' | 'gif';
  url: string;
  width: number;
  height: number;
  format: string;
  model: string;
  generationTime: number;
}

class AIMediaGenerationService {
  private replicate: Replicate | null = null;
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private cdnBaseUrl: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || 'amp-email-templates';
    this.cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.magpie.to';
    this.initializeClients();
  }

  private initializeClients(): void {
    // Initialize Replicate
    const replicateApiKey = process.env.REPLICATE_API_KEY;
    if (replicateApiKey) {
      this.replicate = new Replicate({ auth: replicateApiKey });
    }

    // Initialize R2/S3
    const r2Endpoint = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: r2Endpoint,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });
    }
  }

  /**
   * Generate image using Flux Dev
   */
  async generateImage(options: AIImageOptions): Promise<GeneratedMedia> {
    if (!this.replicate) {
      throw new Error('Replicate API not configured. Set REPLICATE_API_KEY environment variable.');
    }

    const startTime = Date.now();
    const modelConfig = aiModelConfig.imageModel;

    console.log(`🎨 Generating image with ${modelConfig.name}...`);
    console.log(`   Prompt: ${options.prompt}`);

    try {
      const input: any = {
        prompt: options.prompt,
        width: options.width || aiModelConfig.defaults.image.width,
        height: options.height || aiModelConfig.defaults.image.height,
        num_outputs: options.numOutputs || aiModelConfig.defaults.image.numOutputs,
        num_inference_steps: options.num_inference_steps || aiModelConfig.defaults.image.numInferenceSteps,
        guidance_scale: options.guidance_scale || aiModelConfig.defaults.image.guidanceScale
      };

      const output = await this.replicate.run(
        modelConfig.modelId as `${string}/${string}`,
        { input }
      );

      // Extract image URL from output
      let imageUrl: string;
      if (Array.isArray(output)) {
        imageUrl = output[0] as string;
      } else if (typeof output === 'string') {
        imageUrl = output;
      } else {
        throw new Error('Unexpected output format from model');
      }

      const generationTime = Date.now() - startTime;

      console.log(`✅ Image generated in ${(generationTime / 1000).toFixed(2)}s`);
      console.log(`   URL: ${imageUrl}`);

      // Download and upload to R2
      const cdnUrl = await this.downloadAndUploadToR2(
        imageUrl,
        `ai-generated/${Date.now()}-flux-dev.png`,
        'image/png'
      );

      return {
        type: 'image',
        url: cdnUrl,
        width: input.width,
        height: input.height,
        format: 'png',
        model: modelConfig.name,
        generationTime
      };
    } catch (error: any) {
      console.error(`❌ Image generation failed:`, error.message);
      throw new Error(`Failed to generate image with ${modelConfig.name}: ${error.message}`);
    }
  }

  /**
   * Generate video/GIF from image using Wan 2.1 I2V 480p
   */
  async generateVideo(options: AIVideoOptions): Promise<GeneratedMedia> {
    if (!this.replicate) {
      throw new Error('Replicate API not configured. Set REPLICATE_API_KEY environment variable.');
    }

    const startTime = Date.now();
    const modelConfig = aiModelConfig.videoModel;

    console.log(`🎬 Generating video with ${modelConfig.name}...`);
    console.log(`   Image: ${options.imageUrl}`);
    console.log(`   Prompt: ${options.prompt || 'N/A'}`);

    try {
      const input: any = {
        image: options.imageUrl,
        fps: options.fps || aiModelConfig.defaults.video.fps,
        num_inference_steps: aiModelConfig.defaults.video.numInferenceSteps
      };

      if (options.prompt) {
        input.prompt = options.prompt;
      }

      if (options.duration) {
        input.num_frames = (options.fps || 24) * options.duration;
      }

      const output = await this.replicate.run(
        modelConfig.modelId as `${string}/${string}`,
        { input }
      );

      // Extract video URL from output
      let videoUrl: string;
      if (typeof output === 'string') {
        videoUrl = output;
      } else if (Array.isArray(output)) {
        videoUrl = output[0] as string;
      } else {
        throw new Error('Unexpected output format from video model');
      }

      const generationTime = Date.now() - startTime;

      console.log(`✅ Video generated in ${(generationTime / 1000).toFixed(2)}s`);
      console.log(`   URL: ${videoUrl}`);

      // Download and upload to R2
      const cdnUrl = await this.downloadAndUploadToR2(
        videoUrl,
        `ai-generated/${Date.now()}-wan-2.1-i2v-480p.mp4`,
        'video/mp4'
      );

      return {
        type: 'video',
        url: cdnUrl,
        width: 854, // 480p width
        height: 480,
        format: 'mp4',
        model: modelConfig.name,
        generationTime
      };
    } catch (error: any) {
      console.error(`❌ Video generation failed:`, error.message);
      throw new Error(`Failed to generate video with ${modelConfig.name}: ${error.message}`);
    }
  }

  /**
   * Generate GIF from image (uses video model and converts to GIF)
   */
  async generateGIF(options: AIVideoOptions): Promise<GeneratedMedia> {
    console.log(`🎞️  Generating GIF from image...`);

    // First generate video
    const video = await this.generateVideo(options);

    // In production, you'd convert the video to GIF here
    // For now, we'll return the video with type 'gif'
    console.log(`   Note: GIF conversion not yet implemented, returning MP4`);

    return {
      ...video,
      type: 'gif',
      format: 'mp4' // Would be 'gif' after conversion
    };
  }

  /**
   * Generate product badge using AI (Flux Dev)
   */
  async generateProductBadge(
    productName: string,
    badgeType: 'discount' | 'new' | 'bestseller' | 'limited',
    value?: string
  ): Promise<GeneratedMedia> {
    const prompts: { [key: string]: string } = {
      discount: `Create a vibrant, eye-catching discount badge for "${productName}" showing "${value || '20%'} OFF" in bold text. Modern e-commerce style, gradient background, professional design.`,
      new: `Create a sleek "NEW ARRIVAL" badge for "${productName}". Fresh, modern design with gradient accents, minimalist style.`,
      bestseller: `Create a premium "BESTSELLER" badge for "${productName}". Gold/yellow accents, elegant design, trophy or star icon.`,
      limited: `Create an urgent "LIMITED EDITION" badge for "${productName}". Bold red/orange colors, sense of exclusivity and urgency.`
    };

    return await this.generateImage({
      prompt: prompts[badgeType],
      width: 512,
      height: 512
    });
  }

  /**
   * Generate lifestyle product image (Flux Dev)
   */
  async generateLifestyleImage(
    productDescription: string,
    scene: string
  ): Promise<GeneratedMedia> {
    const prompt = `Product photography: ${productDescription} in ${scene}. Professional product photography, high quality, well-lit, modern minimalist aesthetic. 4K, studio quality.`;

    return await this.generateImage({
      prompt,
      width: 1024,
      height: 1024
    });
  }

  /**
   * Download image/video from URL and upload to R2
   */
  private async downloadAndUploadToR2(
    url: string,
    key: string,
    contentType: string
  ): Promise<string> {
    if (!this.s3Client) {
      console.warn('⚠️  R2 not configured, returning original URL');
      return url;
    }

    try {
      console.log(`   📥 Downloading from Replicate...`);
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      console.log(`   📤 Uploading to R2...`);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000',
        })
      );

      const cdnUrl = `${this.cdnBaseUrl}/${key}`;
      console.log(`   ✅ Uploaded to CDN: ${cdnUrl}`);

      return cdnUrl;
    } catch (error: any) {
      console.error(`   ❌ Upload to R2 failed:`, error.message);
      console.warn(`   ⚠️  Returning original Replicate URL`);
      return url;
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.replicate);
  }

  /**
   * Get available models info
   */
  getModelsInfo() {
    return {
      templateModel: aiModelConfig.templateModel,
      imageModel: aiModelConfig.imageModel,
      videoModel: aiModelConfig.videoModel,
      configured: this.isConfigured()
    };
  }
}

export default new AIMediaGenerationService();
