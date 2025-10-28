import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import templateLibrary from '../../services/templateLibrary';
import qdrantService from '../../lib/qdrant';
import embeddingService from '../../services/embeddingService';
import { CampaignContext } from '../../schemas';

export const templateInspirationRouter = Router();

/**
 * GET /api/v1/template-inspiration/stats
 * Get statistics about the template library
 */
templateInspirationRouter.get('/stats', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const stats = await templateLibrary.getStatistics();

    res.json({
      success: true,
      data: {
        total_templates: stats.total_templates,
        qdrant_available: qdrantService.isAvailable(),
        embedding_service_available: embeddingService.isAvailable(),
        collection_info: stats.collection_info,
      },
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/v1/template-inspiration/templates
 * List all indexed templates
 */
templateInspirationRouter.get('/templates', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const templates = await templateLibrary.getAllIndexedTemplates();

    res.json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/v1/template-inspiration/search
 * Search for templates similar to a campaign context
 */
templateInspirationRouter.post('/search', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { campaign_context, limit } = req.body;

    if (!campaign_context) {
      res.status(400).json({
        success: false,
        error: 'campaign_context is required',
      });
      return;
    }

    const campaignContext: CampaignContext = {
      type: campaign_context.type || 'promotional',
      goal: campaign_context.goal || 'conversion',
      urgency: campaign_context.urgency,
      discount: campaign_context.discount,
    };

    const searchLimit = Math.min(limit || 5, 20); // Max 20 results

    const results = await templateLibrary.findSimilarTemplates(campaignContext, searchLimit);

    res.json({
      success: true,
      query: campaignContext,
      count: results.length,
      results: results.map((r) => ({
        id: r.id,
        filename: r.filename,
        similarity_score: r.score,
        r2_url: r.r2_url,
        design_analysis: r.design_analysis,
      })),
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/v1/template-inspiration/template/:id
 * Get details of a specific template
 */
templateInspirationRouter.get('/template/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;

    const template = await qdrantService.getTemplate(id);

    if (!template) {
      res.status(404).json({
        success: false,
        error: 'Template not found',
      });
      return;
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/v1/template-inspiration/needs-indexing
 * Check if templates need to be indexed
 */
templateInspirationRouter.get('/needs-indexing', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const needsIndexing = await templateLibrary.needsIndexing();

    res.json({
      success: true,
      needs_indexing: needsIndexing,
      message: needsIndexing
        ? 'No templates indexed. Run the indexing script to process templates.'
        : 'Templates are already indexed and ready to use.',
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/v1/template-inspiration/health
 * Check health of all RAG components
 */
templateInspirationRouter.get('/health', async (req: Request, res: Response) => {
  const health = {
    qdrant: {
      available: qdrantService.isAvailable(),
      status: 'unknown',
    },
    embedding_service: {
      available: embeddingService.isAvailable(),
      status: embeddingService.isAvailable() ? 'ready' : 'not configured',
    },
    template_library: {
      status: 'unknown',
      total_templates: 0,
    },
  };

  try {
    // Test Qdrant connection
    if (qdrantService.isAvailable()) {
      const collectionInfo = await qdrantService.getCollectionInfo();
      health.qdrant.status = 'connected';
      health.template_library.total_templates = collectionInfo.points_count || 0;
      health.template_library.status = health.template_library.total_templates > 0 ? 'ready' : 'empty';
    } else {
      health.qdrant.status = 'not configured';
      health.template_library.status = 'unavailable';
    }
  } catch (error: any) {
    health.qdrant.status = `error: ${error.message}`;
    health.template_library.status = 'error';
  }

  const allHealthy =
    health.qdrant.status === 'connected' &&
    health.embedding_service.available &&
    health.template_library.total_templates > 0;

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    health,
    message: allHealthy
      ? 'All RAG components are healthy'
      : 'Some RAG components are not available or need configuration',
  });
});

/**
 * POST /api/v1/template-inspiration/demo-search
 * Demo search for tentree product (no auth required for testing)
 */
templateInspirationRouter.post('/demo-search', async (req: Request, res: Response) => {
  try {
    const { campaign_context } = req.body;

    const campaignContext: CampaignContext = {
      type: campaign_context?.type || 'product_launch',
      goal: campaign_context?.goal || 'conversion',
      urgency: campaign_context?.urgency || 'medium',
      discount: campaign_context?.discount,
    };

    const results = await templateLibrary.findSimilarTemplates(campaignContext, 5);

    res.json({
      success: true,
      message: 'RAG Pipeline Test - Tentree Product',
      query: campaignContext,
      count: results.length,
      inspiration_templates: results.map((r) => ({
        filename: r.filename,
        similarity_score: r.score,
        layout: r.design_analysis?.layout_type,
        typography: r.design_analysis?.typography,
        tone: r.design_analysis?.tone,
        colors: r.design_analysis?.colors,
        campaign_types: r.design_analysis?.campaign_types,
        key_elements: r.design_analysis?.key_elements,
        r2_url: r.r2_url,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/template-inspiration/example-search
 * Example searches for different campaign types
 */
templateInspirationRouter.get('/example-search', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const exampleCampaigns: CampaignContext[] = [
      { type: 'abandoned_cart', goal: 'conversion', urgency: 'high' },
      { type: 'product_launch', goal: 'conversion', urgency: 'medium' },
      { type: 'price_drop', goal: 'conversion', discount: 25, urgency: 'high' },
      { type: 'promotional', goal: 'engagement', urgency: 'low' },
    ];

    const results = await Promise.all(
      exampleCampaigns.map(async (campaign) => {
        try {
          const templates = await templateLibrary.findSimilarTemplates(campaign, 3);
          return {
            campaign,
            matches: templates.length,
            top_templates: templates.slice(0, 3).map((t) => ({
              filename: t.filename,
              score: t.score,
              layout: t.design_analysis?.layout_type,
              tone: t.design_analysis?.tone,
            })),
          };
        } catch (error) {
          return {
            campaign,
            matches: 0,
            error: 'Search failed',
          };
        }
      })
    );

    res.json({
      success: true,
      examples: results,
    });
  } catch (error: any) {
    next(error);
  }
});
