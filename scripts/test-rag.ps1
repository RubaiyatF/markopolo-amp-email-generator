# PowerShell script to test RAG Template Inspiration System
# Usage: .\scripts\test-rag.ps1

$BASE_URL = "http://localhost:3000/api/v1"

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Section { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Yellow }

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   RAG Template Inspiration System - Test Suite      ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

# Test 1: Health Check
Write-Section "1. Health Check"
Write-Info "Testing: GET $BASE_URL/template-inspiration/health"

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/template-inspiration/health" -Method Get

    if ($response.success) {
        Write-Success "✓ Health check passed"
        Write-Host "  Qdrant: $($response.health.qdrant.status)"
        Write-Host "  Embedding Service: $($response.health.embedding_service.status)"
        Write-Host "  Total Templates: $($response.health.template_library.total_templates)"
    } else {
        Write-Error "✗ Health check failed"
        Write-Host ($response | ConvertTo-Json -Depth 5)
    }
} catch {
    Write-Error "✗ Health check failed: $($_.Exception.Message)"
}

# Test 2: Get Statistics (requires authentication)
Write-Section "2. Get Statistics"
Write-Info "Note: This endpoint requires authentication. Skipping for now."
Write-Host "  To test manually, get a token first and run:"
Write-Host '  $token = "YOUR_TOKEN"'
Write-Host '  Invoke-RestMethod -Uri "$BASE_URL/template-inspiration/stats" -Headers @{"Authorization"="Bearer $token"}'

# Test 3: Check if indexing is needed
Write-Section "3. Check Indexing Status"
Write-Info "Checking if templates need to be indexed..."

try {
    # This endpoint might require auth, let's try without first
    $response = Invoke-RestMethod -Uri "$BASE_URL/template-inspiration/needs-indexing" -Method Get -ErrorAction SilentlyContinue

    if ($response.needs_indexing) {
        Write-Info "⚠ Templates need to be indexed"
        Write-Host "  Run: npm run index-templates"
    } else {
        Write-Success "✓ Templates are already indexed"
    }
} catch {
    Write-Info "  (Endpoint may require authentication)"
}

# Test 4: Example search templates
Write-Section "4. Example: Search for Abandoned Cart Templates"
Write-Info "This demonstrates searching for templates similar to an abandoned cart campaign"

$searchBody = @{
    campaign_context = @{
        type = "abandoned_cart"
        goal = "conversion"
        urgency = "high"
    }
    limit = 5
} | ConvertTo-Json

Write-Host "`nSearch Query:"
Write-Host $searchBody

Write-Host "`nNote: This endpoint requires authentication."
Write-Host "To test manually with a token:"
Write-Host '
$token = "YOUR_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    campaign_context = @{
        type = "abandoned_cart"
        goal = "conversion"
        urgency = "high"
    }
    limit = 5
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/template-inspiration/search" -Method Post -Headers $headers -Body $body
'

# Summary
Write-Section "Test Summary"
Write-Host "✓ Basic health check completed"
Write-Host "ℹ For authenticated endpoints, you need to:"
Write-Host "  1. Get an API token (create a company first)"
Write-Host "  2. Use the token in Authorization header"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "  1. If templates need indexing: npm run index-templates"
Write-Host "  2. Start the server: npm run dev"
Write-Host "  3. Test generation endpoint to see RAG in action"
Write-Host ""
