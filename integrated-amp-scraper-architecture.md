# Integrated AMP Email Platform with Product Scraper API

## Executive Summary

By integrating your Product Scraper API with the AMP Email Template Platform, we create a powerful system that automatically:
1. **Extracts product data** from any e-commerce URL
2. **Generates AMP email templates** with real product information
3. **Creates variations** for A/B testing with actual product images
4. **Hosts templates** on CDN for any email service provider

## Enhanced System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INPUT LAYER                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Screenshots  │  │ Product URLs │  │   Prompt     │           │
│  │  (Optional)  │  │  (Required)  │  │  (Required)  │           │
│  └──────────────┘  └──────┬───────┘  └──────────────┘           │
│                            │                                       │
└────────────────────────────┼───────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PRODUCT SCRAPER API LAYER                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │            Product Scraper API (Your Service)               │  │
│  │                                                             │  │
│  │  • Universal Site Support (10,000+ sites)                  │  │
│  │  • AI-Powered Extraction (Groq/Gemini)                     │  │
│  │  • Smart Proxy Management                                  │  │
│  │  • Category-Aware (Electronics, Fashion, etc.)             │  │
│  │  • Image Upload to GCS                                     │  │
│  │  • $0.00 LLM Cost (Free Tier)                             │  │
│  │                                                             │  │
│  │  Endpoint: /knowledge-base/enriched-extract                │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                            │                                       │
│                            ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                  Extracted Product Data                     │  │
│  │  • Product Name, Price, Currency                           │  │
│  │  • Images (GCS URLs), Description                          │  │
│  │  • Reviews, Ratings, Specifications                        │  │
│  │  • Category-Specific Fields                                │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  AMP TEMPLATE GENERATION LAYER                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Context Builder (Enhanced)                      │  │
│  │                                                             │  │
│  │  Combines:                                                 │  │
│  │  • Product Data from Scraper                               │  │
│  │  • Screenshots for Design Analysis                          │  │
│  │  • User Prompt Requirements                                 │  │
│  │  • Use Case (abandoned_cart, product_launch, etc.)         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                            │                                       │
│                            ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │           AI Template Generation (Replicate)                │  │
│  │                                                             │  │
│  │  • AMP HTML Generation (Mixtral-8x7B)                      │  │
│  │  • HTML Fallback Creation                                  │  │
│  │  • 3-5 Variations with Product Data                        │  │
│  │  • Dynamic Product Carousels                               │  │
│  │  • Real-time Inventory Integration                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    HOSTING & DELIVERY LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Template Storage (S3)                                           │
│  • CDN Distribution (CloudFlare)                                   │
│  • Platform Adapters (SendGrid, Resend, AWS SES)                  │
│  • Preview & Testing                                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Integration Implementation

### 1. Enhanced Template Generator with Product Scraper

