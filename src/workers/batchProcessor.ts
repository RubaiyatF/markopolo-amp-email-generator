import Bull from 'bull';
import redis from '../lib/redis';
import prisma from '../lib/prisma';
import productScraperService from '../services/productScraper';
import templateGenerationService from '../services/templateGeneration';
import webhookService from '../services/webhook';

/**
 * Batch Campaign Processor Worker
 * Processes large-scale campaigns in background using Bull queue
 * 
 * Note: Requires Redis connection configured in REDIS_HOST/REDIS_PORT
 */

interface BatchJobData {
  jobId: string;
  companyId: string;
  campaignName: string;
  productUrls: string[];
  campaignContext: any;
  options: {
    maxConcurrent: number;
    chunkSize: number;
  };
  webhookUrl?: string;
}

interface JobProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  percentage: number;
}

// Create Bull queue for batch processing
const batchQueue = new Bull('batch-campaigns', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs
  },
});

/**
 * Process batch campaign job
 */
batchQueue.process('batch-campaign', async (job, done) => {
  const data: BatchJobData = job.data;

  try {
    console.log(`Starting batch job ${data.jobId} for company ${data.companyId}`);

    const { productUrls, options, campaignContext, webhookUrl } = data;
    const { chunkSize, maxConcurrent } = options;

    const totalProducts = productUrls.length;
    let processedCount = 0;
    let succeededCount = 0;
    let failedCount = 0;

    // Create campaign record
    const campaign = await prisma.campaign.create({
      data: {
        internalId: `batch_${data.jobId}`,
        companyId: data.companyId,
        userId: 'batch_system',
        name: data.campaignName,
        type: data.campaignContext.type,
        status: 'processing',
        totalProducts: totalProducts,
      },
    });

    // Process in chunks
    for (let i = 0; i < productUrls.length; i += chunkSize) {
      const chunk = productUrls.slice(i, i + chunkSize);

      // Process chunk with concurrency limit
      const results = await processChunkWithConcurrency(
        chunk,
        campaignContext,
        data.companyId,
        campaign.id,
        maxConcurrent
      );

      // Update progress
      processedCount += chunk.length;
      succeededCount += results.filter((r) => r.success).length;
      failedCount += results.filter((r) => !r.success).length;

      const progress: JobProgress = {
        total: totalProducts,
        processed: processedCount,
        succeeded: succeededCount,
        failed: failedCount,
        percentage: Math.round((processedCount / totalProducts) * 100),
      };

      // Update job progress
      await job.progress(progress.percentage);

      // Store progress in Redis
      await redis.setex(
        `batch:progress:${data.jobId}`,
        3600,
        JSON.stringify(progress)
      );

      console.log(
        `Batch job ${data.jobId}: ${processedCount}/${totalProducts} products processed`
      );
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    // Send webhook notification if configured
    if (webhookUrl) {
      await sendWebhookNotification(data.companyId, 'batch.completed', {
        jobId: data.jobId,
        campaignId: campaign.id,
        totalProducts,
        succeeded: succeededCount,
        failed: failedCount,
      });
    }

    console.log(`Batch job ${data.jobId} completed successfully`);
    done(null, { campaignId: campaign.id, succeeded: succeededCount, failed: failedCount });
  } catch (error) {
    console.error(`Batch job ${data.jobId} failed:`, error);
    done(error as Error);
  }
});

/**
 * Process chunk of products with concurrency control
 */
async function processChunkWithConcurrency(
  urls: string[],
  campaignContext: any,
  companyId: string,
  campaignId: string,
  maxConcurrent: number
): Promise<Array<{ success: boolean; error?: string }>> {
  const results: Array<{ success: boolean; error?: string }> = [];

  // Process in parallel with concurrency limit
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(async (url) => {
        try {
          // Extract product
          const product = await productScraperService.extractProduct(url);

          // Generate template
          const templates = await templateGenerationService.generateTemplates(
            [product],
            campaignContext,
            undefined,
            { variations: 1, preserve_merge_tags: true }
          );

          // Store template
          await prisma.template.create({
            data: {
              campaignId,
              variationName: 'default',
              ampUrl: `mock://${campaignId}/template`,
              fallbackUrl: `mock://${campaignId}/fallback`,
              content: templates[0].content,
              mergeTags: templates[0].merge_tags,
            },
          });

          return { success: true };
        } catch (error) {
          console.error(`Failed to process product ${url}:`, error);
          return { success: false, error: (error as Error).message };
        }
      })
    );

    results.push(...batchResults);
  }

  return results;
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(
  companyId: string,
  event: string,
  data: any
): Promise<void> {
  try {
    await webhookService.triggerWebhook(companyId, event, data);
  } catch (error) {
    console.error('Failed to send webhook notification:', error);
  }
}

/**
 * Add batch job to queue
 */
export async function enqueueBatchJob(data: BatchJobData): Promise<string> {
  const job = await batchQueue.add('batch-campaign', data, {
    jobId: data.jobId,
    timeout: 3600000, // 1 hour timeout
  });

  console.log(`Batch job ${data.jobId} enqueued`);
  return job.id?.toString() || data.jobId;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<any> {
  const job = await batchQueue.getJob(jobId);

  if (!job) {
    // Check Redis for progress
    const progressStr = await redis.get(`batch:progress:${jobId}`);
    if (progressStr) {
      return {
        jobId,
        status: 'processing',
        progress: JSON.parse(progressStr),
      };
    }
    return null;
  }

  const state = await job.getState();
  const progress = job.progress();

  return {
    jobId: job.id,
    status: state,
    progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}

/**
 * Queue event listeners
 */
batchQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

batchQueue.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

batchQueue.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});

export default batchQueue;
