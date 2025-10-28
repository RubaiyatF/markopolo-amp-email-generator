# PowerShell script to test email generation with RAG inspiration
# Usage: .\scripts\test-generation-with-rag.ps1 YOUR_API_TOKEN

param(
    [Parameter(Mandatory=$false)]
    [string]$Token = ""
)

$BASE_URL = "http://localhost:3000/api/v1"

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Section { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Yellow }

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   Email Generation with RAG Inspiration Test        ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

if ($Token -eq "") {
    Write-Error "ERROR: API token is required"
    Write-Host ""
    Write-Host "Usage: .\scripts\test-generation-with-rag.ps1 YOUR_API_TOKEN"
    Write-Host ""
    Write-Host "To get a token:"
    Write-Host '  1. Create a company via POST /api/v1/companies'
    Write-Host '  2. Use the returned JWT token'
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

# Test: Generate abandoned cart email with RAG
Write-Section "Generating Abandoned Cart Email with RAG"

$generateBody = @{
    products = @(
        @{
            name = "Wireless Headphones"
            price = 79.99
            currency = "USD"
            description = "Premium noise-cancelling wireless headphones with 30-hour battery life"
            url = "https://example.com/products/wireless-headphones"
            image = "https://example.com/images/headphones.jpg"
        }
    )
    campaign_context = @{
        type = "abandoned_cart"
        goal = "conversion"
        urgency = "high"
    }
    user_context = @{
        firstName = "John"
        lastName = "Doe"
        email = "john.doe@example.com"
    }
    options = @{
        variations = 3
    }
} | ConvertTo-Json -Depth 10

Write-Info "Request Body:"
Write-Host $generateBody

Write-Info "`nSending request to $BASE_URL/generate..."

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/generate" -Method Post -Headers $headers -Body $generateBody

    Write-Success "`n✓ Generation successful!"
    Write-Host ""
    Write-Host "Campaign ID: $($response.campaign_id)"
    Write-Host "Templates Generated: $($response.templates.Count)"
    Write-Host ""

    # Display each template
    foreach ($template in $response.templates) {
        Write-Section "Template $($template.variation_name)"
        Write-Host "  Subject: $($template.content.subject)"
        Write-Host "  Preheader: $($template.content.preheader)"
        Write-Host "  AMP URL: $($template.amp_url)"
        Write-Host "  Features: $($template.merge_tags -join ', ')"

        # Check if RAG-inspired
        if ($template.amp_features -contains 'rag-inspired') {
            Write-Success "  ✓ This template was RAG-inspired!"
        }

        Write-Host ""
    }

    # Show cost breakdown
    Write-Section "Cost Breakdown"
    Write-Host "  AI Generation: $($response.cost.breakdown.ai_generation)"
    Write-Host "  Product Scraping: $($response.cost.breakdown.product_scraping)"
    Write-Host "  CDN Delivery: $($response.cost.breakdown.cdn_delivery)"
    Write-Host "  Total: $($response.cost.breakdown.total)"

    # Show metadata
    Write-Section "Metadata"
    Write-Host "  Generation Time: $($response.metadata.generation_time_ms)ms"
    Write-Host "  Products Processed: $($response.metadata.products_processed)"
    Write-Host "  Variations Created: $($response.metadata.variations_created)"

    Write-Success "`n✓ Test completed successfully!"

} catch {
    Write-Error "`n✗ Generation failed"
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)"
    }
}

Write-Host ""
