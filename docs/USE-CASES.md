# Use Cases Guide - AMP Email Generation API

## Overview

This guide demonstrates common use cases and real-world scenarios for the AMP Email Generation API.

## Use Case 1: Abandoned Cart Recovery

### Scenario
Customer adds items to cart but doesn't complete purchase. Send automated recovery email with urgency messaging.

### Implementation

```javascript
const axios = require('axios');

async function sendAbandonedCartEmail(cartData) {
  const response = await axios.post(
    'http://localhost:3000/api/v1/use-cases/abandoned-cart/campaign',
    {
      cart_id: cartData.id,
      user_email: cartData.userEmail,
      product_urls: cartData.productUrls,
      abandoned_at: cartData.abandonedAt,
      cart_value: cartData.totalValue,
      currency: 'USD',
      trigger_after_hours: 2,
      discount_strategy: 'auto'
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  const { campaign_id, urgency_level, discount_offered, templates } = response.data;
  
  console.log(`Campaign created: ${campaign_id}`);
  console.log(`Urgency: ${urgency_level}, Discount: ${discount_offered}%`);
  
  // Send template A to user
  await sendEmail(cartData.userEmail, templates[0]);
}

// Example usage
sendAbandonedCartEmail({
  id: 'cart_123',
  userEmail: 'customer@example.com',
  productUrls: [
    'https://amazon.com/product1',
    'https://amazon.com/product2'
  ],
  abandonedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  totalValue: 149.99
});
```

### Expected Results
- Urgency level calculated based on time since abandonment
- Automatic discount offered (5-15% based on urgency)
- 3 template variations for A/B testing
- Subject lines optimized for cart recovery

## Use Case 2: Product Launch Campaign

### Scenario
Launch new product with announcement email to subscriber list.

### Implementation

```javascript
async function launchProductCampaign(productData) {
  const response = await axios.post(
    'http://localhost:3000/api/v1/use-cases/product-launch/campaign',
    {
      product_urls: [productData.url],
      launch_date: productData.launchDate,
      early_access: true,
      highlight_features: productData.keyFeatures,
      pre_order_enabled: true
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  const { templates } = response.data;
  
  // Send to VIP list first (early access)
  for (const vip of vipSubscribers) {
    await sendEmail(vip.email, templates[0]);
  }
  
  // Schedule regular announcement
  scheduleEmail(productData.launchDate, regularSubscribers, templates[1]);
}
```

## Use Case 3: Price Drop Alert

### Scenario
Monitor product prices and notify subscribers when price drops.

### Implementation

```javascript
async function sendPriceDropAlert(product, subscribers) {
  const response = await axios.post(
    'http://localhost:3000/api/v1/use-cases/price-drop/alert',
    {
      product_url: product.url,
      original_price: product.originalPrice,
      new_price: product.currentPrice,
      limited_time: true,
      stock_level: 'low'
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  const { discount_percentage, savings, templates } = response.data;
  
  console.log(`Price dropped ${discount_percentage}%! Save $${savings}`);
  
  // Send to all subscribers on waitlist
  for (const subscriber of subscribers) {
    await sendEmail(subscriber.email, templates[0]);
  }
}
```

## Use Case 4: Back in Stock Notification

### Scenario
Product goes out of stock. Notify waitlist subscribers when it's available again.

### Implementation

```javascript
async function notifyBackInStock(product, waitlist) {
  const response = await axios.post(
    'http://localhost:3000/api/v1/use-cases/back-in-stock/notify',
    {
      product_url: product.url,
      waitlist_id: waitlist.id,
      stock_quantity: product.stockLevel,
      notify_urgency: product.stockLevel < 10,
      related_products: product.alternatives
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  const { templates } = response.data;
  
  // Send to waitlist in order of signup
  for (const subscriber of waitlist.subscribers) {
    await sendEmail(subscriber.email, templates[0]);
  }
}
```

## Use Case 5: Batch Campaign for Multiple Products

### Scenario
Create promotional campaign for entire product catalog (1000+ products).

### Implementation

