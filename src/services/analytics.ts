import prisma from '../lib/prisma';

export interface CostBreakdown {
  ai_generation: number;
  product_scraping: number;
  cdn_delivery: number;
  total: number;
}

export class AnalyticsService {
  private AI_COST = parseFloat(process.env.AI_GENERATION_COST_USD || '0.0024');
  private SCRAPING_COST = parseFloat(process.env.SCRAPING_COST_USD || '0.0003');
  private CDN_COST = parseFloat(process.env.CDN_COST_USD || '0.0010');

  /**
   * Log generation event
   */
  async logGeneration(data: {
    companyId: string;
    userId: string;
    campaignId: string;
    productsProcessed: number;
    costUsd: number;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await prisma.generationLog.create({
        data: {
          companyId: data.companyId,
          userId: data.userId,
          campaignId: data.campaignId,
          generationType: 'api_generated',
          productsProcessed: data.productsProcessed,
          costUsd: data.costUsd,
          durationMs: data.durationMs,
          success: data.success,
          errorMessage: data.errorMessage
        }
      });

      console.log(`📊 Generation logged: ${data.campaignId} - ${data.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.error('❌ Failed to log generation:', error);
    }
  }

  /**
   * Track analytics event
   */
  async trackEvent(data: {
    campaignId: string;
    templateId?: string;
    eventType: string;
    eventData: any;
  }): Promise<void> {
    try {
      await prisma.analytic.create({
        data: {
          campaignId: data.campaignId,
          templateId: data.templateId,
          eventType: data.eventType,
          eventData: data.eventData
        }
      });

      console.log(`📈 Event tracked: ${data.eventType} for campaign ${data.campaignId}`);
    } catch (error) {
      console.error('❌ Failed to track event:', error);
    }
  }

  /**
   * Calculate generation cost
   */
  calculateCost(params: {
    products: number;
    variations: number;
  }): CostBreakdown {
    const aiCost = this.AI_COST * params.variations;
    const scrapingCost = this.SCRAPING_COST * params.products;
    const cdnCost = this.CDN_COST * params.variations;

    return {
      ai_generation: aiCost,
      product_scraping: scrapingCost,
      cdn_delivery: cdnCost,
      total: aiCost + scrapingCost + cdnCost
    };
  }

  /**
   * Get metrics for a campaign
   */
  async getCampaignMetrics(campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        templates: true,
        generationLogs: true,
        analytics: true
      }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const totalCost = campaign.generationLogs.reduce(
      (sum: number, log: any) => sum + parseFloat(log.costUsd.toString()),
      0
    );

    const avgDuration = campaign.generationLogs.reduce(
      (sum: number, log: any) => sum + log.durationMs,
      0
    ) / campaign.generationLogs.length;

    return {
      campaign_id: campaign.id,
      templates_generated: campaign.templates.length,
      variations_created: campaign.templates.length,
      total_cost_usd: totalCost.toFixed(6),
      avg_generation_time_ms: Math.round(avgDuration),
      products_processed: campaign.generationLogs[0]?.productsProcessed || 0,
      created_at: campaign.createdAt
    };
  }

  /**
   * Get company-wide analytics
   */
  async getCompanyAnalytics(companyId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const where: any = { companyId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        templates: true,
        generationLogs: true
      }
    });

    const totalCost = campaigns.reduce((sum: number, campaign: any) => {
      return sum + campaign.generationLogs.reduce(
        (logSum: number, log: any) => logSum + parseFloat(log.costUsd.toString()),
        0
      );
    }, 0);

    const successfulGenerations = campaigns.filter((c: any) =>
      c.generationLogs.some((log: any) => log.success)
    ).length;

    return {
      company_id: companyId,
      period: {
        start: startDate?.toISOString(),
        end: endDate?.toISOString()
      },
      metrics: {
        campaigns_created: campaigns.length,
        templates_generated: campaigns.reduce((sum: number, c: any) => sum + c.templates.length, 0),
        total_cost_usd: totalCost.toFixed(6),
        success_rate_percent: campaigns.length > 0
          ? ((successfulGenerations / campaigns.length) * 100).toFixed(2)
          : 0
      }
    };
  }
}

export default new AnalyticsService();
