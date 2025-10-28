import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const templatesRouter = Router();

/**
 * GET /api/v1/templates/:id
 * Retrieve template details
 */
templatesRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        campaign: true
      }
    });

    if (!template) {
      throw new AppError(404, 'Template not found');
    }

    res.json({
      template: {
        id: template.id,
        variation_name: template.variationName,
        amp_url: template.ampUrl,
        fallback_url: template.fallbackUrl,
        content: template.content,
        merge_tags: template.mergeTags,
        amp_features: template.ampFeatures,
        created_at: template.createdAt
      },
      campaign: {
        id: template.campaign.id,
        internal_id: template.campaign.internalId,
        type: template.campaign.type,
        status: template.campaign.status
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/preview/:id
 * Generate browser-viewable preview
 */
templatesRouter.get('/preview/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const format = req.query.format as string || 'amp';

    const template = await prisma.template.findUnique({
      where: { id }
    });

    if (!template) {
      throw new AppError(404, 'Template not found');
    }

    const contentBody = (template.content as any)?.body || '<html><body>Template content not available</body></html>';
    const content = format === 'amp'
      ? contentBody
      : contentBody; // Would use fallbackUrl in production

    res.setHeader('Content-Type', 'text/html');
    res.send(content);

  } catch (error) {
    next(error);
  }
});
