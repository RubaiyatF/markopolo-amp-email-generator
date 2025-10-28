# Test RAG system with tentree product
# This demonstrates the RAG pipeline in action

$BASE_URL = "http://localhost:3000/api/v1"

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   Testing RAG Pipeline with Tentree Product         ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

# Step 1: Create a test company to get API token
Write-Host "Step 1: Creating test company..." -ForegroundColor Cyan

$companyBody = @{
    companyId = "tentree-test-" + (Get-Date -Format "yyyyMMddHHmmss")
    apiKey = "test-key-" + (Get-Random -Maximum 999999)
} | ConvertTo-Json

try {
    $companyResponse = Invoke-RestMethod -Uri "$BASE_URL/../companies" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body $companyBody

    $token = $companyResponse.token
    Write-Host "✓ Company created, token received" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to create company: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Check RAG system health
Write-Host "`nStep 2: Checking RAG system health..." -ForegroundColor Cyan

try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/template-inspiration/health"
    Write-Host "✓ RAG system health:" -ForegroundColor Green
    Write-Host "  Qdrant: $($health.health.qdrant.status)" -ForegroundColor White
    Write-Host "  Templates indexed: $($health.health.template_library.total_templates)" -ForegroundColor White
} catch {
    Write-Host "⚠ Health check failed (continuing anyway)" -ForegroundColor Yellow
}

# Step 3: Generate emails for tentree product with RAG
Write-Host "`nStep 3: Generating emails with RAG inspiration..." -ForegroundColor Cyan
Write-Host "  Product: Bridger Sweatshirt - Forest Pine" -ForegroundColor White
Write-Host "  Campaign: Product Launch" -ForegroundColor White

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$generateBody = @{
    products = @(
        @{
            name = "Bridger Sweatshirt - Forest Pine"
            price = 78.00
            currency = "USD"
            description = "A classic pullover sweatshirt made with sustainable materials. Features a cozy fleece interior and relaxed fit perfect for outdoor adventures."
            url = "https://www.tentree.com/products/bridger-sweatshirt-forest-pine"
            image = "https://www.tentree.com/cdn/shop/files/M12226_001_1.jpg"
            brand = "tentree"
        }
    )
    campaign_context = @{
        type = "product_launch"
        goal = "conversion"
        urgency = "medium"
    }
    user_context = @{
        firstName = "Alex"
        lastName = "Johnson"
        email = "alex@example.com"
    }
    options = @{
        variations = 3
    }
} | ConvertTo-Json -Depth 10

Write-Host "`n🔍 Watching for RAG inspiration matching..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/generate" `
        -Method Post `
        -Headers $headers `
        -Body $generateBody

    Write-Host "`n✓ Generation successful!" -ForegroundColor Green
    Write-Host ""

    # Display results
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "Campaign ID: $($response.campaign_id)" -ForegroundColor Cyan
    Write-Host "Templates Generated: $($response.templates.Count)" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════`n" -ForegroundColor Yellow

    foreach ($template in $response.templates) {
        Write-Host "Template $($template.variation_name):" -ForegroundColor Magenta
        Write-Host "  Subject: $($template.content.subject)" -ForegroundColor White
        Write-Host "  Preheader: $($template.content.preheader)" -ForegroundColor Gray
        Write-Host "  AMP URL: $($template.amp_url)" -ForegroundColor Cyan

        # Check if RAG-inspired
        if ($template.amp_features -contains 'rag-inspired') {
            Write-Host "  🎨 RAG-INSPIRED: This template used Flodesk design inspiration!" -ForegroundColor Green
        } else {
            Write-Host "  (Standard design)" -ForegroundColor Gray
        }

        Write-Host ""
    }

    # Cost breakdown
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "Cost Breakdown:" -ForegroundColor Cyan
    Write-Host "  AI Generation: $($response.cost.breakdown.ai_generation)" -ForegroundColor White
    Write-Host "  Product Scraping: $($response.cost.breakdown.product_scraping)" -ForegroundColor White
    Write-Host "  CDN Delivery: $($response.cost.breakdown.cdn_delivery)" -ForegroundColor White
    Write-Host "  Total: $($response.cost.breakdown.total)" -ForegroundColor Green
    Write-Host ""

    # Metadata
    Write-Host "Generation Time: $($response.metadata.generation_time_ms)ms" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════`n" -ForegroundColor Yellow

    Write-Host "✓ RAG pipeline test complete!" -ForegroundColor Green
    Write-Host "`nTo view the generated emails:" -ForegroundColor Cyan
    foreach ($template in $response.templates) {
        Write-Host "  Variation $($template.variation_name): $($template.amp_url)" -ForegroundColor White
    }

} catch {
    Write-Host "`n✗ Generation failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host ""