```python
from fastapi import FastAPI, HTTPException
from typing import List, Dict, Optional
import httpx
import asyncio
from datetime import datetime

class IntegratedAMPGenerator:
    """
    AMP Template Generator integrated with Product Scraper API
    """
    
    def __init__(self):
        self.scraper_api_url = "https://product-scraper-217130114839.us-east1.run.app"
        self.replicate_client = replicate.Client(api_token=REPLICATE_TOKEN)
        
    async def generate_campaign_from_urls(
        self,
        product_urls: List[str],
        use_case: str,
        prompt: str,
        email_platform: str = "sendgrid",
        num_variations: int = 3
    ) -> Dict:
        """
        Generate AMP email campaign from product URLs
        """
        
        campaign_id = f"campaign_{uuid.uuid4().hex[:12]}"
        
        # Step 1: Scrape product data from URLs
        print(f"📦 Scraping {len(product_urls)} products...")
        products = await self.scrape_products(product_urls)
        
        # Step 2: Analyze screenshots if provided for design context
        brand_context = await self.analyze_brand_context(products)
        
        # Step 3: Generate AMP templates with real product data
        templates = await self.generate_templates_with_products(
            products=products,
            brand_context=brand_context,
            use_case=use_case,
            prompt=prompt,
            num_variations=num_variations
        )
        
        # Step 4: Host templates on CDN
        hosted_urls = await self.host_templates(campaign_id, templates)
        
        # Step 5: Format for email platform
        platform_config = self.format_for_platform(
            hosted_urls,
            email_platform,
            products
        )
        
        return {
            "campaign_id": campaign_id,
            "products_scraped": len(products),
            "templates": hosted_urls,
            "platform_config": platform_config,
            "products": products,
            "total_cost": self.calculate_total_cost(products, templates)
        }
    
    async def scrape_products(self, urls: List[str]) -> List[Dict]:
        """
        Scrape product data using Product Scraper API
        """
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            if len(urls) > 1:
                # Use bulk endpoint for multiple products
                response = await client.post(
                    f"{self.scraper_api_url}/knowledge-base/bulk-enriched-extract",
                    json={
                        "links": urls,
                        "company_id": "amp-platform",
                        "max_concurrent": 5
                    }
                )
            else:
                # Single product endpoint
                response = await client.post(
                    f"{self.scraper_api_url}/knowledge-base/enriched-extract",
                    json={
                        "link": urls[0],
                        "category": self.detect_category(urls[0])
                    }
                )
                
        if response.status_code == 200:
            data = response.json()
            return data.get("products", [data]) if len(urls) > 1 else [data]
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Product scraping failed: {response.text}"
            )
    
    async def generate_templates_with_products(
        self,
        products: List[Dict],
        brand_context: Dict,
        use_case: str,
        prompt: str,
        num_variations: int
    ) -> Dict:
        """
        Generate AMP templates with scraped product data
        """
        
        # Create rich prompt with actual product information
        enhanced_prompt = f"""
        Create an AMP email template for {use_case}.
        
        User Requirements: {prompt}
        
        ACTUAL PRODUCTS TO INCLUDE:
        {self.format_products_for_prompt(products)}
        
        BRAND CONTEXT:
        - Primary Colors: {brand_context.get('colors', [])}
        - Style: {brand_context.get('style', 'modern')}
        
        REQUIREMENTS:
        1. Use amp-carousel for product showcase with these exact products
        2. Include actual prices and images from the data
        3. Add amp-list for real-time inventory check
        4. Create amp-form for quick checkout
        5. Use actual product descriptions and reviews
        
        Generate complete AMP HTML with:
        - Product cards using the scraped images
        - Accurate pricing (${products[0].get('price', 0)} {products[0].get('currency', 'USD')})
        - Real product names and descriptions
        - Review snippets if available
        """
        
        # Generate base template
        base_template = await self.generate_amp_template(enhanced_prompt)
        
        # Generate variations
        variations = await self.generate_variations(
            base_template,
            products,
            num_variations
        )
        
        return {
            "base": base_template,
            "variations": variations,
            "products_included": len(products)
        }
    
    def format_products_for_prompt(self, products: List[Dict]) -> str:
        """
        Format scraped products for LLM prompt
        """
        
        formatted = []
        for i, product in enumerate(products[:5], 1):  # Limit to 5 products
            formatted.append(f"""
        Product {i}:
        - Name: {product.get('product_name', 'Unknown')}
        - Price: {product.get('currency', '$')}{product.get('price', 0)}
        - Description: {product.get('description', '')[:200]}
        - Image: {product.get('images', [''])[0] if product.get('images') else ''}
        - Rating: {product.get('ratings_average', 0)}/5 ({product.get('ratings_count', 0)} reviews)
        - In Stock: {product.get('is_available', True)}
            """)
        
        return "\n".join(formatted)
    
    def calculate_total_cost(self, products: List[Dict], templates: Dict) -> Dict:
        """
        Calculate total cost including scraping and generation
        """
        
        scraping_cost = sum(p.get('extraction_cost', 0) for p in products)
        template_cost = 0.0006 * (1 + len(templates.get('variations', [])))
        
        return {
            "scraping": scraping_cost,
            "template_generation": template_cost,
            "total": scraping_cost + template_cost,
            "per_email": (scraping_cost + template_cost) / max(1, len(products))
        }
```

### 2. API Endpoints for Integrated System

```python
@app.post("/api/v1/generate-from-products")
async def generate_from_product_urls(
    product_urls: List[str],
    use_case: str = "abandoned_cart",
    prompt: str = "Create an engaging email",
    email_platform: str = "sendgrid",
    num_variations: int = 3,
    auto_personalize: bool = True
):
    """
    Generate AMP email templates from product URLs
    """
    
    generator = IntegratedAMPGenerator()
    
    try:
        # Generate campaign with scraped products
        result = await generator.generate_campaign_from_urls(
            product_urls=product_urls,
            use_case=use_case,
            prompt=prompt,
            email_platform=email_platform,
            num_variations=num_variations
        )
        
        # Auto-personalize if requested
        if auto_personalize:
            result["personalization_fields"] = [
                "customerName",
                "cartTotal",
                "abandonedDate",
                "discountCode"
            ]
        
        return {
            "success": True,
            "campaign": result,
            "message": f"Generated {num_variations} templates with {len(result['products'])} products",
            "preview_url": f"https://preview.yourdomain.com/{result['campaign_id']}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/enrich-template")
async def enrich_existing_template(
    template_id: str,
    product_urls: List[str]
):
    """
    Enrich an existing template with fresh product data
    """
    
    generator = IntegratedAMPGenerator()
    
    # Scrape latest product data
    products = await generator.scrape_products(product_urls)
    
    # Get existing template
    template = await get_template(template_id)
    
    # Update with fresh data
    enriched_template = await generator.update_template_with_products(
        template,
        products
    )
    
    return {
        "template_id": template_id,
        "products_updated": len(products),
        "enriched_template": enriched_template
    }
```

