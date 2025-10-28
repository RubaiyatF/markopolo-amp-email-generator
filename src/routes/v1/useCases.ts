import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import {
  AbandonedCartRequestSchema,
  ProductLaunchRequestSchema,
  PriceDropRequestSchema,
  BackInStockRequestSchema
} from '../../schemas';
import productScraperService from '../../services/productScraper';
import templateGenerationService from '../../services/templateGeneration';
import { v4 as uuidv4 } from 'uuid';

export const useCasesRouter = Router();

/**
 * POST /api/v1/use-cases/abandoned-cart/campaign
 * Generate abandoned cart recovery emails
 */
useCasesRouter.post('/abandoned-cart/campaign', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = AbandonedCartRequestSchema.parse(req.body);

    // Calculate urgency based on time since abandonment
    const abandonedDate = new Date(data.abandoned_at);
    const hoursAbandoned = (Date.now() - abandonedDate.getTime()) / 3600000;
    const urgencyLevel = hoursAbandoned > 24 ? 'high' : hoursAbandoned > 12 ? 'medium' : 'low';

    // Auto-calculate discount if enabled
    let discountOffered = 0;
    if (data.discount_strategy === 'auto') {
      discountOffered = urgencyLevel === 'high' ? 15 : urgencyLevel === 'medium' ? 10 : 5;
    }

    // Extract products
    const products = await productScraperService.extractBulk(data.product_urls, req.company.companyId);

    // Generate templates with urgency
    const templates = await templateGenerationService.generateTemplates(
      products,
      {
        type: 'abandoned_cart',
        goal: 'conversion',
        urgency: urgencyLevel as any,
        discount: discountOffered
      },
      { email: data.user_email },
      { variations: 3, preserve_merge_tags: true }
    );

    const sendAfter = new Date(Date.now() + data.trigger_after_hours * 3600000);

    res.json({
      campaign_id: uuidv4(),
      urgency_level: urgencyLevel,
      discount_offered: discountOffered,
      send_after: sendAfter.toISOString(),
      cart_value: data.cart_value,
      templates: templates.map(t => ({
        id: uuidv4(),
        variation_name: t.variation_name,
        subject: t.content.subject,
        preview_url: `/api/v1/preview/${uuidv4()}`
      }))
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/use-cases/product-launch/campaign
 * Generate product announcement emails
 */
useCasesRouter.post('/product-launch/campaign', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = ProductLaunchRequestSchema.parse(req.body);

    const products = await productScraperService.extractBulk(data.product_urls, req.company.companyId);

    const templates = await templateGenerationService.generateTemplates(
      products,
      {
        type: 'product_launch',
        goal: 'acquisition'
      },
      undefined,
      { variations: 3, preserve_merge_tags: true }
    );

    res.json({
      campaign_id: uuidv4(),
      launch_date: data.launch_date,
      early_access: data.early_access,
      pre_order_enabled: data.pre_order_enabled,
      templates: templates.map(t => ({
        id: uuidv4(),
        variation_name: t.variation_name,
        subject: t.content.subject
      }))
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/use-cases/price-drop/alert
 * Generate price drop notification emails
 */
useCasesRouter.post('/price-drop/alert', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = PriceDropRequestSchema.parse(req.body);

    const discountPercentage = data.discount_percentage || 
      Math.round(((data.original_price - data.new_price) / data.original_price) * 100);

    const products = await productScraperService.extractProduct(data.product_url);

    const templates = await templateGenerationService.generateTemplates(
      [products],
      {
        type: 'price_drop',
        goal: 'conversion',
        urgency: data.limited_time ? 'high' : 'medium'
      },
      undefined,
      { variations: 2, preserve_merge_tags: true }
    );

    res.json({
      campaign_id: uuidv4(),
      product_url: data.product_url,
      original_price: data.original_price,
      new_price: data.new_price,
      discount_percentage: discountPercentage,
      savings: data.original_price - data.new_price,
      templates: templates.map(t => ({
        id: uuidv4(),
        variation_name: t.variation_name,
        subject: t.content.subject
      }))
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/use-cases/back-in-stock/notify
 * Generate back-in-stock alerts
 */
useCasesRouter.post('/back-in-stock/notify', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = BackInStockRequestSchema.parse(req.body);

    const products = await productScraperService.extractProduct(data.product_url);

    const templates = await templateGenerationService.generateTemplates(
      [products],
      {
        type: 'back_in_stock',
        goal: 'conversion',
        urgency: data.notify_urgency ? 'high' : 'medium'
      },
      undefined,
      { variations: 2, preserve_merge_tags: true }
    );

    res.json({
      campaign_id: uuidv4(),
      waitlist_id: data.waitlist_id,
      product_url: data.product_url,
      stock_quantity: data.stock_quantity,
      notify_urgency: data.notify_urgency,
      templates: templates.map(t => ({
        id: uuidv4(),
        variation_name: t.variation_name,
        subject: t.content.subject
      }))
    });

  } catch (error) {
    next(error);
  }
});
