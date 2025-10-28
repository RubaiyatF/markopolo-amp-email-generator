# AMP Email Generation API - Reference Documentation

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Standard Endpoints](#standard-endpoints)
- [Third-Party Compatible Endpoints](#third-party-compatible-endpoints)
- [Use Case Endpoints](#use-case-endpoints)
- [Analytics Endpoints](#analytics-endpoints)
- [Code Examples](#code-examples)

---

## Authentication

All API endpoints require authentication using an API Key passed as a Bearer token.

### Headers

```http
Authorization: Bearer YOUR_API_KEY_HERE
Content-Type: application/json
```

### Example Request

```bash
curl -X POST https://api.amp-platform.com/api/v1/generate \
  -H "Authorization: Bearer amp_key_abc123xyz" \
  -H "Content-Type: application/json" \
  -d '{"product_urls": ["https://example.com/product"]}'
```

### Getting an API Key

1. Sign up at the platform dashboard
2. Navigate to Settings → API Keys
3. Generate a new API key
4. Store securely (keys are only shown once)

---

## Rate Limiting

Rate limits are enforced per API key based on your plan tier:

| Plan | Per Minute | Per Hour | Per Day |
|------|-----------|----------|---------|
| Free | 10 | 100 | 1,000 |
| Starter | 60 | 1,000 | 10,000 |
| Growth | 300 | 5,000 | 50,000 |
| Enterprise | Unlimited | Unlimited | Unlimited |

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1638360000
```

### Rate Limit Exceeded Response

```json
{
  "error": "Rate Limit Exceeded",
  "message": "You have exceeded your rate limit of 60 requests per minute",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 30
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Error Name",
  "message": "Human-readable error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async processing) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid API key) |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Common Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `INVALID_API_KEY` - API key is invalid or expired
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INSUFFICIENT_CREDITS` - Account has insufficient credits
- `PRODUCT_EXTRACTION_FAILED` - Unable to extract product data
- `TEMPLATE_GENERATION_FAILED` - Template generation error
- `NOT_FOUND` - Resource not found

---

## Standard Endpoints

### POST /api/v1/generate

Generate AMP email templates from product URLs or data.

**Request Body**

```json
{
  "product_urls": [
    "https://example.com/product/1",
    "https://example.com/product/2"
  ],
  "campaign_context": {
    "type": "promotional",
    "goal": "conversion",
    "urgency": "high",
    "discount": 20
  },
  "user_context": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  },
  "brand_context": {
    "voice": "friendly and professional",
    "colors": ["#FF6B6B", "#4ECDC4"],
    "companyName": "Example Store"
  },
  "options": {
    "variations": 3,
    "preserve_merge_tags": true
  }
}
```

**Response (200 OK)**

```json
{
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "templates": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "variation_name": "Variation A",
      "amp_url": "https://cdn.amp-platform.com/templates/...",
      "fallback_url": "https://cdn.amp-platform.com/fallback/...",
      "content": {
        "subject": "Don't miss out! {{firstName}}",
        "preheader": "Special offer just for you",
        "body": "<amp-email>...</amp-email>"
      },
      "merge_tags": ["{{firstName}}", "{{email}}"]
    }
  ],
  "preview_urls": [
    {
      "variation": "Variation A",
      "url": "/api/v1/preview/660e8400-e29b-41d4-a716-446655440001"
    }
  ],
  "integration_code": {
    "sendgrid": "const msg = {...};",
    "resend": "await resend.emails.send({...});"
  },
  "cost": {
    "ai_generation": 0.0024,
    "product_scraping": 0.0003,
    "cdn_delivery": 0.0010,
    "total": 0.0037,
    "breakdown": {
      "ai_generation": "$0.002400",
      "product_scraping": "$0.000300",
      "cdn_delivery": "$0.001000",
      "total": "$0.003700"
    }
  },
  "metadata": {
    "generation_time_ms": 8500,
    "products_processed": 2,
    "variations_created": 3
  }
}
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_urls` | string[] | One of product_urls or products | URLs to extract product data from |
| `products` | Product[] | One of product_urls or products | Pre-extracted product data |
| `campaign_context` | object | Yes | Campaign type and goals |
| `campaign_context.type` | enum | Yes | `abandoned_cart`, `promotional`, `product_launch`, `price_drop`, `back_in_stock` |
| `campaign_context.goal` | enum | Yes | `acquisition`, `retention`, `engagement`, `conversion` |
| `campaign_context.urgency` | enum | No | `low`, `medium`, `high` |
| `campaign_context.discount` | number | No | Discount percentage (0-100) |
| `user_context` | object | No | Recipient personalization data |
| `brand_context` | object | No | Brand voice and styling |
| `options` | object | No | Generation options |
| `options.variations` | number | No | Number of variations (1-5, default: 3) |
| `options.preserve_merge_tags` | boolean | No | Keep merge tags unresolved (default: true) |

---

### POST /api/v1/batch/campaign

Process large-scale campaigns asynchronously (up to 10,000 products).

**Request Body**

```json
{
  "campaign_name": "Black Friday 2024",
  "product_urls": ["https://..."],
  "recipient_segments": [
    {
      "segment_id": "vip_customers",
      "count": 5000
    }
  ],
  "campaign_context": {
    "type": "promotional",
    "goal": "conversion"
  },
  "max_concurrent": 10,
  "chunk_size": 100,
  "webhook_url": "https://your-app.com/webhooks/batch-complete"
}
```

**Response (202 Accepted)**

```json
{
  "job_id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "queued",
  "tracking_url": "/api/v1/batch/status/770e8400-e29b-41d4-a716-446655440002",
  "estimated_time": "~15 minutes",
  "webhook_url": "https://your-app.com/webhooks/batch-complete"
}
```

---

### GET /api/v1/templates/{id}

Retrieve complete template details.

**Response (200 OK)**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "variation_name": "Variation A",
  "amp_url": "https://cdn.amp-platform.com/templates/...",
  "fallback_url": "https://cdn.amp-platform.com/fallback/...",
  "content": {
    "subject": "Don't miss out! {{firstName}}",
    "preheader": "Special offer just for you",
    "body": "<amp-email>...</amp-email>"
  },
  "merge_tags": ["{{firstName}}", "{{email}}"],
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### POST /api/v1/personalize

Apply recipient-specific data to template merge tags.

**Request Body**

```json
{
  "template_id": "660e8400-e29b-41d4-a716-446655440001",
  "recipient_data": {
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "discountCode": "SAVE20"
  },
  "preview_mode": false
}
```

**Response (200 OK)**

```json
{
  "personalized_html": "<amp-email>Don't miss out! Jane...</amp-email>",
  "merge_tags_applied": 4,
  "missing_fields": [],
  "template_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

---

### GET /api/v1/preview/{id}

Get browser-viewable HTML preview of template.

**Response (200 OK)**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Template Preview</title>
</head>
<body>
  <!-- AMP Email Content -->
</body>
</html>
```

---

## Third-Party Compatible Endpoints

### POST /api/v1/ml-compatible/generate-amp-content

AI agent compatible endpoint with standardized schema.

**Request Body**

```json
{
  "companyId": "company_123",
  "userId": "user_456",
  "channel": "email",
  "campaignContext": {
    "type": "promotional",
    "goal": "conversion"
  },
  "productContext": [
    {
      "name": "Product Name",
      "price": 99.99,
      "url": "https://example.com/product"
    }
  ],
  "userContext": {
    "firstName": "John",
    "email": "john@example.com"
  },
  "brandContext": {
    "voice": "professional",
    "companyName": "Example Corp"
  },
  "feedback": "Make it more urgent"
}
```

**Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "campaignId": "550e8400-e29b-41d4-a716-446655440000",
    "templates": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "variation_name": "Variation A",
        "content": {...}
      }
    ]
  },
  "metadata": {
    "generation_time_ms": 8500,
    "cost_usd": 0.0037
  }
}
```

---

### POST /api/v1/action-tree/generate-content

Multi-node workflow content generation.

**Request Body**

```json
{
  "companyId": "company_123",
  "userId": "user_456",
  "channel": "email",
  "campaignContext": {
    "type": "abandoned_cart",
    "goal": "conversion"
  },
  "actionTreeNodes": [
    {
      "id": "node_1",
      "description": "Initial cart reminder",
      "nodeType": "action",
      "indication": "email",
      "target": ["segment_a"],
      "nodeContext": {
        "purpose": "remind",
        "sequence": 1,
        "followUpNodes": ["node_2"]
      }
    },
    {
      "id": "node_2",
      "description": "Follow-up with discount",
      "nodeType": "action",
      "indication": "email",
      "target": ["segment_a"],
      "nodeContext": {
        "purpose": "convert",
        "sequence": 2
      }
    }
  ]
}
```

**Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "campaignId": "550e8400-e29b-41d4-a716-446655440000",
    "nodeContents": [
      {
        "nodeId": "node_1",
        "subject": "You left something in your cart!",
        "content": "<amp-email>...</amp-email>"
      },
      {
        "nodeId": "node_2",
        "subject": "Special 10% discount for you!",
        "content": "<amp-email>...</amp-email>"
      }
    ]
  }
}
```

---

## Use Case Endpoints

### POST /api/v1/use-cases/abandoned-cart/campaign

Generate cart recovery campaigns with automatic urgency and discount optimization.

**Request Body**

```json
{
  "cart_id": "cart_abc123",
  "user_email": "customer@example.com",
  "product_urls": [
    "https://example.com/product/1",
    "https://example.com/product/2"
  ],
  "abandoned_at": "2024-01-15T14:30:00Z",
  "cart_value": 249.99,
  "currency": "USD",
  "trigger_after_hours": 2,
  "discount_strategy": "auto"
}
```

**Response (200 OK)**

```json
{
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "urgency_level": "high",
  "discount_offered": 10,
  "discount_code": "CART10",
  "templates": [...],
  "estimated_recovery_rate": 0.18
}
```

---

### POST /api/v1/use-cases/product-launch/campaign

Generate product announcement campaigns.

**Request Body**

```json
{
  "product_urls": ["https://example.com/new-product"],
  "launch_date": "2024-02-01T00:00:00Z",
  "early_access": true,
  "highlight_features": [
    "Revolutionary design",
    "Industry-leading performance",
    "Limited edition"
  ],
  "pre_order_enabled": true
}
```

---

### POST /api/v1/use-cases/price-drop/alert

Generate price drop notifications.

**Request Body**

```json
{
  "product_url": "https://example.com/product/watch",
  "original_price": 299.99,
  "new_price": 199.99,
  "discount_percentage": 33,
  "limited_time": true,
  "stock_level": "low"
}
```

---

### POST /api/v1/use-cases/back-in-stock/notify

Generate back-in-stock waitlist alerts.

**Request Body**

```json
{
  "product_url": "https://example.com/product/sneakers",
  "waitlist_id": "waitlist_xyz789",
  "stock_quantity": 50,
  "notify_urgency": true,
  "related_products": [
    "https://example.com/product/socks"
  ]
}
```

---

## Analytics Endpoints

### GET /api/v1/analytics/campaign/{campaignId}

Get campaign-level analytics and metrics.

**Response (200 OK)**

```json
{
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_cost": 0.0111,
  "products_processed": 3,
  "templates_created": 9,
  "generation_time_ms": 12500,
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### GET /api/v1/analytics/company/{companyId}

Get company-wide aggregated analytics.

**Response (200 OK)**

```json
{
  "company_id": "company_123",
  "total_campaigns": 45,
  "total_templates": 135,
  "total_cost": 1.67,
  "avg_cost_per_campaign": 0.037,
  "avg_generation_time_ms": 9200,
  "date_range": {
    "from": "2024-01-01T00:00:00Z",
    "to": "2024-01-31T23:59:59Z"
  }
}
```

---

## Code Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_KEY = 'your_api_key_here';
const BASE_URL = 'https://api.amp-platform.com';

async function generateTemplates() {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/v1/generate`,
      {
        product_urls: ['https://example.com/product'],
        campaign_context: {
          type: 'promotional',
          goal: 'conversion'
        },
        options: {
          variations: 3
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Campaign ID:', response.data.campaign_id);
    console.log('Templates:', response.data.templates.length);
    
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

generateTemplates();
```

### Python

```python
import requests

API_KEY = 'your_api_key_here'
BASE_URL = 'https://api.amp-platform.com'

def generate_templates():
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'product_urls': ['https://example.com/product'],
        'campaign_context': {
            'type': 'promotional',
            'goal': 'conversion'
        },
        'options': {
            'variations': 3
        }
    }
    
    response = requests.post(
        f'{BASE_URL}/api/v1/generate',
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"Campaign ID: {data['campaign_id']}")
        print(f"Templates: {len(data['templates'])}")
        return data
    else:
        print(f"Error: {response.json()}")
        return None

generate_templates()
```

### cURL

```bash
curl -X POST https://api.amp-platform.com/api/v1/generate \
  -H "Authorization: Bearer your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "product_urls": ["https://example.com/product"],
    "campaign_context": {
      "type": "promotional",
      "goal": "conversion"
    },
    "options": {
      "variations": 3
    }
  }'
```

---

## Best Practices

### 1. Always Handle Errors

```javascript
try {
  const result = await generateTemplates();
} catch (error) {
  if (error.response?.status === 429) {
    // Rate limit exceeded - implement exponential backoff
    await sleep(error.response.data.retry_after * 1000);
    return retry();
  } else if (error.response?.status === 400) {
    // Validation error - check request format
    console.error('Validation errors:', error.response.data.details);
  } else {
    // Other errors
    console.error('Unexpected error:', error.message);
  }
}
```

### 2. Use Caching for Product Data

```javascript
// Cache product extractions to avoid redundant scraping
const productCache = new Map();

async function getProductData(url) {
  if (productCache.has(url)) {
    return productCache.get(url);
  }
  
  const data = await extractProduct(url);
  productCache.set(url, data);
  return data;
}
```

### 3. Implement Webhook Handling for Batch Jobs

```javascript
app.post('/webhooks/batch-complete', (req, res) => {
  const { job_id, status, campaign_id, templates } = req.body;
  
  if (status === 'completed') {
    console.log(`Batch job ${job_id} completed`);
    // Process templates
  } else if (status === 'failed') {
    console.error(`Batch job ${job_id} failed`);
    // Handle failure
  }
  
  res.sendStatus(200);
});
```

### 4. Preserve Merge Tags for ESP Integration

```javascript
// Always preserve merge tags in templates
{
  "options": {
    "preserve_merge_tags": true  // Keep {{firstName}}, {{email}}, etc.
  }
}
```

### 5. Monitor Costs

```javascript
let totalCost = 0;

const result = await generateTemplates();
totalCost += result.cost.total;

console.log(`Total spend today: $${totalCost.toFixed(4)}`);
```

---

## Support

- **Documentation**: https://docs.amp-platform.com
- **API Status**: https://status.amp-platform.com
- **Support Email**: support@amp-platform.com
- **GitHub Issues**: https://github.com/amp-platform/api/issues

---

**Last Updated**: January 2024  
**API Version**: v1.0.0
