/**
 * Type definitions for AMP Email SDK
 */

export type CampaignType = 
  | 'abandoned_cart'
  | 'promotional'
  | 'product_launch'
  | 'price_drop'
  | 'back_in_stock';

export type CampaignGoal = 
  | 'acquisition'
  | 'retention'
  | 'engagement'
  | 'conversion';

export type Urgency = 'low' | 'medium' | 'high';

export interface Product {
  id?: string;
  name?: string;
  price?: number | string;
  currency?: string;
  image?: string;
  url?: string;
  description?: string;
  brand?: string;
}

export interface CampaignContext {
  type: CampaignType;
  goal: CampaignGoal;
  urgency?: Urgency;
  discount?: number;
}

export interface UserContext {
  firstName?: string;
  lastName?: string;
  email?: string;
  customFields?: Record<string, any>;
}

export interface BrandContext {
  voice?: string;
  colors?: string[];
  logo?: string;
  companyName?: string;
}

export interface GenerationOptions {
  variations?: number;
  preserveMergeTags?: boolean;
}

export interface Template {
  id: string;
  variationName: string;
  ampUrl: string;
  fallbackUrl: string;
  content: {
    subject: string;
    preheader: string;
    body: string;
  };
  mergeTags: string[];
}

export interface Campaign {
  campaignId: string;
  templates: Template[];
  previewUrls: Array<{
    variation: string;
    url: string;
  }>;
  cost: {
    aiGeneration: number;
    productScraping: number;
    cdnDelivery: number;
    total: number;
  };
  metadata: {
    generationTimeMs: number;
    productsProcessed: number;
    variationsCreated: number;
  };
}

export interface BatchCampaignRequest {
  campaignName: string;
  productUrls: string[];
  campaignContext: CampaignContext;
  maxConcurrent?: number;
  chunkSize?: number;
  webhookUrl?: string;
}

export interface BatchCampaignResponse {
  jobId: string;
  status: string;
  trackingUrl: string;
  estimatedTime: string;
  webhookUrl?: string;
}