### 3. Use Cases with Product Scraper Integration

#### Use Case 1: Abandoned Cart Recovery

```python
async def generate_abandoned_cart_email(cart_urls: List[str], customer_id: str):
    """
    Generate abandoned cart email from actual cart products
    """
    
    generator = IntegratedAMPGenerator()
    
    # Scrape current product data (prices may have changed!)
    products = await generator.scrape_products(cart_urls)
    
    # Check for price changes
    price_alerts = []
    for product in products:
        if product.get('original_price') and product['price'] < product['original_price']:
            price_alerts.append({
                "product": product['product_name'],
                "discount": product['original_price'] - product['price']
            })
    
    # Generate template with urgency if prices dropped
    prompt = "Create urgent abandoned cart email"
    if price_alerts:
        prompt += f" highlighting price drops: {price_alerts}"
    
    result = await generator.generate_campaign_from_urls(
        product_urls=cart_urls,
        use_case="abandoned_cart",
        prompt=prompt,
        num_variations=3
    )
    
    return result
```

#### Use Case 2: Product Launch Campaign

```python
async def generate_product_launch_email(new_product_urls: List[str]):
    """
    Generate product launch email with fresh product data
    """
    
    generator = IntegratedAMPGenerator()
    
    # Scrape new products
    products = await generator.scrape_products(new_product_urls)
    
    # Extract key features for highlighting
    key_features = []
    for product in products:
        if product.get('specifications'):
            key_features.append({
                "product": product['product_name'],
                "highlight": product['specifications'][:100]
            })
    
    result = await generator.generate_campaign_from_urls(
        product_urls=new_product_urls,
        use_case="product_launch",
        prompt=f"Showcase new products with features: {key_features}",
        num_variations=5  # More variations for testing
    )
    
    return result
```

#### Use Case 3: Dynamic Price Alert

```python
async def generate_price_drop_alert(tracked_urls: List[str]):
    """
    Generate price drop alert email
    """
    
    generator = IntegratedAMPGenerator()
    
    # Scrape current prices
    current_products = await generator.scrape_products(tracked_urls)
    
    # Filter only products with price drops
    discounted = [
        p for p in current_products 
        if p.get('original_price') and p['price'] < p['original_price']
    ]
    
    if discounted:
        result = await generator.generate_campaign_from_urls(
            product_urls=[p['url'] for p in discounted],
            use_case="price_alert",
            prompt=f"Create urgency for {len(discounted)} discounted items",
            num_variations=2
        )
        
        return result
```

### 4. Complete Integration Example

```python
# Example: E-commerce Integration
import asyncio
from datetime import datetime

async def automated_campaign_generation():
    """
    Complete example of automated email campaign generation
    """
    
    # 1. Get products from your database or scrape from URLs
    product_urls = [
        "https://www.amazon.com/dp/B09KMRWYYJ/",  # Electronics
        "https://www.etsy.com/listing/123456789/",  # Fashion
        "https://www.walmart.com/ip/example/12345"  # Home
    ]
    
    # 2. Initialize integrated generator
    generator = IntegratedAMPGenerator()
    
    # 3. Scrape product data
    print("📦 Scraping products...")
    products = await generator.scrape_products(product_urls)
    
    for product in products:
        print(f"  ✓ {product['product_name']}: ${product['price']}")
        print(f"    Images: {len(product.get('images', []))}")
        print(f"    Rating: {product.get('ratings_average', 'N/A')}/5")
    
    # 4. Generate AMP email campaign
    print("\n🎨 Generating AMP templates...")
    campaign = await generator.generate_campaign_from_urls(
        product_urls=product_urls,
        use_case="promotional",
        prompt="Create a flash sale email with countdown timer",
        email_platform="sendgrid",
        num_variations=3
    )
    
    print(f"  ✓ Campaign ID: {campaign['campaign_id']}")
    print(f"  ✓ Templates generated: {len(campaign['templates']['variations']) + 1}")
    print(f"  ✓ Total cost: ${campaign['total_cost']['total']:.4f}")
    
    # 5. Get SendGrid integration code
    sendgrid_config = campaign['platform_config']
    print(f"\n📧 SendGrid Integration:")
    print(f"  Template URL: {campaign['templates']['base']['amp']}")
    
    # 6. Send test email
    if SEND_TEST_EMAIL:
        import sendgrid
        
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        
        # Fetch and personalize template
        personalized = await generator.personalize_template(
            campaign_id=campaign['campaign_id'],
            data={
                "customerName": "John Doe",
                "flashSaleEnd": "2024-12-31T23:59:59",
                "discountCode": "FLASH20"
            }
        )
        
        message = sendgrid.Mail(
            from_email='store@example.com',
            to_emails='test@example.com',
            subject='Flash Sale - Items from Your Wishlist!'
        )
        
        message.add_content(
            sendgrid.Content("text/x-amp-html", personalized['amp_html'])
        )
        message.add_content(
            sendgrid.Content("text/html", personalized['fallback_html'])
        )
        
        response = sg.send(message)
        print(f"  ✓ Test email sent: {response.status_code}")
    
    return campaign

# Run the example
if __name__ == "__main__":
    campaign = asyncio.run(automated_campaign_generation())
    print(f"\n✅ Campaign ready: {campaign['campaign_id']}")
```

