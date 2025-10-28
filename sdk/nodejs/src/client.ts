/**
 * AMP Email API Client
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Product,
  CampaignContext,
  UserContext,
  BrandContext,
  GenerationOptions,
  Campaign,
  Template,
  BatchCampaignRequest,
  BatchCampaignResponse,
} from './types';
import { AMPEmailError, AuthenticationError, RateLimitError } from './errors';

export interface ClientConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
}

export class AMPEmailClient {
  private client: AxiosInstance;

  constructor(config: ClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.amp-platform.com',
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'amp-email-nodejs-sdk/1.0.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data as any;

          if (status === 401) {
            throw new AuthenticationError('Invalid API key');
          } else if (status === 429) {
            throw new RateLimitError('Rate limit exceeded');
          } else {
            throw new AMPEmailError(
              data?.message || `API error: ${status}`,
              status
            );
          }
        }
        throw new AMPEmailError(`Request failed: ${error.message}`);
      }
    );
  }

  /**
   * Generate AMP email templates
   */
  async generate(params: {
    productUrls?: string[];
    products?: Product[];
    campaignContext: CampaignContext;
    userContext?: UserContext;
    brandContext?: BrandContext;
    options?: GenerationOptions;
  }): Promise<Campaign> {
    if (!params.productUrls && !params.products) {
      throw new Error('Either productUrls or products must be provided');
    }

    const payload: any = {
      campaign_context: params.campaignContext,
    };

    if (params.productUrls) payload.product_urls = params.productUrls;
    if (params.products) payload.products = params.products;
    if (params.userContext) payload.user_context = params.userContext;
    if (params.brandContext) payload.brand_context = params.brandContext;
    if (params.options) payload.options = params.options;

    const response = await this.client.post<Campaign>('/api/v1/generate', payload);
    return response.data;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<Template> {
    const response = await this.client.get<Template>(`/api/v1/templates/${templateId}`);
    return response.data;
  }

  /**
   * Personalize template with recipient data
   */
  async personalize(
    templateId: string,
    recipientData: Record<string, any>
  ): Promise<{ personalizedHtml: string; mergeTagsApplied: number }> {
    const response = await this.client.post('/api/v1/personalize', {
      template_id: templateId,
      recipient_data: recipientData,
    });
    return response.data;
  }

  /**
   * Create batch campaign
   */
  async createBatchCampaign(
    params: BatchCampaignRequest
  ): Promise<BatchCampaignResponse> {
    const response = await this.client.post<BatchCampaignResponse>(
      '/api/v1/batch/campaign',
      params
    );
    return response.data;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<any> {
    const response = await this.client.get(`/api/v1/analytics/campaign/${campaignId}`);
    return response.data;
  }

  /**
   * Get company analytics
   */
  async getCompanyAnalytics(companyId: string): Promise<any> {
    const response = await this.client.get(`/api/v1/analytics/company/${companyId}`);
    return response.data;
  }
}
