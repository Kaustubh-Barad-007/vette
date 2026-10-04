# Vette One-Click Installer for Windows
# Usage:
#   irm https://raw.githubusercontent.com/vette-security/vette/main/install.ps1 | iex
# Or locally:
#   .\install.ps1

$ErrorActionPreference = "Stop"

Write-Host "🛡️  Vette Installer for Windows" -ForegroundColor Cyan
Write-Host "Defending against AI Slopsquatting & Zero-Day Poisoning..." -ForegroundColor DarkGray

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is required but not installed. Please install Node.js (v18+) first: https://nodejs.org" -ForegroundColor Red
    exit 1
}

$VetteDir = Split-Path -Parent $MyInvocation.MyCommand.Path -ErrorAction SilentlyContinue

if ($VetteDir -and (Test-Path "$VetteDir\package.json")) {
    Write-Host "📦 Installing from local repository ($VetteDir)..." -ForegroundColor Yellow
    if (-not (Test-Path "$VetteDir\dist\cli.js")) {
        npm --prefix "$VetteDir" run build
    }
    npm link --prefix "$VetteDir"
    $TargetExec = "node `"$VetteDir\dist\cli.js`""
} else {
    Write-Host "🌐 Installing Vette globally via npm..." -ForegroundColor Yellow
    npm install -g vette
    $TargetExec = "vette"
}

# Configure PowerShell Profile
$ProfilePath = $PROFILE.CurrentUserCurrentHost
if (-not (Test-Path $ProfilePath)) {
    $ProfileDir = Split-Path -Parent $ProfilePath
    if (-not (Test-Path $ProfileDir)) { New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null }
    New-Item -ItemType File -Path $ProfilePath -Force | Out-Null
}

$ProfileContent = Get-Content $ProfilePath -Raw -ErrorAction SilentlyContinue
$VetteShim = @"

# --- Vette Pre-Install Guard ---
function npm { $TargetExec npm `$args }
function pip { $TargetExec pip `$args }
# --- End Vette Guard ---
"@

if ($ProfileContent -notmatch "Vette Pre-Install Guard") {
    Add-Content -Path $ProfilePath -Value $VetteShim
    Write-Host "✓ Added Vette interceptor shims to your PowerShell Profile: $ProfilePath" -ForegroundColor Green
} else {
    Write-Host "✓ Vette shims already active in your PowerShell Profile." -ForegroundColor Green
}

Write-Host "`n🎉 Vette successfully installed and active!" -ForegroundColor Green
Write-Host "Every 'npm install <pkg>' or 'pip install <pkg>' is now intercepted and vetted before scripts execute." -ForegroundColor White
Write-Host "Try it right now: vette vet react" -ForegroundColor Cyan