### 5. Docker Compose for Both Services

```yaml
version: '3.8'

services:
  # Product Scraper Service
  product-scraper:
    image: product-scraper:latest
    ports:
      - "5000:5000"
    environment:
      - GROQ_API_KEY=${GROQ_API_KEY}
      - TOGETHER_API_KEY=${TOGETHER_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - BRIGHTDATA_CUSTOMER_ID=${BRIGHTDATA_CUSTOMER_ID}
      - BRIGHTDATA_PASSWORD=${BRIGHTDATA_PASSWORD}
      - SMART_PROXY_ENABLED=true
      - CACHE_ENABLED=true
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # AMP Template Generator
  amp-generator:
    build: ./amp-platform
    ports:
      - "8000:8000"
    environment:
      - REPLICATE_API_TOKEN=${REPLICATE_API_TOKEN}
      - PRODUCT_SCRAPER_URL=http://product-scraper:5000
      - DATABASE_URL=postgresql://postgres:password@db:5432/amp_platform
      - REDIS_URL=redis://redis:6379
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - CDN_BASE_URL=${CDN_BASE_URL}
    depends_on:
      - product-scraper
      - db
      - redis

  # Shared Redis Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # Database for AMP Platform
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=amp_platform
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - product-scraper
      - amp-generator

volumes:
  redis_data:
  postgres_data:
```

### 6. Cost Analysis with Integration

```yaml
Per Email Campaign (10 products):
  Product Scraping:
    - LLM Cost: $0.00 (free tier)
    - Proxy Cost: ~$0.002 (20% need proxy)
    - Total: ~$0.002
  
  Template Generation:
    - Base Template: $0.0006
    - 3 Variations: $0.0018
    - Total: ~$0.0024
  
  Hosting:
    - CDN: ~$0.001
    - Storage: ~$0.0001
    - Total: ~$0.0011
  
  Grand Total: ~$0.0055 per campaign
  
  At Scale (1000 campaigns/month):
    - Scraping: ~$2.00
    - Generation: ~$2.40
    - Hosting: ~$1.10
    - Total: ~$5.50/month
```

## Benefits of Integration

### 1. **Automatic Product Updates**
- Real-time prices
- Current availability
- Latest reviews
- Fresh images

### 2. **Zero Manual Work**
- No need to copy product data
- No image uploading
- Automatic categorization
- Smart field detection

### 3. **Enhanced Personalization**
- Price drop alerts
- Stock warnings
- Review highlights
- Specification matching

### 4. **Multi-Platform Support**
- Works with any e-commerce site
- Consistent data structure
- Automatic image hosting
- Universal compatibility

### 5. **Cost Efficiency**
- $0.00 LLM costs for scraping
- Minimal template generation cost
- Shared infrastructure
- Unified caching

## Quick Start with Integration

```bash
# 1. Clone both services
git clone <amp-platform-repo>
git clone <product-scraper-repo>

# 2. Set environment variables
export GROQ_API_KEY=your_groq_key
export REPLICATE_API_TOKEN=your_replicate_token

# 3. Start services
docker-compose up -d

# 4. Test integration
curl -X POST http://localhost:8000/api/v1/generate-from-products \
  -H "Content-Type: application/json" \
  -d '{
    "product_urls": [
      "https://www.amazon.com/dp/B09KMRWYYJ/"
    ],
    "use_case": "abandoned_cart",
    "email_platform": "sendgrid"
  }'
```

## Integration Architecture Diagram

```
User Provides URLs → Product Scraper API → Extracts Product Data
                                              ↓
                                    [Product JSON + Images]
                                              ↓
                          AMP Template Generator ← Design Context
                                              ↓
                               [Personalized AMP Templates]
                                              ↓
                                      CDN Hosting
                                              ↓
                              Email Service Provider
```

This integration creates a powerful, automated email generation system that combines real product data with intelligent template generation, all at minimal cost!