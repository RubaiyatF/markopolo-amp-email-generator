# Quick Start Guide - AMP Email Generation API

Get started with the AMP Email Generation API in less than 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose installed
- Git installed

## Step 1: Clone and Install (1 minute)

```bash
# Clone the repository
git clone <repository-url>
cd amp-email-platform

# Install dependencies
npm install
```

## Step 2: Start Services (1 minute)

```bash
# Start PostgreSQL, Redis, and API server
docker-compose up -d

# Check if services are running
docker-compose ps
```

## Step 3: Initialize Database (1 minute)

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Open Prisma Studio to add a test API key
npm run prisma:studio
```

## Step 4: Create Test API Key (1 minute)

In Prisma Studio (opens in browser):

1. Go to "companies" table
2. Click "Add record"
3. Fill in:
   - `companyId`: test-company
   - `apiKey`: amp_key_test123456789
   - `planType`: free
4. Click "Save 1 change"

## Step 5: Test the API (1 minute)

```bash
# Test health endpoint
curl http://localhost:3000/health

# Generate a template
curl -X POST http://localhost:3000/api/v1/generate \
  -H "Authorization: Bearer amp_key_test123456789" \
  -H "Content-Type: application/json" \
  -d '{
    "product_urls": ["https://www.amazon.com/dp/B09KMRWYYJ"],
    "campaign_context": {
      "type": "promotional",
      "goal": "conversion"
    },
    "options": {
      "variations": 3
    }
  }'
```

## Success! 🎉

You should see a JSON response with:
- `campaign_id`
- `templates` array with 3 variations
- `preview_urls`
- `cost` breakdown

## Next Steps

- Read the [Setup Guide](../SETUP-GUIDE.md) for detailed configuration
- Explore the [API Documentation](../README.md#api-documentation)
- Check out [Use Cases](./USE-CASES.md)
- Review [Integration Examples](./INTEGRATIONS.md)

## Troubleshooting

**Port already in use:**
```bash
# Change ports in docker-compose.yml
# Or stop conflicting services
```

**Database connection error:**
```bash
# Restart PostgreSQL
docker-compose restart postgres
```

**API key not working:**
```bash
# Verify in Prisma Studio
npm run prisma:studio
# Check companies table
```

## Quick Commands Reference

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f api

# Restart API only
docker-compose restart api

# Access database
npm run prisma:studio

# Check API health
curl http://localhost:3000/health
```

That's it! You're ready to generate AMP email templates.
