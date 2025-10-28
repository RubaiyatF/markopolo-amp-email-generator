# Integration Guide - AMP Email Generation API

## Overview

This guide shows how to integrate the AMP Email Generation API with popular Email Service Providers (ESPs) and marketing automation platforms.

## SendGrid Integration

### Setup

```bash
npm install @sendgrid/mail
```

### Basic Integration

```javascript
const sgMail = require('@sendgrid/mail');
const axios = require('axios');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Step 1: Generate template via AMP API
const ampResponse = await axios.post('http://localhost:3000/api/v1/generate', {
  product_urls: ['https://amazon.com/product'],
  campaign_context: { type: 'promotional', goal: 'conversion' }
}, {
  headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
});

const template = ampResponse.data.templates[0];

// Step 2: Send via SendGrid
const msg = {
  to: 'customer@example.com',
  from: 'your-email@yourdomain.com',
  subject: template.content.subject,
  html: template.content.body,
  ampHtml: template.content.body
};

await sgMail.send(msg);
```

### Advanced: Dynamic Templates

```javascript
// Create SendGrid dynamic template with AMP content URL
const msg = {
  to: 'customer@example.com',
  from: 'your-email@yourdomain.com',
  templateId: 'd-xxxxxxxxxxxxx',
  dynamicTemplateData: {
    amp_content_url: template.amp_url,
    subject: template.content.subject,
    firstName: 'John'
  }
};
```

## Resend Integration

### Setup

```bash
npm install resend
```

### Implementation

```javascript
import { Resend } from 'resend';
import axios from 'axios';

const resend = new Resend(process.env.RESEND_API_KEY);

// Generate template
const ampResponse = await axios.post('http://localhost:3000/api/v1/generate', {
  product_urls: ['https://shopify.com/product'],
  campaign_context: { type: 'abandoned_cart', goal: 'conversion' },
  user_context: { firstName: 'Jane', email: 'jane@example.com' }
}, {
  headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
});

const template = ampResponse.data.templates[0];

// Send email
await resend.emails.send({
  from: 'noreply@yourdomain.com',
  to: 'jane@example.com',
  subject: template.content.subject,
  html: template.content.body
});
```

## AWS SES Integration

### Setup

```bash
npm install @aws-sdk/client-ses
```

### Implementation

```javascript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import axios from 'axios';

const sesClient = new SESClient({ region: 'us-east-1' });

// Generate template
const ampResponse = await axios.post('http://localhost:3000/api/v1/generate', {
  products: [{
    name: 'Product Name',
    price: 99.99,
    image: 'https://example.com/image.jpg'
  }],
  campaign_context: { type: 'product_launch', goal: 'acquisition' }
}, {
  headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
});

const template = ampResponse.data.templates[0];

// Send via SES
const command = new SendEmailCommand({
  Source: 'sender@yourdomain.com',
  Destination: { ToAddresses: ['recipient@example.com'] },
  Message: {
    Subject: { Data: template.content.subject },
    Body: {
      Html: { Data: template.content.body }
    }
  }
});

await sesClient.send(command);
```

## Mailchimp Integration

### Using Mailchimp API

```javascript
const mailchimp = require('@mailchimp/mailchimp_marketing');
const axios = require('axios');

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: 'us1'
});

// Generate template
const ampResponse = await axios.post('http://localhost:3000/api/v1/generate', {
  product_urls: ['https://example.com/product'],
  campaign_context: { type: 'promotional', goal: 'engagement' }
}, {
  headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
});

const template = ampResponse.data.templates[0];

// Create campaign
const campaign = await mailchimp.campaigns.create({
  type: 'regular',
  recipients: { list_id: 'your-list-id' },
  settings: {
    subject_line: template.content.subject,
    from_name: 'Your Company',
    reply_to: 'reply@yourdomain.com'
  }
});

// Set content
await mailchimp.campaigns.setContent(campaign.id, {
  html: template.content.body
});
```

## Klaviyo Integration

### Using Klaviyo API

```javascript
const axios = require('axios');

const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;

// Generate template
const ampResponse = await axios.post('http://localhost:3000/api/v1/generate', {
  product_urls: ['https://shopify.com/product'],
  campaign_context: { type: 'abandoned_cart', goal: 'conversion' },
  user_context: { email: 'customer@example.com', firstName: 'John' }
}, {
  headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
});

const template = ampResponse.data.templates[0];

// Send via Klaviyo
await axios.post('https://a.klaviyo.com/api/v1/email', {
  token: KLAVIYO_API_KEY,
  email: 'customer@example.com',
  properties: {
    subject: template.content.subject,
    html: template.content.body,
    from_email: 'noreply@yourdomain.com',
    from_name: 'Your Store'
  }
});
```

## Webhook Integration

### Setup Webhook for Product Changes

