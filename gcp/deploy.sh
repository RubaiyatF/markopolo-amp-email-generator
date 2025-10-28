#!/bin/bash
set -e

# GCP Deployment Script for AMP Email Platform
# This script deploys the application to Google Cloud Run

# ============================================================================
# Configuration
# ============================================================================
PROJECT_ID="${GCP_PROJECT_ID:-your-gcp-project-id}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="amp-email-platform"
IMAGE_NAME="amp-email/platform"
ARTIFACT_REGISTRY_REPO="amp-email"

# ============================================================================
# Colors for output
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Helper functions
# ============================================================================
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================================================
# Verify prerequisites
# ============================================================================
log_info "Verifying prerequisites..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    log_error "gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install it first."
    exit 1
fi

# Set the project
log_info "Setting GCP project to: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# ============================================================================
# Enable required APIs
# ============================================================================
log_info "Enabling required GCP APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com \
    compute.googleapis.com

# ============================================================================
# Create Artifact Registry repository
# ============================================================================
log_info "Creating Artifact Registry repository..."
if ! gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_REPO" \
    --location="$REGION" &> /dev/null; then
    gcloud artifacts repositories create "$ARTIFACT_REGISTRY_REPO" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Docker repository for AMP Email Platform"
    log_info "Artifact Registry repository created"
else
    log_info "Artifact Registry repository already exists"
fi

# ============================================================================
# Configure Docker authentication
# ============================================================================
log_info "Configuring Docker authentication..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev"

# ============================================================================
# Build Docker image
# ============================================================================
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${IMAGE_NAME}:latest"
log_info "Building Docker image: $IMAGE_TAG"
docker build -t "$IMAGE_TAG" .

# ============================================================================
# Push Docker image to Artifact Registry
# ============================================================================
log_info "Pushing Docker image to Artifact Registry..."
docker push "$IMAGE_TAG"

# ============================================================================
# Note: Cloudflare R2 Configuration
# ============================================================================
log_info "Using Cloudflare R2 for storage (no GCP bucket needed)"
log_info "Please ensure you have created an R2 bucket in Cloudflare Dashboard"
log_info "Bucket name should be: amp-email-templates-production"

# ============================================================================
# Create service account
# ============================================================================
SERVICE_ACCOUNT_NAME="amp-email-service-account"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

log_info "Creating service account: $SERVICE_ACCOUNT_NAME"
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &> /dev/null; then
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="AMP Email Platform Service Account"
    log_info "Service account created"
else
    log_info "Service account already exists"
fi

# Grant necessary permissions
log_info "Granting permissions to service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/secretmanager.secretAccessor"

# ============================================================================
# Create secrets in Secret Manager
# ============================================================================
log_info "Creating secrets in Secret Manager..."

create_secret() {
    local secret_name=$1
    local secret_value=$2

    if ! gcloud secrets describe "$secret_name" &> /dev/null; then
        echo -n "$secret_value" | gcloud secrets create "$secret_name" --data-file=-
        log_info "Created secret: $secret_name"
    else
        log_warn "Secret already exists: $secret_name"
    fi
}

# Note: Replace these with actual values or load from environment
# create_secret "database-url" "$DATABASE_URL"
# create_secret "redis-password" "$REDIS_PASSWORD"
# create_secret "replicate-api-key" "$REPLICATE_API_KEY"
# create_secret "jwt-secret" "$JWT_SECRET"
# create_secret "supabase-anon-key" "$SUPABASE_ANON_KEY"
# create_secret "supabase-service-role-key" "$SUPABASE_SERVICE_ROLE_KEY"

log_warn "Please create the following secrets manually or update the script with your values:"
log_warn "  - database-url"
log_warn "  - direct-url"
log_warn "  - redis-password"
log_warn "  - replicate-api-key"
log_warn "  - jwt-secret"
log_warn "  - supabase-anon-key"
log_warn "  - supabase-service-role-key"
log_warn "  - r2-account-id"
log_warn "  - r2-access-key-id"
log_warn "  - r2-secret-access-key"

# ============================================================================
# Deploy to Cloud Run
# ============================================================================
log_info "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_TAG" \
    --platform=managed \
    --region="$REGION" \
    --service-account="$SERVICE_ACCOUNT_EMAIL" \
    --allow-unauthenticated \
    --min-instances=1 \
    --max-instances=100 \
    --cpu=2 \
    --memory=2Gi \
    --timeout=300 \
    --concurrency=80 \
    --port=3000 \
    --set-env-vars="NODE_ENV=production,PORT=3000,GCP_PROJECT_ID=$PROJECT_ID,R2_BUCKET_NAME=amp-email-templates-production,CDN_BASE_URL=https://cdn.amp-platform.com" \
    --set-secrets="DATABASE_URL=database-url:latest,REDIS_PASSWORD=redis-password:latest,REPLICATE_API_KEY=replicate-api-key:latest,JWT_SECRET=jwt-secret:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,R2_ACCOUNT_ID=r2-account-id:latest,R2_ACCESS_KEY_ID=r2-access-key-id:latest,R2_SECRET_ACCESS_KEY=r2-secret-access-key:latest"

# ============================================================================
# Get service URL
# ============================================================================
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --platform=managed \
    --region="$REGION" \
    --format='value(status.url)')

log_info "Deployment complete!"
log_info "Service URL: $SERVICE_URL"
log_info "Health check: $SERVICE_URL/health"

# ============================================================================
# Test the deployment
# ============================================================================
log_info "Testing deployment..."
if curl -f -s "$SERVICE_URL/health" > /dev/null; then
    log_info "Health check passed!"
else
    log_warn "Health check failed. Please check the logs."
fi

log_info "View logs with: gcloud run services logs read $SERVICE_NAME --region=$REGION"
