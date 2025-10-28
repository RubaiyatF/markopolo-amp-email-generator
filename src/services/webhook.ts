import axios from 'axios';
import prisma from '../lib/prisma';
import redis from '../lib/redis';

/**
 * Webhook Service
 * Handles webhook registration, product monitoring, and notification delivery
 */

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };
}

class WebhookService {
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  /**
   * Register a webhook for a company
   */
  async registerWebhook(
    companyId: string,
    config: WebhookConfig
  ): Promise<{ webhookId: string; status: string }> {
    try {
      // Validate webhook URL
      this.validateWebhookUrl(config.url);

      // Store webhook configuration in Redis
      const webhookId = `webhook_${companyId}_${Date.now()}`;
      const webhookData = {
        id: webhookId,
        companyId,
        url: config.url,
        events: config.events,
        secret: config.secret,
        retryPolicy: config.retryPolicy || {
          maxRetries: this.MAX_RETRIES,
          retryDelay: this.RETRY_DELAY,
        },
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      await redis.setex(
        `webhook:${webhookId}`,
        86400 * 30, // 30 days
        JSON.stringify(webhookData)
      );

      // Add to company's webhook list
      await redis.sadd(`company:${companyId}:webhooks`, webhookId);

      console.log(`Webhook registered: ${webhookId} for company ${companyId}`);

      return {
        webhookId,
        status: 'registered',
      };
    } catch (error) {
      console.error('Failed to register webhook:', error);
      throw new Error(`Webhook registration failed: ${(error as Error).message}`);
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(
    webhookId: string,
    event: string,
    data: any
  ): Promise<{ success: boolean; attempts: number }> {
    try {
      // Retrieve webhook configuration
      const webhookDataStr = await redis.get(`webhook:${webhookId}`);
      if (!webhookDataStr) {
        throw new Error(`Webhook not found: ${webhookId}`);
      }

      const webhookConfig = JSON.parse(webhookDataStr);

      // Check if webhook is active and event is subscribed
      if (webhookConfig.status !== 'active') {
        console.warn(`Webhook ${webhookId} is not active`);
        return { success: false, attempts: 0 };
      }

      if (!webhookConfig.events.includes(event) && !webhookConfig.events.includes('*')) {
        console.log(`Event ${event} not subscribed for webhook ${webhookId}`);
        return { success: false, attempts: 0 };
      }

      // Prepare payload
      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      // Send with retry logic
      const result = await this.sendWithRetry(
        webhookConfig.url,
        payload,
        webhookConfig.secret,
        webhookConfig.retryPolicy
      );

      // Log webhook delivery
      await this.logWebhookDelivery(webhookId, event, result.success, result.attempts);

      return result;
    } catch (error) {
      console.error('Failed to send webhook:', error);
      return { success: false, attempts: 0 };
    }
  }

  /**
   * Send webhook with retry logic
   */
  private async sendWithRetry(
    url: string,
    payload: WebhookPayload,
    secret?: string,
    retryPolicy?: { maxRetries: number; retryDelay: number }
  ): Promise<{ success: boolean; attempts: number }> {
    const maxRetries = retryPolicy?.maxRetries || this.MAX_RETRIES;
    const retryDelay = retryPolicy?.retryDelay || this.RETRY_DELAY;

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < maxRetries) {
      attempts++;

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'AMP-Email-Platform-Webhook/1.0',
        };

        // Add signature if secret is provided
        if (secret) {
          headers['X-Webhook-Signature'] = this.generateSignature(payload, secret);
        }

        const response = await axios.post(url, payload, {
          headers,
          timeout: this.DEFAULT_TIMEOUT,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        console.log(`Webhook delivered successfully on attempt ${attempts}`);
        return { success: true, attempts };
      } catch (error) {
        lastError = error as Error;
        console.warn(`Webhook delivery attempt ${attempts} failed:`, error);

        if (attempts < maxRetries) {
          await this.sleep(retryDelay * attempts); // Exponential backoff
        }
      }
    }

    console.error(`Webhook delivery failed after ${attempts} attempts:`, lastError);
    return { success: false, attempts };
  }

  /**
   * Monitor product for changes and trigger webhooks
   */
  async monitorProduct(
    productUrl: string,
    companyId: string,
    checkInterval: number = 3600000 // 1 hour default
  ): Promise<{ monitorId: string; status: string }> {
    try {
      const monitorId = `monitor_${companyId}_${Date.now()}`;

      // Store monitoring configuration
      const monitorData = {
        id: monitorId,
        companyId,
        productUrl,
        checkInterval,
        lastChecked: null,
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      await redis.setex(
        `monitor:${monitorId}`,
        86400 * 30, // 30 days
        JSON.stringify(monitorData)
      );

      // Add to monitoring queue (would be processed by background worker)
      await redis.sadd('monitoring:queue', monitorId);

      console.log(`Product monitoring started: ${monitorId}`);

      return {
        monitorId,
        status: 'monitoring',
      };
    } catch (error) {
      console.error('Failed to start product monitoring:', error);
      throw new Error(`Product monitoring failed: ${(error as Error).message}`);
    }
  }

  /**
   * Trigger webhook for specific event
   */
  async triggerWebhook(
    companyId: string,
    event: string,
    data: any
  ): Promise<{ delivered: number; failed: number }> {
    try {
      // Get all webhooks for company
      const webhookIds = await redis.smembers(`company:${companyId}:webhooks`);

      if (webhookIds.length === 0) {
        console.log(`No webhooks registered for company ${companyId}`);
        return { delivered: 0, failed: 0 };
      }

      let delivered = 0;
      let failed = 0;

      // Send to all registered webhooks
      await Promise.all(
        webhookIds.map(async (webhookId) => {
          const result = await this.sendWebhook(webhookId, event, data);
          if (result.success) {
            delivered++;
          } else {
            failed++;
          }
        })
      );

      console.log(`Webhook delivery summary: ${delivered} delivered, ${failed} failed`);

      return { delivered, failed };
    } catch (error) {
      console.error('Failed to trigger webhooks:', error);
      throw new Error(`Webhook trigger failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate webhook URL
   */
  private validateWebhookUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol. Only HTTP and HTTPS are supported.');
      }

      if (parsedUrl.hostname === 'localhost' && process.env.NODE_ENV === 'production') {
        throw new Error('Localhost webhooks are not allowed in production.');
      }
    } catch (error) {
      throw new Error(`Invalid webhook URL: ${(error as Error).message}`);
    }
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Log webhook delivery
   */
  private async logWebhookDelivery(
    webhookId: string,
    event: string,
    success: boolean,
    attempts: number
  ): Promise<void> {
    const logKey = `webhook:log:${webhookId}:${Date.now()}`;
    const logData = {
      webhookId,
      event,
      success,
      attempts,
      timestamp: new Date().toISOString(),
    };

    await redis.setex(logKey, 86400 * 7, JSON.stringify(logData)); // Keep logs for 7 days
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Unregister webhook
   */
  async unregisterWebhook(webhookId: string, companyId: string): Promise<void> {
    await redis.del(`webhook:${webhookId}`);
    await redis.srem(`company:${companyId}:webhooks`, webhookId);
    console.log(`Webhook unregistered: ${webhookId}`);
  }

  /**
   * Get webhook status
   */
  async getWebhookStatus(webhookId: string): Promise<any> {
    const webhookDataStr = await redis.get(`webhook:${webhookId}`);
    if (!webhookDataStr) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }
    return JSON.parse(webhookDataStr);
  }
}

export default new WebhookService();
