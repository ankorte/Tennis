# TV Bruvi - Azure Web App ZIP Deployment Script
param(
    [string]$ResourceGroup = "",
    [string]$AppName = "",
    [switch]$DeployNow
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$ZipPath = Join-Path $ProjectRoot "deploy.zip"

Write-Host "=== TV Bruvi - Azure Deployment ===" -ForegroundColor Cyan

# --- Versionsnummer automatisch erhoehen ---
$pkgPath = Join-Path $ProjectRoot "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$parts = $pkg.version -split '\.'
$newVersion = "$($parts[0]).$($parts[1]).$([int]$parts[2] + 1)"
$pkg.version = $newVersion
# UTF-8 ohne BOM schreiben
$jsonContent = @"
{
  "name": "tv-bruvi-getraenke",
  "version": "$newVersion",
  "scripts": {
    "start": "bash startup.sh"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
"@
[System.IO.File]::WriteAllText($pkgPath, $jsonContent, [System.Text.UTF8Encoding]::new($false))
Write-Host ("Version: " + $newVersion) -ForegroundColor Cyan

# --- Frontend lokal bauen ---
Write-Host "Baue Frontend lokal..." -ForegroundColor Yellow
$frontendDir = Join-Path $ProjectRoot "frontend"
Push-Location $frontendDir
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    npm install --silent 2>&1 | Out-Null
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $ErrorActionPreference = $prevPref
        throw "Frontend build fehlgeschlagen (Exit-Code $LASTEXITCODE)"
    }
    Write-Host "  Frontend build OK" -ForegroundColor Green
} finally {
    $ErrorActionPreference = $prevPref
    Pop-Location
}

# --- Backend lokal bauen (TypeScript -> JavaScript) ---
Write-Host "Baue Backend lokal..." -ForegroundColor Yellow
$backendDir = Join-Path $ProjectRoot "backend"
Push-Location $backendDir
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    npm install --silent 2>&1 | Out-Null
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $ErrorActionPreference = $prevPref
        throw "Backend build fehlgeschlagen (Exit-Code $LASTEXITCODE)"
    }
    # Version in dist merken
    $newVersion | Out-File -FilePath "dist/.version" -Encoding utf8 -NoNewline
    Write-Host "  Backend build OK" -ForegroundColor Green
} finally {
    $ErrorActionPreference = $prevPref
    Pop-Location
}

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

# ZIP-Inhalt:
# - startup.sh, package.json, .deployment, deploy-build.sh (Root)
# - backend/dist/ (vorkompiliertes JS – kein TypeScript auf Azure noetig)
# - backend/package.json (fuer npm install --omit=dev via deploy-build.sh)
# - frontend/dist/ (vorkompiliertes Frontend)
$allItems = @(
    "startup.sh",
    "package.json",
    ".deployment",
    "deploy-build.sh",
    "backend/dist",
    "backend/package.json",
    "frontend/dist",
    "frontend/public"
)

Write-Host "Erstelle deploy.zip..." -ForegroundColor Yellow

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($ZipPath, 'Create')

foreach ($item in $allItems) {
    $fullPath = Join-Path $ProjectRoot $item
    if (Test-Path $fullPath -PathType Leaf) {
        $entryName = $item.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $fullPath, $entryName) | Out-Null
        Write-Host ("  + " + $entryName) -ForegroundColor Gray
    } elseif (Test-Path $fullPath -PathType Container) {
        $files = Get-ChildItem -Path $fullPath -Recurse -File
        foreach ($file in $files) {
            $relativePath = $file.FullName.Substring($ProjectRoot.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relativePath) | Out-Null
        }
        $count = $files.Count
        Write-Host ("  + " + $item + "/ (" + $count + " Dateien)") -ForegroundColor Gray
    } else {
        Write-Host ("  WARNUNG: nicht gefunden: " + $item) -ForegroundColor DarkYellow
    }
}

$zip.Dispose()

$zipSizeKB = [math]::Round((Get-Item $ZipPath).Length / 1KB, 1)
Write-Host ""
Write-Host ("deploy.zip erstellt (" + $zipSizeKB + " KB)") -ForegroundColor Green
Write-Host ""

if ($DeployNow) {
    if (-not $ResourceGroup -or -not $AppName) {
        Write-Host "FEHLER: -ResourceGroup und -AppName benoetigt fuer -DeployNow" -ForegroundColor Red
        exit 1
    }

    Write-Host "App Settings setzen..." -ForegroundColor Yellow
    az webapp config appsettings set `
        --resource-group $ResourceGroup `
        --name $AppName `
        --settings `
            NODE_ENV=production `
            "DB_PATH=/home/data/tennis.db" `
            SCM_DO_BUILD_DURING_DEPLOYMENT=true | Out-Null

    Write-Host "Startup-Befehl setzen..." -ForegroundColor Yellow
    az webapp config set `
        --resource-group $ResourceGroup `
        --name $AppName `
        --startup-file "bash /home/site/wwwroot/startup.sh" | Out-Null

    Write-Host "HTTPS Only aktivieren..." -ForegroundColor Yellow
    az webapp update `
        --resource-group $ResourceGroup `
        --name $AppName `
        --https-only true | Out-Null

    Write-Host ("ZIP deployen nach " + $AppName + "...") -ForegroundColor Yellow
    az webapp deployment source config-zip `
        --resource-group $ResourceGroup `
        --name $AppName `
        --src $ZipPath

    Write-Host ""
    Write-Host "Deployment abgeschlossen" -ForegroundColor Green
    Write-Host ("App URL: https://" + $AppName + ".azurewebsites.net") -ForegroundColor Cyan
} else {
    Write-Host "Naechste Schritte:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Azure Web App erstellen (einmalig):" -ForegroundColor White
    Write-Host "   az webapp create --resource-group <RG> --plan <PLAN> --name <APP> --runtime NODE:20-lts" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. App Settings + Startup-Command setzen (einmalig):" -ForegroundColor White
    Write-Host "   az webapp config appsettings set --resource-group <RG> --name <APP> --settings NODE_ENV=production DB_PATH=/home/data/tennis.db SCM_DO_BUILD_DURING_DEPLOYMENT=true" -ForegroundColor Gray
    Write-Host "   az webapp config set --resource-group <RG> --name <APP> --startup-file ""bash /home/site/wwwroot/startup.sh""" -ForegroundColor Gray
    Write-Host "   az webapp update --resource-group <RG> --name <APP> --https-only true" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. ZIP deployen:" -ForegroundColor White
    Write-Host "   az webapp deploy --resource-group <RG> --name <APP> --src-path deploy.zip --type zip" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Oder alles in einem:" -ForegroundColor White
    Write-Host "   .\deploy.ps1 -ResourceGroup <RG> -AppName <APP> -DeployNow" -ForegroundColor Yellow
}
