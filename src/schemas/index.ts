import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  images: z.array(z.string().url()).optional(), // Array of product images from extract.pics
  url: z.string().url().optional(),
  link: z.string().url().optional(),
  description: z.string().optional(),
  brand: z.string().optional()
});

export const CampaignContextSchema = z.object({
  type: z.enum(['abandoned_cart', 'promotional', 'product_launch', 'price_drop', 'back_in_stock']),
  goal: z.enum(['acquisition', 'retention', 'engagement', 'conversion']),
  urgency: z.enum(['low', 'medium', 'high']).optional(),
  discount: z.number().optional()
});

export const UserContextSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  customFields: z.record(z.string(), z.any()).optional()
});

export const BrandContextSchema = z.object({
  voice: z.string().optional(),
  colors: z.array(z.string()).optional(),
  logo: z.string().url().optional(),
  companyName: z.string().optional()
});

export const GenerationOptionsSchema = z.object({
  variations: z.number().min(1).max(5).default(3),
  preserve_merge_tags: z.boolean().optional().default(true),
  // Replicate AI media generation options
  enable_media_generation: z.boolean().optional().default(true),
  upscale_images: z.boolean().optional().default(true),
  enhance_images: z.boolean().optional().default(false),
  generate_gif: z.boolean().optional().default(false),
  generate_video: z.boolean().optional().default(false)
});

export const GenerateRequestSchema = z.object({
  product_urls: z.array(z.string().url()).optional(),
  products: z.array(ProductSchema).optional(),
  campaign_context: CampaignContextSchema,
  user_context: UserContextSchema.optional(),
  brand_context: BrandContextSchema.optional(),
  options: GenerationOptionsSchema.optional()
}).refine(
  (data) => data.product_urls || data.products,
  { message: 'Either product_urls or products must be provided' }
);

export const BatchCampaignRequestSchema = z.object({
  campaign_name: z.string(),
  product_urls: z.array(z.string().url()).max(10000),
  recipient_segments: z.array(z.any()).optional(),
  campaign_context: CampaignContextSchema,
  max_concurrent: z.number().min(1).max(50).default(10),
  chunk_size: z.number().min(10).max(500).default(100),
  webhook_url: z.string().url().optional()
});

export const PersonalizeRequestSchema = z.object({
  template_id: z.string().uuid(),
  recipient_data: z.record(z.string(), z.any()),
  preview_mode: z.boolean().default(false)
});

export const ActionTreeNodeSchema = z.object({
  id: z.string(),
  description: z.string(),
  nodeType: z.enum(['action', 'condition', 'wait']),
  indication: z.enum(['email', 'sms', 'push']),
  target: z.array(z.string()),
  nodeContext: z.object({
    purpose: z.string().optional(),
    sequence: z.number().optional(),
    followUpNodes: z.array(z.string()).optional()
  }).optional()
});

export const MLCompatibleRequestSchema = z.object({
  companyId: z.string(),
  userId: z.string(),
  channel: z.literal('email'),
  campaignContext: CampaignContextSchema,
  actionTreeNodes: z.array(ActionTreeNodeSchema).optional(),
  userContext: UserContextSchema.optional(),
  brandContext: BrandContextSchema.optional(),
  productContext: z.array(ProductSchema).optional(),
  contentHistory: z.any().optional(),
  feedback: z.string().optional()
});

export const AbandonedCartRequestSchema = z.object({
  cart_id: z.string(),
  user_email: z.string().email(),
  product_urls: z.array(z.string().url()),
  abandoned_at: z.string().datetime(),
  cart_value: z.number().positive(),
  currency: z.string().length(3),
  trigger_after_hours: z.number().default(2),
  discount_strategy: z.enum(['auto', 'fixed', 'percentage', 'none']).default('none')
});

export const ProductLaunchRequestSchema = z.object({
  product_urls: z.array(z.string().url()),
  launch_date: z.string().datetime(),
  early_access: z.boolean().default(false),
  highlight_features: z.array(z.string()).optional(),
  pre_order_enabled: z.boolean().default(false)
});

export const PriceDropRequestSchema = z.object({
  product_url: z.string().url(),
  original_price: z.number().positive(),
  new_price: z.number().positive(),
  discount_percentage: z.number().optional(),
  limited_time: z.boolean().default(false),
  stock_level: z.enum(['low', 'medium', 'high']).optional()
});

export const BackInStockRequestSchema = z.object({
  product_url: z.string().url(),
  waitlist_id: z.string(),
  stock_quantity: z.number().optional(),
  notify_urgency: z.boolean().default(false),
  related_products: z.array(z.string().url()).optional()
});

export type Product = z.infer<typeof ProductSchema>;
export type CampaignContext = z.infer<typeof CampaignContextSchema>;
export type UserContext = z.infer<typeof UserContextSchema>;
export type BrandContext = z.infer<typeof BrandContextSchema>;
export type GenerationOptions = z.infer<typeof GenerationOptionsSchema>;
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type BatchCampaignRequest = z.infer<typeof BatchCampaignRequestSchema>;
export type PersonalizeRequest = z.infer<typeof PersonalizeRequestSchema>;
export type ActionTreeNode = z.infer<typeof ActionTreeNodeSchema>;
export type MLCompatibleRequest = z.infer<typeof MLCompatibleRequestSchema>;
export type AbandonedCartRequest = z.infer<typeof AbandonedCartRequestSchema>;
export type ProductLaunchRequest = z.infer<typeof ProductLaunchRequestSchema>;
export type PriceDropRequest = z.infer<typeof PriceDropRequestSchema>;
export type BackInStockRequest = z.infer<typeof BackInStockRequestSchema>;
