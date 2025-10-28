# Interactive Shopping Experience Setup Script
# Run this script to set up the interactive shopping features

Write-Host "================================" -ForegroundColor Cyan
Write-Host "AMP Interactive Shopping Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Node.js version
Write-Host "Step 1: Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($nodeVersion -match "v(\d+)\.") {
    $majorVersion = [int]$matches[1]
    if ($majorVersion -lt 18) {
        Write-Host "Error: Node.js 18+ required. Current: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Node.js $nodeVersion detected" -ForegroundColor Green
}

# Step 2: Install dependencies
Write-Host ""
Write-Host "Step 2: Installing dependencies..." -ForegroundColor Yellow
npm install cheerio axios
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 3: Check for .env file
Write-Host ""
Write-Host "Step 3: Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
} else {
    Write-Host "! .env file not found. Creating from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Created .env file from template" -ForegroundColor Green
    Write-Host "! Please configure environment variables in .env" -ForegroundColor Yellow
}

# Step 4: Run database migrations
Write-Host ""
Write-Host "Step 4: Running database migrations..." -ForegroundColor Yellow
$confirmation = Read-Host "This will modify your database. Continue? (y/n)"
if ($confirmation -eq "y") {
    npx prisma migrate dev --name add_interactive_shopping
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database migration completed" -ForegroundColor Green
    } else {
        Write-Host "✗ Database migration failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "! Skipped database migration" -ForegroundColor Yellow
}

# Step 5: Generate Prisma client
Write-Host ""
Write-Host "Step 5: Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Prisma client generated" -ForegroundColor Green
} else {
    Write-Host "✗ Prisma client generation failed" -ForegroundColor Red
    exit 1
}

# Step 6: Verify setup
Write-Host ""
Write-Host "Step 6: Verifying setup..." -ForegroundColor Yellow

$setupComplete = $true

# Check if services exist
$services = @(
    "src\config\featureFlags.ts",
    "src\services\brandAnalyzer.ts",
    "src\services\cartHandoff.ts",
    "public\cart-landing.html"
)

foreach ($service in $services) {
    if (Test-Path $service) {
        Write-Host "  ✓ $service" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $service not found" -ForegroundColor Red
        $setupComplete = $false
    }
}

# Summary
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Setup Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if ($setupComplete) {
    Write-Host "✓ Setup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Configure .env with your API keys and settings"
    Write-Host "2. Deploy cart-landing.html to your CDN"
    Write-Host "3. Run 'npm test' to verify functionality"
    Write-Host "4. Start the server with 'npm run dev'"
    Write-Host ""
    Write-Host "Documentation:" -ForegroundColor Yellow
    Write-Host "- INTERACTIVE-SHOPPING-README.md - Quick start guide"
    Write-Host "- CART-HANDOFF-GUIDE.md - Cart integration"
    Write-Host "- BRAND-ANALYZER-USAGE-GUIDE.md - Brand analysis"
    Write-Host "- NEXT-STEPS-IMPLEMENTATION-PLAN.md - Remaining work"
} else {
    Write-Host "✗ Setup incomplete. Please check errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
