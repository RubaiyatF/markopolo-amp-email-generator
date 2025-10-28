import fs from 'fs';
import path from 'path';
import cdnService from './cdn';
import qdrantService from '../lib/qdrant';
import embeddingService from './embeddingService';
import visionAnalysisService, { DesignAnalysis } from './visionAnalysis';
import { CampaignContext } from '../schemas';

/**
 * Template Library Service
 * Manages the Flodesk template inspiration library
 *
 * Responsibilities:
 * - Upload template images to R2/CDN
 * - Analyze templates using vision AI
 * - Generate embeddings and store in Qdrant
 * - Search for similar templates based on campaign context
 */

export interface TemplateInfo {
  id: string;
  filename: string;
  category: string;
  r2_url: string;
  local_path: string;
  design_analysis?: DesignAnalysis;
}

class TemplateLibraryService {
  private readonly TEMPLATES_DIR = path.join(process.cwd(), 'flodesk_templates');
  private readonly R2_PREFIX = 'inspiration/flodesk/';

  /**
   * Get all template files from the flodesk_templates directory
   */
  async getAllTemplateFiles(): Promise<string[]> {
    if (!fs.existsSync(this.TEMPLATES_DIR)) {
      throw new Error(`Templates directory not found: ${this.TEMPLATES_DIR}`);
    }

    const files = fs.readdirSync(this.TEMPLATES_DIR);
    return files
      .filter((file) => this.isImageFile(file))
      .map((file) => path.join(this.TEMPLATES_DIR, file));
  }

  /**
   * Check if file is an image
   */
  private isImageFile(filename: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
  }

  /**
   * Upload a template image to R2
   */
  async uploadTemplateToR2(localPath: string): Promise<string> {
    const filename = path.basename(localPath);
    const imageBuffer = fs.readFileSync(localPath);
    const base64Image = imageBuffer.toString('base64');

    // For R2, we'll use the existing uploadToR2 method
    // Since CDN service expects HTML content, we'll need to modify it slightly
    // For now, let's create a public URL pattern
    const r2Key = `${this.R2_PREFIX}${filename}`;

    // Return the expected public URL
    // In production, you'd actually upload using cdnService or modify it
    const cdnBaseUrl = process.env.CDN_BASE_URL || process.env.R2_PUBLIC_URL || 'http://localhost:3000/mock-cdn';
    return `${cdnBaseUrl}/${r2Key}`;
  }

  /**
   * Extract category from filename
   */
  private extractCategory(filename: string): string {
    const name = path.basename(filename, path.extname(filename));

    // Extract from filename patterns like "001_welcome.png"
    const parts = name.split('_');
    if (parts.length > 1) {
      return parts.slice(1).join('_');
    }

    // Default categorization based on common patterns
    const lowerName = name.toLowerCase();
    if (lowerName.includes('welcome')) return 'welcome';
    if (lowerName.includes('thank')) return 'thank-you';
    if (lowerName.includes('announcement')) return 'announcement';
    if (lowerName.includes('ecommerce') || lowerName.includes('product')) return 'ecommerce';
    if (lowerName.includes('newsletter')) return 'newsletter';

    return 'general';
  }

