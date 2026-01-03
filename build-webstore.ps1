# Scrappey Bot Detector - Web Store Build Script
# Creates a Chrome Web Store-ready .zip package

param(
    [string]$OutputName = "scrappey-detector-webstore.zip"
)

$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = $ScriptDir
$BuildDir = Join-Path $ProjectRoot "_build_temp"
$ZipPath = Join-Path $ProjectRoot $OutputName

Write-Host "`n=== Scrappey Bot Detector - Web Store Build ===" -ForegroundColor Cyan
Write-Host ""

# Clean up any previous build
if (Test-Path $BuildDir) {
    Write-Host "Cleaning previous build..." -ForegroundColor Yellow
    Remove-Item -Path $BuildDir -Recurse -Force
}

if (Test-Path $ZipPath) {
    Write-Host "Removing existing .zip file..." -ForegroundColor Yellow
    Remove-Item -Path $ZipPath -Force
}

# Create build directory
Write-Host "Creating build directory..." -ForegroundColor Green
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

# Files and folders to include
$IncludeItems = @(
    "manifest.json",
    "background.js",
    "content.js",
    "content-main-world.js",
    "popup.html",
    "popup.css",
    "popup.js",
    "icons",
    "assets",
    "detectors",
    "modules",
    "utils",
    "lib"
)

# Copy files and folders
Write-Host "`nCopying extension files..." -ForegroundColor Green
$CopiedCount = 0

foreach ($item in $IncludeItems) {
    $SourcePath = Join-Path $ProjectRoot $item
    $DestPath = Join-Path $BuildDir $item
    
    if (Test-Path $SourcePath) {
        if (Test-Path $SourcePath -PathType Container) {
            # Copy directory recursively
            Copy-Item -Path $SourcePath -Destination $DestPath -Recurse -Force
            $itemCount = (Get-ChildItem -Path $SourcePath -Recurse -File).Count
            Write-Host "  [OK] $item/ ($itemCount files)" -ForegroundColor Gray
            $CopiedCount += $itemCount
        } else {
            # Copy file
            Copy-Item -Path $SourcePath -Destination $DestPath -Force
            Write-Host "  [OK] $item" -ForegroundColor Gray
            $CopiedCount++
        }
    } else {
        Write-Host "  [WARN] $item not found, skipping..." -ForegroundColor Yellow
    }
}

Write-Host "`nCopied $CopiedCount files" -ForegroundColor Green

# Verify manifest exists
$ManifestPath = Join-Path $BuildDir "manifest.json"
if (-not (Test-Path $ManifestPath)) {
    Write-Host "`n[ERROR] manifest.json not found in build directory!" -ForegroundColor Red
    Remove-Item -Path $BuildDir -Recurse -Force
    exit 1
}

# Create .zip file
Write-Host "`nCreating .zip archive..." -ForegroundColor Green
try {
    # Use .NET compression for better compatibility
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    
    # Remove existing zip if it exists
    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath -Force
    }
    
    # Create zip from build directory
    [System.IO.Compression.ZipFile]::CreateFromDirectory($BuildDir, $ZipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    
    $ZipSize = (Get-Item $ZipPath).Length / 1MB
    Write-Host "  [OK] Created $OutputName ($([math]::Round($ZipSize, 2)) MB)" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Failed to create .zip: $_" -ForegroundColor Red
    Remove-Item -Path $BuildDir -Recurse -Force
    exit 1
}

# Clean up build directory
Write-Host "`nCleaning up..." -ForegroundColor Green
Remove-Item -Path $BuildDir -Recurse -Force

# Summary
Write-Host "`n=== Build Complete ===" -ForegroundColor Cyan
Write-Host "Package: $ZipPath" -ForegroundColor White
Write-Host "Size: $([math]::Round($ZipSize, 2)) MB" -ForegroundColor White
Write-Host "`nReady for Chrome Web Store submission!" -ForegroundColor Green
Write-Host ""

