import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * CDN & Storage Service
 * Handles template storage in Cloudflare R2 and CDN delivery
 *
 * Cloudflare R2 is S3-compatible storage with zero egress fees
 * and built-in CDN capabilities via Cloudflare's global network
 *
 * Configuration required:
 * - R2_ACCOUNT_ID: Your Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API token access key ID
 * - R2_SECRET_ACCESS_KEY: R2 API token secret access key
 * - R2_BUCKET_NAME: Name of your R2 bucket
 * - R2_PUBLIC_URL: Public URL for your R2 bucket (optional, for custom domains)
 */

interface UploadResult {
  ampUrl: string;
  fallbackUrl: string;
  cdnUrl: string;
}

class CDNService {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private cdnBaseUrl: string;
  private r2Endpoint: string;
  private accountId: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'amp-email-templates';
    this.accountId = process.env.R2_ACCOUNT_ID || '';
    this.r2Endpoint = process.env.R2_ENDPOINT || `https://${this.accountId}.r2.cloudflarestorage.com`;

    // If custom domain is set, use it; otherwise use R2 public URL or dev.r2 URL
    this.cdnBaseUrl = process.env.CDN_BASE_URL ||
                      process.env.R2_PUBLIC_URL ||
                      process.env.CDN_DOMAIN ||
                      `https://pub-${this.accountId}.r2.dev/${this.bucketName}`;

    // Initialize R2 client only if credentials are available
    if (this.isConfigured()) {
      this.initializeClients();
    }
  }

  private isConfigured(): boolean {
    return !!(
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      this.accountId
    );
  }

  private initializeClients(): void {
    const clientConfig: any = {
      region: 'auto', // R2 uses 'auto' region
      endpoint: this.r2Endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    };

    this.s3Client = new S3Client(clientConfig);
    console.log('✅ Using Cloudflare R2 endpoint:', this.r2Endpoint);
    console.log('✅ R2 bucket:', this.bucketName);
    console.log('✅ CDN base URL:', this.cdnBaseUrl);
  }

  /**
   * Upload template to R2 and return CDN URLs
   */
  async uploadTemplate(
    campaignId: string,
    variationName: string,
    ampContent: string,
    fallbackContent: string
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      console.warn('CDN service not configured. Returning mock URLs.');
      return this.getMockUrls(campaignId, variationName);
    }

    try {
      const timestamp = Date.now();
      const ampKey = `templates/${campaignId}/${variationName}-${timestamp}.amp.html`;
      const fallbackKey = `templates/${campaignId}/${variationName}-${timestamp}.html`;

      // Upload AMP version
      await this.uploadToR2(ampKey, ampContent, 'text/html; charset=utf-8');

      // Upload fallback version
      await this.uploadToR2(fallbackKey, fallbackContent, 'text/html; charset=utf-8');

      const ampUrl = `${this.cdnBaseUrl}/${ampKey}`;
      const fallbackUrl = `${this.cdnBaseUrl}/${fallbackKey}`;

      return {
        ampUrl,
        fallbackUrl,
        cdnUrl: this.cdnBaseUrl,
      };
    } catch (error) {
      console.error('CDN upload failed:', error);
      throw new Error(`Failed to upload template to CDN: ${(error as Error).message}`);
    }
  }

  /**
   * Upload file to Cloudflare R2
   */
  private async uploadToR2(key: string, content: string, contentType: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('R2 client not initialized');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: content,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);
    console.log(`✅ Uploaded to R2: ${key}`);
  }

  /**
   * Generate signed URL for private access
   * Useful for temporary access to private files
   */
  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.s3Client) {
      console.warn('CDN service not configured. Returning mock URL.');
      return `${this.cdnBaseUrl}/${key}?signed=mock`;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${(error as Error).message}`);
    }
  }

  /**
   * Invalidate cache for specific paths
   * Note: Cloudflare R2 with custom domain uses Cloudflare CDN which has automatic cache management
   * For manual cache purging, use Cloudflare API or Dashboard
   */
  async invalidateCache(paths: string[]): Promise<void> {
    console.log('ℹ️  Cloudflare R2 cache invalidation:');
    console.log('   R2 with custom domain uses Cloudflare CDN with automatic cache management.');
    console.log('   For manual purging, use Cloudflare Dashboard or API:');
    console.log('   curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache"');
    console.log(`   Paths to purge: ${paths.join(', ')}`);

    // For automated cache purging, you would use Cloudflare API
    // This is left as a manual step for now
    return;
  }

  /**
   * Get mock URLs when CDN is not configured (for development)
   */
  private getMockUrls(campaignId: string, variationName: string): UploadResult {
    const timestamp = Date.now();
    return {
      ampUrl: `http://localhost:3000/mock-cdn/templates/${campaignId}/${variationName}-${timestamp}.amp.html`,
      fallbackUrl: `http://localhost:3000/mock-cdn/templates/${campaignId}/${variationName}-${timestamp}.html`,
      cdnUrl: 'http://localhost:3000/mock-cdn',
    };
  }

  /**
   * Delete template from R2
   */
  async deleteTemplate(key: string): Promise<void> {
    if (!this.s3Client) {
      console.warn('CDN service not configured. Skipping deletion.');
      return;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      console.log(`✅ Deleted template: ${key}`);
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw new Error(`Failed to delete template: ${(error as Error).message}`);
    }
  }

  /**
   * Check if CDN service is available
   */
  isAvailable(): boolean {
    return this.isConfigured() && this.s3Client !== null;
  }

  /**
   * Get public URL for a file
   * Returns the CDN URL with the file key
   */
  getPublicUrl(key: string): string {
    return `${this.cdnBaseUrl}/${key}`;
  }

  /**
   * List objects in bucket (useful for debugging)
   */
  async listObjects(prefix: string = ''): Promise<string[]> {
    if (!this.s3Client) {
      throw new Error('R2 client not initialized');
    }

    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);
      return response.Contents?.map(obj => obj.Key || '') || [];
    } catch (error) {
      console.error('Failed to list objects:', error);
      throw new Error(`Failed to list objects: ${(error as Error).message}`);
    }
  }
}

export default new CDNService();
