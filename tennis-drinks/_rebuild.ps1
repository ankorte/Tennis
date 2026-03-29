Set-Location "C:\Users\andreas.korte\Neuer Ordner\tennis-drinks\frontend"
if (Test-Path "node_modules\.vite") { Remove-Item "node_modules\.vite" -Recurse -Force; Write-Host "Vite-Cache geleert" }
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force; Write-Host "dist geleert" }
$env:FORCE_COLOR = "0"
npm run build
Write-Host "EXIT: $LASTEXITCODE"
