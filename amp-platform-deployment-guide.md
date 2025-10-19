# AMP Email Platform - Deployment & Operations Guide

## Table of Contents
1. [Quick Start Guide](#1-quick-start-guide)
2. [Development Environment Setup](#2-development-environment-setup)
3. [Production Deployment](#3-production-deployment)
4. [Monitoring & Operations](#4-monitoring--operations)
5. [API Integration Examples](#5-api-integration-examples)
6. [Troubleshooting Guide](#6-troubleshooting-guide)
7. [Performance Optimization](#7-performance-optimization)
8. [Security Checklist](#8-security-checklist)

---

## 1. Quick Start Guide

### 1.1 Prerequisites
```bash
# Required tools
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- AWS CLI configured (or GCP SDK)
- Replicate API key
```

### 1.2 One-Command Local Setup
```bash
# Clone and setup
git clone https://github.com/yourorg/amp-email-platform.git
cd amp-email-platform

# Run setup script
./scripts/quick-start.sh
```

**quick-start.sh:**
```bash
#!/bin/bash
echo "🚀 AMP Email Platform Quick Start"

# Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo "Python 3 required"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }

# Setup Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup Node environment
cd dashboard
npm install
cd ..

# Create .env file
cp .env.example .env
echo "⚠️  Please edit .env file with your API keys"

# Start Docker services
docker-compose up -d

# Run database migrations
python manage.py migrate

# Start development server
python manage.py runserver &
cd dashboard && npm run dev &

echo "✅ Platform running at:"
echo "   API: http://localhost:8000"
echo "   Dashboard: http://localhost:3000"
echo "   Documentation: http://localhost:8000/docs"
```

### 1.3 First Template Generation
```bash
# Test API with curl
curl -X POST http://localhost:8000/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "use_case": "abandoned_cart",
    "prompt": "Create a friendly abandoned cart email",
    "email_platform": "sendgrid",
    "num_variations": 3
  }'
```

---

## 2. Development Environment Setup

### 2.1 Project Structure
```
amp-email-platform/
├── api/                      # Backend API
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI application
│   │   ├── models/          # Data models
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utilities
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── dashboard/               # Frontend dashboard
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Next.js pages
│   │   ├── services/       # API clients
│   │   └── styles/         # CSS/Tailwind
│   ├── public/
│   ├── package.json
│   └── Dockerfile
│
├── infrastructure/          # IaC and deployment
│   ├── terraform/          # Infrastructure as Code
│   ├── kubernetes/         # K8s manifests
│   └── docker/            # Docker configs
│
├── scripts/                # Utility scripts
│   ├── deploy.sh
│   ├── test.sh
│   └── backup.sh
│
├── docs/                   # Documentation
├── docker-compose.yml      # Local development
├── .github/               # GitHub Actions
└── README.md
```

### 2.2 Backend Setup (FastAPI)

**api/app/main.py:**
```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from .routes import generate, templates, platforms
from .services import replicate_service, storage_service
from .utils import logger

# Initialize FastAPI app
app = FastAPI(
    title="AMP Email Platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(generate.router, prefix="/api/v1")
app.include_router(templates.router, prefix="/api/v1")
app.include_router(platforms.router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting AMP Email Platform API")
    await replicate_service.initialize()
    await storage_service.initialize()
    
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "services": {
            "replicate": await replicate_service.check_health(),
            "storage": await storage_service.check_health()
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
```

### 2.3 Environment Configuration

**.env.example:**
```bash
# Application
APP_ENV=development
APP_DEBUG=true
APP_SECRET_KEY=your-secret-key-here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/amp_platform
REDIS_URL=redis://localhost:6379

# Replicate AI
REPLICATE_API_TOKEN=your-replicate-token

# Storage
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET_NAME=amp-email-templates
S3_REGION=us-east-1

# CDN
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_TOKEN=your-cf-token
CDN_BASE_URL=https://cdn.yourdomain.com

# Email Preview
PREVIEW_BASE_URL=https://preview.yourdomain.com

# Monitoring
SENTRY_DSN=your-sentry-dsn
DATADOG_API_KEY=your-datadog-key

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60
```

### 2.4 Docker Development Setup

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  # API Service
  api:
    build: 
      context: ./api
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    volumes:
      - ./api:/app
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/amp_platform
      - REDIS_URL=redis://redis:6379
      - REPLICATE_API_TOKEN=${REPLICATE_API_TOKEN}
    depends_on:
      - db
      - redis
    command: uvicorn app.main:app --host 0.0.0.0 --reload

  # Dashboard
  dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./dashboard:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    command: npm run dev

  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=amp_platform
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Redis Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # MinIO (Local S3)
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./infrastructure/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  postgres_data:
  redis_data:
  minio_data:
  prometheus_data:
  grafana_data:
```

---

## 3. Production Deployment

### 3.1 AWS Deployment with Terraform

**infrastructure/terraform/main.tf:**
```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "amp-platform-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "amp-platform-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
  
  tags = {
    Environment = "production"
    Project     = "amp-email-platform"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "amp-platform-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "amp-platform-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = module.vpc.public_subnets
  
  tags = {
    Name = "amp-platform-alb"
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "amp-platform-api"
  network_mode            = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                     = "1024"
  memory                  = "2048"
  
  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${var.ecr_repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 8000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "APP_ENV"
          value = "production"
        }
      ]
      
      secrets = [
        {
          name      = "REPLICATE_API_TOKEN"
          valueFrom = aws_secretsmanager_secret.replicate_token.arn
        },
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/amp-platform"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}

# RDS PostgreSQL
resource "aws_db_instance" "main" {
  identifier     = "amp-platform-db"
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = "db.t3.medium"
  
  allocated_storage     = 100
  storage_encrypted    = true
  
  db_name  = "amp_platform"
  username = "postgres"
  password = random_password.db_password.result
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = false
  
  tags = {
    Name = "amp-platform-db"
  }
}

# S3 Bucket for Templates
resource "aws_s3_bucket" "templates" {
  bucket = "amp-email-templates-${var.environment}"
  
  tags = {
    Name        = "AMP Email Templates"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "templates" {
  bucket = aws_s3_bucket.templates.id
  
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled    = true
  default_root_object = "index.html"
  
  origin {
    domain_name = aws_s3_bucket.templates.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.templates.id}"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }
  
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.templates.id}"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    cloudfront_default_certificate = true
  }
  
  tags = {
    Name = "amp-platform-cdn"
  }
}
```

### 3.2 Kubernetes Deployment

**infrastructure/kubernetes/deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: amp-platform-api
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: amp-platform-api
  template:
    metadata:
      labels:
        app: amp-platform-api
    spec:
      containers:
      - name: api
        image: your-registry/amp-platform-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: APP_ENV
          value: "production"
        - name: REPLICATE_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: amp-platform-secrets
              key: replicate-token
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: amp-platform-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: amp-platform-api
  namespace: production
spec:
  selector:
    app: amp-platform-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: amp-platform-api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: amp-platform-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 3.3 CI/CD Pipeline

**.github/workflows/deploy.yml:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: amp-platform-api

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        cd api
        pip install -r requirements.txt
        pip install pytest pytest-cov
    
    - name: Run tests
      run: |
        cd api
        pytest tests/ --cov=app --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./api/coverage.xml

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build, tag, and push API image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: ${{ github.sha }}
      run: |
        cd api
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to ECS
      run: |
        aws ecs update-service \
          --cluster amp-platform-cluster \
          --service amp-platform-api \
          --force-new-deployment \
          --region ${{ env.AWS_REGION }}
    
    - name: Wait for deployment
      run: |
        aws ecs wait services-stable \
          --cluster amp-platform-cluster \
          --services amp-platform-api \
          --region ${{ env.AWS_REGION }}
    
    - name: Notify Slack
      uses: slackapi/slack-github-action@v1.24.0
      with:
        webhook-url: ${{ secrets.SLACK_WEBHOOK }}
        payload: |
          {
            "text": "Deployment Complete",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "✅ *AMP Platform deployed to production*\nCommit: `${{ github.sha }}`\nDeployed by: ${{ github.actor }}"
                }
              }
            ]
          }
```

---

## 4. Monitoring & Operations

### 4.1 Monitoring Setup

**infrastructure/monitoring/prometheus.yml:**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'amp-platform-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'
  
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
  
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - '/etc/prometheus/alerts/*.yml'
```

### 4.2 Grafana Dashboard Configuration

**grafana-dashboard.json:**
```json
{
  "dashboard": {
    "title": "AMP Platform Monitoring",
    "panels": [
      {
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Template Generation Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, template_generation_duration_seconds)",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Replicate API Costs",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(replicate_api_cost_dollars)",
            "legendFormat": "Total Cost ($)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_errors_total[5m])",
            "legendFormat": "{{status_code}}"
          }
        ]
      }
    ]
  }
}
```

### 4.3 Logging Configuration

**api/app/utils/logger.py:**
```python
import logging
import json
from pythonjsonlogger import jsonlogger

def setup_logger():
    """Configure structured logging"""
    
    logger = logging.getLogger("amp_platform")
    logger.setLevel(logging.INFO)
    
    # JSON formatter for production
    formatter = jsonlogger.JsonFormatter(
        '%(timestamp)s %(level)s %(name)s %(message)s',
        timestamp=True
    )
    
    # Console handler
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    # Add context processor
    def add_context(record):
        record['service'] = 'amp-platform-api'
        record['environment'] = os.getenv('APP_ENV', 'development')
        record['version'] = '1.0.0'
        return True
    
    logger.addFilter(add_context)
    
    return logger

logger = setup_logger()
```

---

## 5. API Integration Examples

### 5.1 Python SDK

**python-sdk/amp_email_client.py:**
```python
import requests
from typing import Optional, List, Dict
import asyncio
import aiohttp

class AMPEmailClient:
    """Python SDK for AMP Email Platform"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.amp-platform.com"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def generate_template(
        self,
        use_case: str,
        prompt: str,
        email_platform: str = "sendgrid",
        num_variations: int = 3,
        screenshots: Optional[List[str]] = None,
        product_urls: Optional[List[str]] = None
    ) -> Dict:
        """
        Generate AMP email templates
        
        Args:
            use_case: Type of email (abandoned_cart, newsletter, etc.)
            prompt: Natural language description
            email_platform: Target platform (sendgrid, resend, aws_ses, custom)
            num_variations: Number of A/B test variations
            screenshots: Optional list of base64 encoded images
            product_urls: Optional list of product URLs
        
        Returns:
            Dictionary containing campaign_id, template URLs, and integration code
        """
        
        payload = {
            "use_case": use_case,
            "prompt": prompt,
            "email_platform": email_platform,
            "num_variations": num_variations
        }
        
        if screenshots:
            payload["screenshots"] = screenshots
        if product_urls:
            payload["product_urls"] = product_urls
        
        response = requests.post(
            f"{self.base_url}/api/v1/generate",
            json=payload,
            headers=self.headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"API Error: {response.status_code} - {response.text}")
    
    def get_template(self, campaign_id: str, variation_id: Optional[str] = None) -> Dict:
        """Retrieve template content"""
        
        url = f"{self.base_url}/api/v1/templates/{campaign_id}"
        if variation_id:
            url += f"?variation_id={variation_id}"
        
        response = requests.get(url, headers=self.headers)
        return response.json()
    
    def personalize(self, campaign_id: str, data: Dict) -> Dict:
        """Apply personalization to template"""
        
        response = requests.post(
            f"{self.base_url}/api/v1/templates/{campaign_id}/personalize",
            json=data,
            headers=self.headers
        )
        return response.json()
    
    async def generate_bulk(self, requests_list: List[Dict]) -> List[Dict]:
        """Generate multiple templates in parallel"""
        
        async with aiohttp.ClientSession() as session:
            tasks = []
            for req in requests_list:
                task = self._async_generate(session, req)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks)
            return results
    
    async def _async_generate(self, session: aiohttp.ClientSession, request_data: Dict):
        """Async template generation"""
        
        async with session.post(
            f"{self.base_url}/api/v1/generate",
            json=request_data,
            headers=self.headers
        ) as response:
            return await response.json()


# Example usage
if __name__ == "__main__":
    # Initialize client
    client = AMPEmailClient(api_key="your-api-key")
    
    # Generate abandoned cart email
    result = client.generate_template(
        use_case="abandoned_cart",
        prompt="Create a friendly reminder for abandoned shoes in cart",
        email_platform="sendgrid",
        num_variations=3,
        product_urls=[
            "https://shop.example.com/shoes/nike-air-max",
            "https://shop.example.com/shoes/adidas-ultraboost"
        ]
    )
    
    print(f"Campaign ID: {result['campaign']['campaign_id']}")
    print(f"Preview URL: {result['campaign']['preview_url']}")
    
    # Get SendGrid integration code
    platform_config = result['campaign']['platform_config']
    print(f"SendGrid Integration:\n{platform_config['sdk_example']}")
    
    # Personalize template
    personalized = client.personalize(
        campaign_id=result['campaign']['campaign_id'],
        data={
            "customerName": "John Doe",
            "cartTotal": "$149.99",
            "discount": "20%"
        }
    )
    
    # Send with SendGrid (example)
    import sendgrid
    sg = sendgrid.SendGridAPIClient(api_key='your-sendgrid-key')
    
    message = sendgrid.Mail(
        from_email='store@example.com',
        to_emails='customer@example.com',
        subject='You left something in your cart!'
    )
    
    message.add_content(
        sendgrid.Content("text/x-amp-html", personalized['amp_html'])
    )
    message.add_content(
        sendgrid.Content("text/html", personalized['fallback_html'])
    )
    
    response = sg.send(message)
    print(f"Email sent: {response.status_code}")
```

### 5.2 Node.js SDK

**nodejs-sdk/index.js:**
```javascript
const axios = require('axios');

class AMPEmailClient {
  constructor(apiKey, baseUrl = 'https://api.amp-platform.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async generateTemplate(options) {
    const {
      useCase,
      prompt,
      emailPlatform = 'sendgrid',
      numVariations = 3,
      screenshots = [],
      productUrls = []
    } = options;

    const response = await axios.post(
      `${this.baseUrl}/api/v1/generate`,
      {
        use_case: useCase,
        prompt,
        email_platform: emailPlatform,
        num_variations: numVariations,
        screenshots,
        product_urls: productUrls
      },
      { headers: this.headers }
    );

    return response.data;
  }

  async getTemplate(campaignId, variationId = null) {
    const url = `${this.baseUrl}/api/v1/templates/${campaignId}${
      variationId ? `?variation_id=${variationId}` : ''
    }`;
    
    const response = await axios.get(url, { headers: this.headers });
    return response.data;
  }

  async personalize(campaignId, data) {
    const response = await axios.post(
      `${this.baseUrl}/api/v1/templates/${campaignId}/personalize`,
      data,
      { headers: this.headers }
    );
    
    return response.data;
  }
}

// Example usage with SendGrid
async function sendAbandonedCartEmail() {
  // Initialize AMP Platform client
  const ampClient = new AMPEmailClient('your-api-key');
  
  // Generate template
  const result = await ampClient.generateTemplate({
    useCase: 'abandoned_cart',
    prompt: 'Friendly reminder for abandoned shoes',
    emailPlatform: 'sendgrid',
    productUrls: ['https://shop.example.com/shoes/nike']
  });
  
  console.log('Campaign ID:', result.campaign.campaign_id);
  
  // Personalize
  const personalized = await ampClient.personalize(
    result.campaign.campaign_id,
    {
      customerName: 'Jane Smith',
      cartTotal: '$89.99',
      discount: '15%'
    }
  );
  
  // Send with SendGrid
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey('your-sendgrid-key');
  
  const msg = {
    to: 'customer@example.com',
    from: 'store@example.com',
    subject: 'You left something behind!',
    content: [
      {
        type: 'text/x-amp-html',
        value: personalized.amp_html
      },
      {
        type: 'text/html',
        value: personalized.fallback_html
      }
    ]
  };
  
  await sgMail.send(msg);
  console.log('Email sent successfully');
}

module.exports = AMPEmailClient;
```

---

## 6. Troubleshooting Guide

### 6.1 Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Replicate API Rate Limit** | 429 errors, slow generation | Implement caching, use batch processing, upgrade Replicate plan |
| **Template Too Large** | Email rejected by client | Optimize images, minify HTML, remove unused CSS |
| **AMP Validation Fails** | Templates not rendering | Use AMP validator, check component versions |
| **CDN Cache Issues** | Old templates served | Purge CDN cache, check cache headers |
| **Database Connection Pool** | Timeouts, connection errors | Increase pool size, optimize queries |
| **Memory Leaks** | Increasing memory usage | Profile application, fix circular references |
| **Slow Template Generation** | >30s generation time | Optimize prompts, use faster models, implement queuing |

### 6.2 Debugging Commands

```bash
# Check API health
curl https://api.yourdomain.com/health

# Test Replicate connection
python -c "import replicate; print(replicate.Client().models.list())"

# Validate AMP template
curl -X POST https://validator.ampproject.org/validate \
  -H "Content-Type: text/html" \
  --data-binary @template.html

# Check S3 connectivity
aws s3 ls s3://amp-email-templates/ --profile production

# Monitor Redis
redis-cli ping
redis-cli info stats

# Database connections
psql -h localhost -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Container logs
docker logs amp-platform-api --tail 100 -f

# Kubernetes pods
kubectl get pods -n production
kubectl logs -f deployment/amp-platform-api -n production

# Check CDN cache status
curl -I https://cdn.yourdomain.com/template.html
```

---

## 7. Performance Optimization

### 7.1 Caching Strategy

```python
# Redis caching implementation
import redis
import hashlib
import json
from functools import wraps

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def cache_result(expiration=3600):
    """Cache decorator for expensive operations"""
    
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{func.__name__}:{hashlib.md5(str(args).encode()).hexdigest()}"
            
            # Check cache
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            redis_client.setex(
                cache_key,
                expiration,
                json.dumps(result)
            )
            
            return result
        return wrapper
    return decorator

# Usage
@cache_result(expiration=7200)
async def generate_template(context):
    # Expensive template generation
    pass
```

### 7.2 Database Optimization

```sql
-- Indexes for common queries
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX idx_templates_campaign_id ON templates(campaign_id);
CREATE INDEX idx_generation_logs_created_at ON generation_logs(created_at DESC);

-- Partitioning for large tables
CREATE TABLE generation_logs_2024 PARTITION OF generation_logs
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Query optimization
EXPLAIN ANALYZE
SELECT c.*, array_agg(t.*) as templates
FROM campaigns c
LEFT JOIN templates t ON t.campaign_id = c.id
WHERE c.user_id = 'user_123'
GROUP BY c.id
ORDER BY c.created_at DESC
LIMIT 10;
```

---

## 8. Security Checklist

### 8.1 Security Best Practices

- [ ] **API Security**
  - [ ] Implement rate limiting
  - [ ] Use API key rotation
  - [ ] Enable CORS properly
  - [ ] Validate all inputs
  - [ ] Sanitize user content

- [ ] **Data Security**
  - [ ] Encrypt data at rest (AES-256)
  - [ ] Use TLS 1.3 for transit
  - [ ] Implement field-level encryption for PII
  - [ ] Regular security audits
  - [ ] GDPR compliance

- [ ] **Infrastructure Security**
  - [ ] Network segmentation
  - [ ] WAF configuration
  - [ ] DDoS protection
  - [ ] Regular security updates
  - [ ] Secrets management (Vault/Secrets Manager)

- [ ] **Monitoring**
  - [ ] Security event logging
  - [ ] Anomaly detection
  - [ ] Failed authentication tracking
  - [ ] Regular vulnerability scans
  - [ ] Incident response plan

### 8.2 Security Headers

```python
# Security headers middleware
from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()

# Security headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response

# Trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["api.amp-platform.com", "*.amp-platform.com"]
)
```

---

## Quick Reference Card

### API Endpoints
```bash
POST   /api/v1/generate              # Generate templates
GET    /api/v1/templates/{id}        # Get template
POST   /api/v1/templates/{id}/personalize  # Personalize
GET    /api/v1/platforms/{platform}/integration  # Get integration code
GET    /api/v1/templates/{id}/preview  # Preview template
GET    /health                       # Health check
GET    /metrics                      # Prometheus metrics
```

### Environment Variables
```bash
REPLICATE_API_TOKEN    # Required
DATABASE_URL           # Required
REDIS_URL              # Required
S3_BUCKET_NAME         # Required
CDN_BASE_URL          # Required
SENTRY_DSN            # Optional
```

### Useful Commands
```bash
# Local development
docker-compose up -d
npm run dev
python manage.py runserver

# Production deployment
./scripts/deploy.sh production
kubectl apply -f k8s/
terraform apply

# Monitoring
kubectl logs -f deployment/api
docker logs api --tail 100
tail -f /var/log/amp-platform/api.log
```

---

*Last Updated: November 2024*
*Version: 1.0.0*
*Status: Production Ready*