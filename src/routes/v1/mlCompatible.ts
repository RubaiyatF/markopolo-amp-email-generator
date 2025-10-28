import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { MLCompatibleRequestSchema } from '../../schemas';
import templateGenerationService from '../../services/templateGeneration';
import prisma from '../../lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export const mlCompatibleRouter = Router();

/**
 * POST /api/v1/ml-compatible/generate-amp-content
 * Third-party AI agent compatible endpoint
 */
mlCompatibleRouter.post('/generate-amp-content', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  const startTime = Date.now();

  try {
    const data = MLCompatibleRequestSchema.parse(req.body);

    console.log(`🤖 ML-compatible request from ${data.companyId}/${data.userId}`);

    // Extract products if needed
    let products = data.productContext || [];
    if (products.length === 0) {
      console.log('⚠️ No product context provided');
    }

    // Generate content for each action tree node (or single default node)
    const nodes = data.actionTreeNodes || [{ 
      id: 'default', 
      description: 'Email campaign',
      nodeType: 'action' as const,
      indication: 'email' as const,
      target: ['all']
    }];

    const nodeContents = await Promise.all(
      nodes.map(async (node) => {
        const templates = await templateGenerationService.generateTemplates(
          products,
          data.campaignContext,
          data.userContext,
          { variations: 1, preserve_merge_tags: true }
        );

        const template = templates[0];

        return {
          nodeId: node.id,
          content: {
            subject: template.content.subject,
            body: template.content.body,
            preheader: template.content.preheader
          },
          ampUrl: `https://cdn.amp-platform.com/ml/${data.companyId}/${node.id}/amp.html`,
          fallbackUrl: `https://cdn.amp-platform.com/ml/${data.companyId}/${node.id}/fallback.html`,
          mergeTags: template.merge_tags
        };
      })
    );

    // Create campaign record
    const campaign = await prisma.campaign.create({
      data: {
        internalId: `ml_${uuidv4().substring(0, 8)}`,
        companyId: req.company.companyId,
        userId: data.userId,
        externalCampaignId: data.companyId,
        type: data.campaignContext.type,
        status: 'completed',
        metadata: {
          source: 'ml_compatible',
          nodeCount: nodes.length
        }
      }
    });

    res.json({
      success: true,
      data: {
        campaignId: campaign.id,
        nodeContents,
        templates: nodeContents.map(nc => ({
          id: uuidv4(),
          amp_url: nc.ampUrl,
          fallback_url: nc.fallbackUrl
        }))
      },
      metadata: {
        processingTime: Date.now() - startTime,
        companyId: data.companyId,
        userId: data.userId,
        nodesProcessed: nodes.length
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/action-tree/generate-content
 * Generate content for multi-node workflows
 */
mlCompatibleRouter.post('/action-tree/generate-content', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  // Same as ML-compatible
  try {
    const data = MLCompatibleRequestSchema.parse(req.body);
    const startTime = Date.now();

    const nodes = data.actionTreeNodes || [];
    const products = data.productContext || [];

    const nodeContents = await Promise.all(
      nodes.map(async (node) => {
        const templates = await templateGenerationService.generateTemplates(
          products,
          data.campaignContext,
          data.userContext,
          { variations: 1, preserve_merge_tags: true }
        );
        return {
          nodeId: node.id,
          content: templates[0].content,
          ampUrl: `https://cdn.amp-platform.com/ml/${data.companyId}/${node.id}/amp.html`,
          fallbackUrl: `https://cdn.amp-platform.com/ml/${data.companyId}/${node.id}/fallback.html`,
          mergeTags: templates[0].merge_tags
        };
      })
    );

    res.json({
      success: true,
      data: { campaignId: uuidv4(), nodeContents },
      metadata: { processingTime: Date.now() - startTime }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/node/generate-content
 * Generate content for single node
 */
mlCompatibleRouter.post('/node/generate-content', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  // Convert single node to array and process
  try {
    req.body.actionTreeNodes = [req.body.node];
    const data = MLCompatibleRequestSchema.parse(req.body);
    const startTime = Date.now();

    const node = data.actionTreeNodes![0];
    const products = data.productContext || [];

    const templates = await templateGenerationService.generateTemplates(
      products,
      data.campaignContext,
      data.userContext,
      { variations: 1, preserve_merge_tags: true }
    );

    res.json({
      success: true,
      data: {
        nodeId: node.id,
        content: templates[0].content,
        ampUrl: `https://cdn.amp-platform.com/ml/${data.companyId}/${node.id}/amp.html`,
        fallbackUrl: `https://cdn.amp-platform.com/ml/${data.companyId}/${node.id}/fallback.html`,
        mergeTags: templates[0].merge_tags
      },
      metadata: { processingTime: Date.now() - startTime }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/regenerate/:contentId
 * Regenerate content based on feedback
 */
mlCompatibleRouter.post('/regenerate/:contentId', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { contentId } = req.params;
    const { feedback } = req.body;

    console.log(`🔄 Regenerating content ${contentId} with feedback: ${feedback}`);

    // Mock regeneration response
    res.json({
      success: true,
      data: {
        contentId: `${contentId}_v2`,
        message: 'Content regenerated based on feedback',
        feedback_applied: feedback
      }
    });

  } catch (error) {
    next(error);
  }
});
