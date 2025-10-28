# GCP Deployment Script for AMP Email Platform (PowerShell)
# This script deploys the application to Google Cloud Run

param(
    [string]$ProjectId = $env:GCP_PROJECT_ID,
    [string]$Region = "us-central1"
)

# ============================================================================
# Configuration
# ============================================================================
$ServiceName = "amp-email-platform"
$ImageName = "amp-email/platform"
$ArtifactRegistryRepo = "amp-email"
$BucketName = "amp-email-templates-production"

# ============================================================================
# Helper functions
# ============================================================================
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# ============================================================================
# Verify prerequisites
# ============================================================================
Write-Info "Verifying prerequisites..."

# Check if gcloud is installed
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "gcloud CLI is not installed. Please install it first."
    exit 1
}

# Check if Docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed. Please install it first."
    exit 1
}

# Check if project ID is set
if ([string]::IsNullOrEmpty($ProjectId)) {
    Write-Error "GCP_PROJECT_ID is not set. Please set it or pass it as a parameter."
    exit 1
}

# Set the project
Write-Info "Setting GCP project to: $ProjectId"
gcloud config set project $ProjectId

# ============================================================================
# Enable required APIs
# ============================================================================
Write-Info "Enabling required GCP APIs..."
gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com `
    secretmanager.googleapis.com `
    storage.googleapis.com `
    compute.googleapis.com

# ============================================================================
# Create Artifact Registry repository
# ============================================================================
Write-Info "Creating Artifact Registry repository..."
$repoExists = gcloud artifacts repositories describe $ArtifactRegistryRepo --location=$Region 2>$null
if (-not $repoExists) {
    gcloud artifacts repositories create $ArtifactRegistryRepo `
        --repository-format=docker `
        --location=$Region `
        --description="Docker repository for AMP Email Platform"
    Write-Info "Artifact Registry repository created"
} else {
    Write-Info "Artifact Registry repository already exists"
}

# ============================================================================
# Configure Docker authentication
# ============================================================================
Write-Info "Configuring Docker authentication..."
gcloud auth configure-docker "$Region-docker.pkg.dev"

# ============================================================================
# Build Docker image
# ============================================================================
$ImageTag = "$Region-docker.pkg.dev/$ProjectId/$ImageName`:latest"
Write-Info "Building Docker image: $ImageTag"
docker build -t $ImageTag .

# ============================================================================
# Push Docker image to Artifact Registry
# ============================================================================
Write-Info "Pushing Docker image to Artifact Registry..."
docker push $ImageTag

# ============================================================================
# Note: Cloudflare R2 Configuration
# ============================================================================
Write-Info "Using Cloudflare R2 for storage (no GCP bucket needed)"
Write-Info "Please ensure you have created an R2 bucket in Cloudflare Dashboard"
Write-Info "Bucket name should be: amp-email-templates-production"

# ============================================================================
# Create service account
# ============================================================================
$ServiceAccountName = "amp-email-service-account"
$ServiceAccountEmail = "$ServiceAccountName@$ProjectId.iam.gserviceaccount.com"

Write-Info "Creating service account: $ServiceAccountName"
$saExists = gcloud iam service-accounts describe $ServiceAccountEmail 2>$null
if (-not $saExists) {
    gcloud iam service-accounts create $ServiceAccountName `
        --display-name="AMP Email Platform Service Account"
    Write-Info "Service account created"
} else {
    Write-Info "Service account already exists"
}

# Grant necessary permissions
Write-Info "Granting permissions to service account..."
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountEmail" `
    --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountEmail" `
    --role="roles/secretmanager.secretAccessor"

# ============================================================================
# Create secrets in Secret Manager
# ============================================================================
Write-Info "Creating secrets in Secret Manager..."

Write-Warn "Please create the following secrets manually using the GCP Console or gcloud:"
Write-Warn "  - database-url"
Write-Warn "  - direct-url"
Write-Warn "  - redis-password"
Write-Warn "  - replicate-api-key"
Write-Warn "  - jwt-secret"
Write-Warn "  - supabase-anon-key"
Write-Warn "  - supabase-service-role-key"
Write-Warn "  - r2-account-id"
Write-Warn "  - r2-access-key-id"
Write-Warn "  - r2-secret-access-key"

# ============================================================================
# Deploy to Cloud Run
# ============================================================================
Write-Info "Deploying to Cloud Run..."
gcloud run deploy $ServiceName `
    --image=$ImageTag `
    --platform=managed `
    --region=$Region `
    --service-account=$ServiceAccountEmail `
    --allow-unauthenticated `
    --min-instances=1 `
    --max-instances=100 `
    --cpu=2 `
    --memory=2Gi `
    --timeout=300 `
    --concurrency=80 `
    --port=3000 `
    --set-env-vars="NODE_ENV=production,PORT=3000,GCP_PROJECT_ID=$ProjectId,R2_BUCKET_NAME=amp-email-templates-production,CDN_BASE_URL=https://cdn.amp-platform.com" `
    --set-secrets="DATABASE_URL=database-url:latest,REDIS_PASSWORD=redis-password:latest,REPLICATE_API_KEY=replicate-api-key:latest,JWT_SECRET=jwt-secret:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,R2_ACCOUNT_ID=r2-account-id:latest,R2_ACCESS_KEY_ID=r2-access-key-id:latest,R2_SECRET_ACCESS_KEY=r2-secret-access-key:latest"

# ============================================================================
# Get service URL
# ============================================================================
$ServiceUrl = gcloud run services describe $ServiceName `
    --platform=managed `
    --region=$Region `
    --format='value(status.url)'

Write-Info "Deployment complete!"
Write-Info "Service URL: $ServiceUrl"
Write-Info "Health check: $ServiceUrl/health"

# ============================================================================
# Test the deployment
# ============================================================================
Write-Info "Testing deployment..."
try {
    $response = Invoke-WebRequest -Uri "$ServiceUrl/health" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Info "Health check passed!"
    }
} catch {
    Write-Warn "Health check failed. Please check the logs."
}

Write-Info "View logs with: gcloud run services logs read $ServiceName --region=$Region"