```javascript
async function createBatchCampaign(products) {
  const response = await axios.post(
    'http://localhost:3000/api/v1/batch/campaign',
    {
      campaign_name: 'Summer Sale 2024',
      product_urls: products.map(p => p.url),
      campaign_context: {
        type: 'promotional',
        goal: 'conversion'
      },
      max_concurrent: 10,
      chunk_size: 100,
      webhook_url: 'https://myapp.com/webhook/batch-complete'
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  const { job_id, tracking_url } = response.data;
  
  console.log(`Batch job started: ${job_id}`);
  console.log(`Track progress at: ${tracking_url}`);
  
  // Poll for completion
  await pollJobStatus(job_id);
}

async function pollJobStatus(jobId) {
  const response = await axios.get(
    `http://localhost:3000/api/v1/batch/status/${jobId}`,
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  console.log(`Progress: ${response.data.progress}%`);
  
  if (response.data.status !== 'completed') {
    await new Promise(resolve => setTimeout(resolve, 5000));
    return pollJobStatus(jobId);
  }
}
```

## Use Case 6: Personalized Product Recommendations

### Scenario
Send personalized product recommendations based on user purchase history.

### Implementation

```javascript
async function sendPersonalizedRecommendations(user) {
  // Generate template with merge tags
  const response = await axios.post(
    'http://localhost:3000/api/v1/generate',
    {
      products: user.recommendedProducts,
      campaign_context: {
        type: 'promotional',
        goal: 'engagement'
      },
      user_context: {
        firstName: '{{firstName}}',
        email: '{{email}}',
        lastPurchase: '{{lastPurchase}}'
      },
      options: {
        variations: 3,
        preserve_merge_tags: true
      }
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  const template = response.data.templates[0];
  
  // Personalize for user
  const personalizedResponse = await axios.post(
    'http://localhost:3000/api/v1/personalize',
    {
      template_id: template.id,
      recipient_data: {
        firstName: user.firstName,
        email: user.email,
        lastPurchase: user.lastPurchaseDate
      }
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  await sendEmail(user.email, personalizedResponse.data.personalized_content);
}
```

## Use Case 7: Multi-Step Email Workflow

### Scenario
Create automated email sequence: Welcome → Product intro → Follow-up → Conversion.

### Implementation

```javascript
async function createEmailWorkflow(newSubscriber) {
  const response = await axios.post(
    'http://localhost:3000/api/v1/action-tree/generate-content',
    {
      companyId: 'your-company',
      userId: newSubscriber.id,
      channel: 'email',
      campaignContext: {
        type: 'promotional',
        goal: 'conversion'
      },
      actionTreeNodes: [
        {
          id: 'welcome',
          description: 'Welcome email',
          nodeType: 'action',
          indication: 'email',
          target: ['new_subscribers'],
          nodeContext: {
            purpose: 'Welcome new subscriber',
            sequence: 1,
            followUpNodes: ['product-intro']
          }
        },
        {
          id: 'product-intro',
          description: 'Product introduction',
          nodeType: 'action',
          indication: 'email',
          target: ['new_subscribers'],
          nodeContext: {
            purpose: 'Introduce key products',
            sequence: 2,
            followUpNodes: ['conversion']
          }
        },
        {
          id: 'conversion',
          description: 'Conversion offer',
          nodeType: 'action',
          indication: 'email',
          target: ['new_subscribers'],
          nodeContext: {
            purpose: 'Special offer for first purchase',
            sequence: 3
          }
        }
      ],
      productContext: newSubscriber.recommendedProducts
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  const { nodeContents } = response.data.data;
  
  // Schedule emails
  await scheduleEmail(Date.now(), newSubscriber.email, nodeContents[0].content);
  await scheduleEmail(Date.now() + 86400000, newSubscriber.email, nodeContents[1].content); // +1 day
  await scheduleEmail(Date.now() + 259200000, newSubscriber.email, nodeContents[2].content); // +3 days
}
```

## Use Case 8: Product Monitoring with Webhooks

### Scenario
Monitor competitor prices and automatically send alerts when they drop.

### Implementation

```javascript
// Register webhook
async function setupPriceMonitoring(competitorProducts) {
  for (const product of competitorProducts) {
    await axios.post(
      'http://localhost:3000/api/v1/webhooks/register',
      {
        product_url: product.url,
        webhook_url: 'https://myapp.com/webhook/price-change',
        triggers: ['price_drop', 'back_in_stock']
      },
      {
        headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
      }
    );
  }
}

// Handle webhook callback
app.post('/webhook/price-change', async (req, res) => {
  const { event_type, product_data, changes } = req.body;
  
  if (event_type === 'price_drop') {
    // Generate price alert
    const response = await axios.post(
      'http://localhost:3000/api/v1/use-cases/price-drop/alert',
      {
        product_url: product_data.url,
        original_price: changes.old_price,
        new_price: changes.new_price
      },
      {
        headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
      }
    );
    
    // Send to subscribers
    await notifySubscribers(response.data.templates[0]);
  }
  
  res.json({ received: true });
});
```

## Use Case 9: A/B Testing Email Templates

### Scenario
Test multiple template variations to optimize conversion rates.

### Implementation

```javascript
async function runABTest(campaign) {
  // Generate 5 variations
  const response = await axios.post(
    'http://localhost:3000/api/v1/generate',
    {
      product_urls: campaign.productUrls,
      campaign_context: campaign.context,
      options: {
        variations: 5
      }
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  const templates = response.data.templates;
  
  // Split audience into 5 equal groups
  const groups = splitAudience(campaign.subscribers, 5);
  
  // Send different variation to each group
  for (let i = 0; i < groups.length; i++) {
    for (const subscriber of groups[i]) {
      await sendEmail(subscriber.email, templates[i]);
      await trackSend(subscriber.id, templates[i].id);
    }
  }
  
  // Analyze results after 24 hours
  setTimeout(() => analyzeABTestResults(campaign.id), 86400000);
}
```

## Use Case 10: Seasonal Campaign Automation

### Scenario
Automatically create and send holiday/seasonal campaigns.

### Implementation

```javascript
async function createSeasonalCampaign(season, products) {
  const response = await axios.post(
    'http://localhost:3000/api/v1/generate',
    {
      product_urls: products.map(p => p.url),
      campaign_context: {
        type: 'promotional',
        goal: 'conversion'
      },
      brand_context: {
        voice: season === 'christmas' ? 'festive and warm' : 'energetic',
        colors: season === 'christmas' ? ['#C41E3A', '#0C6B29'] : ['#FF6B35', '#004E89']
      },
      options: {
        variations: 3
      }
    },
    {
      headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
    }
  );
  
  return response.data.templates;
}

// Schedule seasonal campaigns
const campaigns = [
  { date: '2024-12-01', season: 'christmas', products: winterProducts },
  { date: '2024-07-01', season: 'summer', products: summerProducts },
  { date: '2024-02-01', season: 'valentines', products: giftProducts }
];

for (const campaign of campaigns) {
  scheduleJob(campaign.date, () => createSeasonalCampaign(campaign.season, campaign.products));
}
```

## Best Practices

### 1. Error Handling
Always implement retry logic and error handling:

```javascript
async function generateWithRetry(config, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await axios.post('http://localhost:3000/api/v1/generate', config, {
        headers: { 'Authorization': `Bearer ${process.env.AMP_API_KEY}` }
      });
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### 2. Rate Limiting
Respect rate limits and implement backoff:

```javascript
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'];
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
}
```

### 3. Cost Monitoring
Track costs per campaign:

```javascript
const response = await generateTemplate(config);
const cost = response.data.cost.total;
await logCost(campaignId, cost);
```

### 4. Template Caching
Cache templates for similar campaigns:

```javascript
const cacheKey = JSON.stringify(config);
let templates = await cache.get(cacheKey);
if (!templates) {
  templates = await generateTemplate(config);
  await cache.set(cacheKey, templates, 3600); // 1 hour
}
```

## Support

For more examples and support:
- API Documentation: README.md
- Integration Guide: docs/INTEGRATIONS.md
- Setup Guide: SETUP-GUIDE.md
