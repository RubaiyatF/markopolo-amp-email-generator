import geminiTemplateGenerator from './geminiTemplateGenerator';
import productImageProcessor from './productImageProcessor';
import productScraperService from './productScraper';
import { Product, CampaignContext, UserContext } from '../schemas';

/**
 * Integrated Template Generator
 * Complete flow: Product Scraping > Image Extraction > Template Generation > Image Processing
 *
 * Uses extract.pics for image extraction, Gemini for template generation, and Replicate for image processing
 */

export interface IntegratedGenerationOptions {
  productUrl: string;
  campaignContext: CampaignContext;
  userContext?: UserContext;
  variationIndex?: number;
  generateImages?: boolean; // whether to generate and replace images
}

export interface IntegratedGenerationResult {
  html: string;
  htmlWithImages?: string; // HTML with AI-generated images
  productData: Product;
  imagePlaceholders: string[];
  generatedImages?: string[];
  processingTime: number;
  steps: {
    scraping: number;
    templateGeneration: number;
    imageGeneration?: number;
  };
  selectedTemplate?: string; // randomly selected template filename
}

class IntegratedTemplateGenerator {
  /**
   * Complete integrated flow
   */
  async generate(options: IntegratedGenerationOptions): Promise<IntegratedGenerationResult> {
    const {
      productUrl,
      campaignContext,
      userContext,
      variationIndex = 0,
      generateImages = true,
    } = options;

    console.log('\n🚀 Starting Integrated Template Generation');
    console.log('='.repeat(60));
    console.log(`Product URL: ${productUrl}`);
    console.log(`Campaign: ${campaignContext.type}`);
    console.log(`Generate Images: ${generateImages ? 'Yes' : 'No'}`);
    console.log('='.repeat(60) + '\n');

    const totalStartTime = Date.now();
    const steps = {
      scraping: 0,
      templateGeneration: 0,
      imageGeneration: undefined as number | undefined,
    };

    try {
      // Step 1: Scrape Product Data
      console.log('📦 STEP 1: Scraping Product Data');
      console.log('-'.repeat(60));
      const scrapingStart = Date.now();

      const productData = await productScraperService.extractProduct(productUrl);

      steps.scraping = Date.now() - scrapingStart;
      console.log(`✅ Product scraped in ${steps.scraping}ms`);
      console.log(`   Name: ${productData.name}`);
      console.log(`   Price: ${productData.currency} ${productData.price}`);
      console.log(`   Brand: ${productData.brand}`);
      console.log(`   Images: ${productData.images?.length || 0} extracted\n`);

      // Step 2: Generate Template with RAG
      console.log('🎨 STEP 2: Generating Email Template');
      console.log('-'.repeat(60));
      const templateStart = Date.now();

      const templateResult = await geminiTemplateGenerator.generateTemplate({
        products: [productData],
        campaignContext,
        userContext,
        variationIndex,
      });

      steps.templateGeneration = Date.now() - templateStart;
      console.log(`✅ Template generated in ${steps.templateGeneration}ms`);
      console.log(`   HTML Length: ${templateResult.html.length} characters`);
      console.log(`   Image Placeholders: ${templateResult.imagePlaceholders.length}`);
      console.log(`   Selected Template: ${templateResult.selectedTemplate || 'None'}\n`);

      let htmlWithImages: string | undefined;
      let generatedImages: string[] | undefined;

      // Step 3: Process Product Images (if enabled and images available)
      if (generateImages && productData.images && productData.images.length > 0 && templateResult.imagePlaceholders.length > 0) {
        console.log('🖼️  STEP 3: Processing Product Images');
        console.log('-'.repeat(60));
        const imageStart = Date.now();

        try {
          // Determine how many images to process (match placeholder count)
          const imagesToProcess = productData.images.slice(0, templateResult.imagePlaceholders.length);

          // Process images: remove background + add context-appropriate background
          const processedImages = await productImageProcessor.processMultipleImages(
            imagesToProcess,
            productData.name || 'Product',
            productData.description
          );

          generatedImages = processedImages.map(img => img.url);

          steps.imageGeneration = Date.now() - imageStart;
          console.log(`✅ Images processed in ${steps.imageGeneration}ms`);
          console.log(`   Processed: ${generatedImages.length} images\n`);

          // Replace placeholders with processed images
          console.log('🔄 STEP 4: Replacing Image Placeholders');
          console.log('-'.repeat(60));
          htmlWithImages = geminiTemplateGenerator.replaceImagePlaceholders(
            templateResult.html,
            generatedImages
          );
          console.log(`✅ Placeholders replaced\n`);
        } catch (error: any) {
          console.error(`❌ Image processing failed: ${error.message}`);
          console.log(`   Continuing with placeholder images\n`);
          // Continue without images
        }
      } else if (!generateImages) {
        console.log('ℹ️  STEP 3: Skipped (generateImages = false)\n');
      } else if (!productData.images || productData.images.length === 0) {
        console.log('⚠️  STEP 3: Skipped (no product images available)\n');
      } else if (templateResult.imagePlaceholders.length === 0) {
        console.log('ℹ️  STEP 3: Skipped (no image placeholders in template)\n');
      }

      const totalTime = Date.now() - totalStartTime;

      console.log('='.repeat(60));
      console.log('✅ GENERATION COMPLETE!');
      console.log('='.repeat(60));
      console.log(`Total Time: ${totalTime}ms`);
      console.log(`   Scraping: ${steps.scraping}ms`);
      console.log(`   Template: ${steps.templateGeneration}ms`);
      if (steps.imageGeneration) {
        console.log(`   Images: ${steps.imageGeneration}ms`);
      }
      console.log('='.repeat(60) + '\n');

      return {
        html: templateResult.html,
        htmlWithImages,
        productData,
        imagePlaceholders: templateResult.imagePlaceholders,
        generatedImages,
        processingTime: totalTime,
        steps,
        selectedTemplate: templateResult.selectedTemplate,
      };
    } catch (error: any) {
      console.error('\n❌ GENERATION FAILED');
      console.error('='.repeat(60));
      console.error(`Error: ${error.message}`);
      console.error('='.repeat(60) + '\n');
      throw error;
    }
  }

  /**
   * Quick generation without images (faster)
   */
  async generateQuick(
    productUrl: string,
    campaignContext: CampaignContext,
    variationIndex: number = 0
  ): Promise<IntegratedGenerationResult> {
    return this.generate({
      productUrl,
      campaignContext,
      variationIndex,
      generateImages: false,
    });
  }

  /**
   * Generate with images (complete flow)
   */
  async generateWithImages(
    productUrl: string,
    campaignContext: CampaignContext,
    variationIndex: number = 0
  ): Promise<IntegratedGenerationResult> {
    return this.generate({
      productUrl,
      campaignContext,
      variationIndex,
      generateImages: true,
    });
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return productImageProcessor.isAvailable();
  }
}

export default new IntegratedTemplateGenerator();
