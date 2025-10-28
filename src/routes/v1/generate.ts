import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { GenerateRequestSchema } from '../../schemas';
import productScraperService from '../../services/productScraper';
import templateGenerationService from '../../services/templateGeneration';
import analyticsService from '../../services/analytics';
import cdnService from '../../services/cdn';
import prisma from '../../lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export const generateRouter = Router();

/**
 * POST /api/v1/generate
 * Generate AMP email templates from product URLs or data
 */
generateRouter.post('/', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  const startTime = Date.now();
  let campaignId: string | undefined;

  try {
    // Validate request
    const data = GenerateRequestSchema.parse(req.body);
    const company = req.company;

    console.log(`🎯 Generation request from company: ${company.companyId}`);

    // Step 1: Extract or use product data
    let products;
    if (data.product_urls) {
      console.log(`📦 Extracting ${data.product_urls.length} products from URLs...`);
      products = await productScraperService.extractBulk(data.product_urls, company.companyId);
    } else {
      products = data.products!;
    }

    console.log(`✅ Processing ${products.length} products`);

    // Step 2: Generate templates
    const templates = await templateGenerationService.generateTemplates(
      products,
      data.campaign_context,
      data.user_context,
      data.options
    );

    // Step 3: Create campaign record
    const campaign = await prisma.campaign.create({
      data: {
        internalId: `camp_${uuidv4().substring(0, 8)}`,
        companyId: company.companyId,
        userId: data.user_context?.email || 'anonymous',
        type: data.campaign_context.type,
        status: 'completed',
        metadata: {
          productCount: products.length,
          variationsGenerated: templates.length
        }
      }
    });

    campaignId = campaign.id;

    // Step 4: Upload templates to CDN and store in database
    const storedTemplates = await Promise.all(
      templates.map(async (template) => {
        let cdnUrls;

        try {
          // Upload to CDN (Cloudflare R2)
          console.log(`📤 Uploading template ${template.variation_name} to CDN...`);

          cdnUrls = await cdnService.uploadTemplate(
            campaign.id,
            template.variation_name,
            template.content.body,  // AMP HTML
            template.content.body   // Fallback HTML (same for now)
          );

          console.log(`✅ Template ${template.variation_name} uploaded:`, cdnUrls.ampUrl);
        } catch (error) {
          console.error(`❌ CDN upload failed for ${template.variation_name}:`, error);

          // Fallback: Use preview endpoint if CDN fails
          cdnUrls = {
            ampUrl: `/api/v1/templates/preview/${campaign.id}/${template.variation_name}`,
            fallbackUrl: `/api/v1/templates/preview/${campaign.id}/${template.variation_name}`,
            cdnUrl: 'local'
          };

          console.warn(`⚠️ Using fallback preview URLs for ${template.variation_name}`);
        }

        // Store template in database
        const stored = await prisma.template.create({
          data: {
            campaignId: campaign.id,
            variationName: template.variation_name,
            ampUrl: cdnUrls.ampUrl,
            fallbackUrl: cdnUrls.fallbackUrl,
            content: template.content,
            mergeTags: template.merge_tags,
            ampFeatures: template.amp_features
          }
        });

        return stored;
      })
    );

    // Step 5: Calculate cost and log generation
    const duration = Date.now() - startTime;
    const cost = analyticsService.calculateCost({
      products: products.length,
      variations: templates.length
    });

    await analyticsService.logGeneration({
      companyId: company.companyId,
      userId: data.user_context?.email || 'anonymous',
      campaignId: campaign.id,
      productsProcessed: products.length,
      costUsd: cost.total,
      durationMs: duration,
      success: true
    });

    // Step 6: Add RAG metadata if templates were inspired
    const ragInspired = storedTemplates.some((t: any) => t.ampFeatures?.includes('rag-inspired'));
    if (ragInspired) {
      const existingMetadata = campaign.metadata && typeof campaign.metadata === 'object'
        ? campaign.metadata as Record<string, any>
        : {};
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          metadata: Object.assign({}, existingMetadata, { rag_inspiration_used: true })
        }
      });
    }

    // Step 7: Return response
    res.json({
      campaign_id: campaign.id,
      templates: storedTemplates,
      preview_urls: storedTemplates.map((t: any) => ({
        variation: t.variationName,
        url: `/api/v1/preview/${t.id}`
      })),
      integration_code: {
        sendgrid: `// SendGrid integration
const msg = {
  to: '{{email}}',
  from: 'your@email.com',
  subject: '${(storedTemplates[0].content as any)?.subject || 'Your Subject'}',
  html: '${storedTemplates[0].ampUrl}'
};`,
        resend: `// Resend integration
await resend.emails.send({
  from: 'your@email.com',
  to: '{{email}}',
  subject: '${(storedTemplates[0].content as any)?.subject || 'Your Subject'}',
  html: '${storedTemplates[0].ampUrl}'
});`
      },
      cost: {
        ...cost,
        breakdown: {
          ai_generation: `$${cost.ai_generation.toFixed(6)}`,
          product_scraping: `$${cost.product_scraping.toFixed(6)}`,
          cdn_delivery: `$${cost.cdn_delivery.toFixed(6)}`,
          total: `$${cost.total.toFixed(6)}`
        }
      },
      metadata: {
        generation_time_ms: duration,
        products_processed: products.length,
        variations_created: templates.length
      }
    });

  } catch (error: any) {
    // Log failed generation
    if (campaignId) {
      await analyticsService.logGeneration({
        companyId: req.company?.companyId || 'unknown',
        userId: 'unknown',
        campaignId,
        productsProcessed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message
      });
    }

    next(error);
  }
});