```javascript
// Register webhook
await axios.post('http://localhost:3000/api/v1/webhooks/register', {
  product_url: 'https://amazon.com/product',
  webhook_url: 'https://your-app.com/webhook/price-change',
  triggers: ['price_drop', 'back_in_stock']
}, {
  headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
});

// Handle webhook callback
app.post('/webhook/price-change', async (req, res) => {
  const { event_type, product_data, changes } = req.body;
  
  if (event_type === 'price_drop') {
    // Generate price drop email
    const ampResponse = await axios.post('http://localhost:3000/api/v1/use-cases/price-drop/alert', {
      product_url: product_data.url,
      original_price: changes.old_price,
      new_price: changes.new_price
    }, {
      headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
    });
    
    // Send to subscribers
    await sendToSubscribers(ampResponse.data.templates[0]);
  }
  
  res.json({ received: true });
});
```

## Batch Processing Integration

### Process Multiple Products

```javascript
const axios = require('axios');

// Submit batch campaign
const batchResponse = await axios.post('http://localhost:3000/api/v1/batch/campaign', {
  campaign_name: 'Black Friday 2024',
  product_urls: [
    'https://amazon.com/product1',
    'https://amazon.com/product2',
    // ... up to 10,000 URLs
  ],
  campaign_context: { type: 'promotional', goal: 'conversion' },
  webhook_url: 'https://your-app.com/webhook/batch-complete'
}, {
  headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
});

const { job_id, tracking_url } = batchResponse.data;

// Poll for status
const checkStatus = async () => {
  const statusResponse = await axios.get(tracking_url, {
    headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
  });
  
  console.log(`Progress: ${statusResponse.data.progress}%`);
  
  if (statusResponse.data.status !== 'completed') {
    setTimeout(checkStatus, 5000); // Check every 5 seconds
  }
};

checkStatus();
```

## Third-Party AI Agent Integration

### ML-Compatible Endpoint

```javascript
// For AI agents and marketing automation platforms
const response = await axios.post('http://localhost:3000/api/v1/ml-compatible/generate-amp-content', {
  companyId: 'your-company-id',
  userId: 'user-123',
  channel: 'email',
  campaignContext: {
    type: 'promotional',
    goal: 'conversion'
  },
  actionTreeNodes: [
    {
      id: 'node-1',
      description: 'Initial email',
      nodeType: 'action',
      indication: 'email',
      target: ['segment-a'],
      nodeContext: {
        purpose: 'Product introduction',
        sequence: 1
      }
    }
  ],
  productContext: [{
    name: 'Product Name',
    price: 99.99,
    url: 'https://example.com/product'
  }]
}, {
  headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
});

const { campaignId, nodeContents } = response.data.data;
```

## Personalization at Send Time

### Apply Recipient Data

```javascript
// Generate template with merge tags
const templateResponse = await axios.post('http://localhost:3000/api/v1/generate', {
  product_urls: ['https://example.com/product'],
  campaign_context: { type: 'promotional', goal: 'conversion' },
  user_context: {
    firstName: '{{firstName}}',
    email: '{{email}}'
  },
  options: { preserve_merge_tags: true }
}, {
  headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
});

const template = templateResponse.data.templates[0];

// Personalize for each recipient
for (const recipient of recipients) {
  const personalizedResponse = await axios.post('http://localhost:3000/api/v1/personalize', {
    template_id: template.id,
    recipient_data: {
      firstName: recipient.firstName,
      email: recipient.email,
      lastPurchase: recipient.lastPurchase
    }
  }, {
    headers: { 'Authorization': `Bearer ${AMP_API_KEY}` }
  });
  
  // Send personalized email
  await sendEmail(recipient.email, personalizedResponse.data.personalized_content);
}
```

## Error Handling Best Practices

```javascript
const generateTemplate = async (productUrls) => {
  try {
    const response = await axios.post('http://localhost:3000/api/v1/generate', {
      product_urls: productUrls,
      campaign_context: { type: 'promotional', goal: 'conversion' }
    }, {
      headers: { 'Authorization': `Bearer ${AMP_API_KEY}` },
      timeout: 30000 // 30 second timeout
    });
    
    return response.data;
    
  } catch (error) {
    if (error.response?.status === 429) {
      // Rate limit exceeded
      const retryAfter = error.response.headers['retry-after'];
      console.log(`Rate limited. Retry after ${retryAfter} seconds`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return generateTemplate(productUrls); // Retry
      
    } else if (error.response?.status === 401) {
      // Invalid API key
      throw new Error('Invalid API key');
      
    } else {
      // Other errors
      console.error('Template generation failed:', error.message);
      throw error;
    }
  }
};
```

## Testing Integration

```javascript
// Test in development
const AMP_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.amp-platform.com'
  : 'http://localhost:3000';

// Mock for testing
if (process.env.NODE_ENV === 'test') {
  // Use mock responses
  const mockTemplate = {
    id: 'mock-id',
    content: {
      subject: 'Test Subject',
      body: '<html>Test</html>'
    }
  };
}
```

## Support

For integration support:
- Check API documentation: README.md
- Review error codes and responses
- Contact support: support@amp-platform.com