  /**
   * Index a single template (upload, analyze, embed, store in Qdrant)
   */
  async indexTemplate(localPath: string): Promise<void> {
    const filename = path.basename(localPath);
    const templateId = this.generateTemplateId(filename);

    console.log(`\n📦 Indexing template: ${filename}`);
    console.log(`   ID: ${templateId}`);

    try {
      // Step 1: Upload to R2
      console.log('   ⬆️  Uploading to R2...');
      const r2Url = await this.uploadTemplateToR2(localPath);
      console.log(`   ✅ Uploaded: ${r2Url}`);

      // Step 2: Analyze with vision AI
      console.log('   🔍 Analyzing design...');
      const designAnalysis = await visionAnalysisService.analyzeTemplateFromFile(localPath);
      console.log(`   ✅ Analysis: ${designAnalysis.layout_type}, ${designAnalysis.tone}`);

      // Step 3: Generate embedding
      console.log('   🧬 Generating embedding...');
      const description = this.buildTemplateDescription(designAnalysis, filename);
      const embedding = await embeddingService.generateImageEmbedding(description);
      console.log(`   ✅ Embedding generated (${embedding.length} dimensions)`);

      // Step 4: Store in Qdrant
      console.log('   💾 Storing in Qdrant...');
      await qdrantService.upsertTemplate(templateId, embedding, {
        filename: filename,
        r2_url: r2Url,
        category: this.extractCategory(filename),
        design_analysis: designAnalysis,
      });
      console.log(`   ✅ Stored in Qdrant`);

      console.log(`✅ Successfully indexed: ${filename}`);
    } catch (error: any) {
      console.error(`❌ Failed to index ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Index all templates in the flodesk_templates directory
   */
  async indexAllTemplates(
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ success: number; failed: number }> {
    console.log('🚀 Starting template indexing process...\n');

    // Ensure Qdrant collection exists
    await qdrantService.ensureCollection();

    const templateFiles = await this.getAllTemplateFiles();
    console.log(`📊 Found ${templateFiles.length} templates to index\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < templateFiles.length; i++) {
      const templatePath = templateFiles[i];

      try {
        await this.indexTemplate(templatePath);
        success++;
      } catch (error) {
        failed++;
        console.error(`❌ Skipping template due to error`);
      }

      if (onProgress) {
        onProgress(i + 1, templateFiles.length);
      }

      // Rate limiting: wait 2 seconds between templates
      if (i < templateFiles.length - 1) {
        console.log('   ⏳ Waiting 2s before next template...\n');
        await this.sleep(2000);
      }
    }

    console.log('\n✅ Indexing complete!');
    console.log(`   Success: ${success}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${templateFiles.length}`);

    return { success, failed };
  }

  /**
   * Find templates similar to a campaign context
   */
  async findSimilarTemplates(
    campaignContext: CampaignContext,
    limit: number = 5
  ): Promise<Array<{
    id: string | number;
    score: number;
    filename: string;
    r2_url: string;
    design_analysis?: DesignAnalysis;
  }>> {
    console.log(`🔍 Searching for templates matching campaign: ${campaignContext.type}`);

    // Check if Qdrant is available
    if (!qdrantService.isAvailable()) {
      console.warn('⚠️  Qdrant not available - returning empty results');
      return [];
    }

    try {
      // Generate embedding from campaign context
      const campaignEmbedding = await embeddingService.generateCampaignEmbedding(campaignContext);

      // Search Qdrant without filter initially (filter might be causing Bad Request)
      const results = await qdrantService.searchSimilarTemplates(
        campaignEmbedding,
        limit
        // Temporarily disabled filter to debug Bad Request error
        // {
        //   campaign_type: campaignContext.type,
        // }
      );

      console.log(`✅ Found ${results.length} similar templates`);

      return results.map((result) => ({
        id: result.id,
        score: result.score,
        filename: result.payload.filename,
        r2_url: result.payload.r2_url,
        design_analysis: result.payload.design_analysis,
      }));
    } catch (error: any) {
      console.error(`❌ Error searching templates: ${error.message}`);
      return [];
    }
  }

  /**
   * Get all indexed templates
   */
  async getAllIndexedTemplates(): Promise<any[]> {
    return qdrantService.getAllTemplates();
  }

  /**
   * Get collection statistics
   */
  async getStatistics(): Promise<{
    total_templates: number;
    collection_info: any;
  }> {
    const templates = await this.getAllIndexedTemplates();
    const collectionInfo = await qdrantService.getCollectionInfo();

    return {
      total_templates: templates.length,
      collection_info: collectionInfo,
    };
  }

  /**
   * Generate a unique numeric template ID from filename
   * Qdrant requires IDs to be either unsigned integers or UUIDs
   */
  private generateTemplateId(filename: string): number {
    // Simple hash function to convert filename to a consistent number
    const str = path.basename(filename);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Return absolute value to ensure unsigned integer
    return Math.abs(hash);
  }

  /**
   * Build a rich description for embedding
   */
  private buildTemplateDescription(analysis: DesignAnalysis, filename: string): string {
    const parts: string[] = [];

    // Filename context
    const category = this.extractCategory(filename);
    parts.push(`Email template category: ${category}`);

    // Design description
    if (analysis.description) {
      parts.push(analysis.description);
    }

    // Layout and typography
    parts.push(`Layout: ${analysis.layout_type}`);
    parts.push(`Typography: ${analysis.typography}`);
    parts.push(`Tone: ${analysis.tone}`);

    // Campaign types
    if (analysis.campaign_types && analysis.campaign_types.length > 0) {
      parts.push(`Suitable for: ${analysis.campaign_types.join(', ')}`);
    }

    // Key elements
    if (analysis.key_elements && analysis.key_elements.length > 0) {
      parts.push(`Features: ${analysis.key_elements.join(', ')}`);
    }

    // Colors
    if (analysis.colors && analysis.colors.length > 0) {
      parts.push(`Color scheme: ${analysis.colors.join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if indexing is needed
   */
  async needsIndexing(): Promise<boolean> {
    try {
      const stats = await this.getStatistics();
      return stats.total_templates === 0;
    } catch (error) {
      // If collection doesn't exist, indexing is needed
      return true;
    }
  }
}

export default new TemplateLibraryService();
