import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import analyticsService from '../../services/analytics';
import { AppError } from '../../middleware/errorHandler';

export const analyticsRouter = Router();

/**
 * GET /api/v1/analytics/campaign/:id
 * Get campaign analytics
 */
analyticsRouter.get('/campaign/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const metrics = await analyticsService.getCampaignMetrics(id);

    res.json(metrics);

  } catch (error: any) {
    if (error.message === 'Campaign not found') {
      next(new AppError(404, 'Campaign not found'));
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/v1/analytics/company/:companyId
 * Get company-wide analytics
 */
analyticsRouter.get('/company/:companyId', authenticate, async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { start_date, end_date } = req.query;

    const startDate = start_date ? new Date(start_date as string) : undefined;
    const endDate = end_date ? new Date(end_date as string) : undefined;

    const analytics = await analyticsService.getCompanyAnalytics(companyId, startDate, endDate);

    res.json(analytics);

  } catch (error) {
    next(error);
  }
});
