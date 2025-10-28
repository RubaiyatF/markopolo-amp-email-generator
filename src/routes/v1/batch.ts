import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { BatchCampaignRequestSchema } from '../../schemas';
import { enqueueBatchJob } from '../../workers/batchProcessor';

export const batchRouter = Router();

/**
 * POST /api/v1/batch/campaign
 * Process large-scale campaigns asynchronously
 */
batchRouter.post('/campaign', authenticate, rateLimit, async (req: AuthenticatedRequest, res, next) => {
  try {
    // Validate request
    const data = BatchCampaignRequestSchema.parse(req.body);
    const company = req.company;

    const jobId = `job_${Date.now()}_${company.companyId}`;

    // Queue the batch job using Bull
    await enqueueBatchJob({
      jobId,
      companyId: company.companyId,
      campaignName: data.campaign_name,
      productUrls: data.product_urls,
      campaignContext: data.campaign_context,
      options: {
        maxConcurrent: data.max_concurrent,
        chunkSize: data.chunk_size
      },
      webhookUrl: data.webhook_url
    });

    res.json({
      job_id: jobId,
      status: 'queued',
      tracking_url: `/api/v1/batch/status/${jobId}`,
      estimated_time: `${Math.ceil(data.product_urls.length / 100) * 10} minutes`,
      products_queued: data.product_urls.length,
      message: 'Batch campaign queued for processing'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/batch/status/:jobId
 * Check batch job status
 */
batchRouter.get('/status/:jobId', authenticate, async (req, res, next): Promise<any> => {
  try {
    const { jobId } = req.params;

    const { getJobStatus } = await import('../../workers/batchProcessor');
    const jobStatus = await getJobStatus(jobId);

    if (!jobStatus) {
      return res.status(404).json({
        error: 'Job not found',
        job_id: jobId
      });
    }

    return res.json({
      job_id: jobStatus.jobId,
      status: jobStatus.status,
      progress: jobStatus.progress || 0,
      data: jobStatus.data,
      result: jobStatus.returnvalue,
      error: jobStatus.failedReason
    });

  } catch (error) {
    next(error);
  }
});
