# Vette Universal IDE Extension Installer
# Supports: VS Code, Cursor, Windsurf, VSCodium
# Usage:
#   irm https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/install-extension.ps1 | iex

$ErrorActionPreference = 'SilentlyContinue'

Write-Host ''
Write-Host '[VETTE] Universal IDE Extension Installer' -ForegroundColor Cyan
Write-Host 'Detecting installed AI coding environments...' -ForegroundColor DarkGray
Write-Host ''

$LocalVsix = Join-Path $PSScriptRoot 'extension\vette-vscode-0.1.0.vsix'
$TempVsix = Join-Path $env:TEMP 'vette-vscode.vsix'
$TargetVsix = ''

if ($PSScriptRoot -and (Test-Path $LocalVsix)) {
    $TargetVsix = (Resolve-Path $LocalVsix).Path
} else {
    Write-Host '[*] Downloading latest Vette extension from GitHub...' -ForegroundColor Yellow
    $Url = 'https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/extension/vette-vscode-0.1.0.vsix'
    Invoke-WebRequest -Uri $Url -OutFile $TempVsix -UseBasicParsing
    $TargetVsix = $TempVsix
}

if (-not (Test-Path $TargetVsix)) {
    Write-Host '[!] Could not download Vette extension VSIX.' -ForegroundColor Red
    exit 1
}

$Commands = @('code', 'cursor', 'windsurf', 'codium')
$InstalledCount = 0

foreach ($cmd in $Commands) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "Installing into $cmd..." -ForegroundColor White -NoNewline
        & $cmd --install-extension $TargetVsix --force *>$null
        Write-Host ' [SUCCESS]' -ForegroundColor Green
        $InstalledCount++
    }
}

if ($InstalledCount -gt 0) {
    Write-Host ''
    Write-Host "[OK] Vette extension installed successfully into $InstalledCount editor(s)!" -ForegroundColor Green
    Write-Host 'Open any package.json or requirements.txt to see real-time AI slopsquat protection active.' -ForegroundColor White
    Write-Host ''
} else {
    Write-Host 'No IDE CLI command found on PATH.' -ForegroundColor Yellow
    Write-Host 'You can manually install by running:' -ForegroundColor White
    Write-Host "code --install-extension $TargetVsix" -ForegroundColor Cyan
}
