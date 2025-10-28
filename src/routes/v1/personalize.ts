import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { PersonalizeRequestSchema } from '../../schemas';
import personalizationEngine from '../../services/personalization';
import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const personalizeRouter = Router();

/**
 * POST /api/v1/personalize
 * Apply recipient-specific personalization
 */
personalizeRouter.post('/', authenticate, rateLimit, async (req, res, next) => {
  try {
    const data = PersonalizeRequestSchema.parse(req.body);

    // Fetch template
    const template = await prisma.template.findUnique({
      where: { id: data.template_id }
    });

    if (!template) {
      throw new AppError(404, 'Template not found');
    }

    // Apply personalization
    const contentBody = (template.content as any)?.body || '';
    const personalizedContent = personalizationEngine.applyPersonalization(
      contentBody,
      data.recipient_data
    );

    // Detect which merge tags were applied
    const originalTags = personalizationEngine.detectMergeTags(contentBody);
    const remainingTags = personalizationEngine.detectMergeTags(personalizedContent);
    const appliedTags = originalTags.filter(tag => !remainingTags.includes(tag));

    res.json({
      personalized_content: personalizedContent,
      fallback_content: personalizedContent, // Would use fallback URL in production
      merge_tags_applied: appliedTags,
      missing_tags: remainingTags,
      preview_mode: data.preview_mode
    });

  } catch (error) {
    next(error);
  }
});
