Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('C:\Users\andreas.korte\Neuer Ordner\tennis-drinks\deploy.zip')

Write-Host "=== Dateien im ZIP ==="
$zip.Entries | Where-Object { $_.FullName -like "frontend/dist/*" } | ForEach-Object {
    Write-Host $_.FullName
}

Write-Host ""
Write-Host "=== index.html Inhalt ==="
$entry = $zip.Entries | Where-Object { $_.FullName -eq "frontend/dist/index.html" }
if ($entry) {
    $reader = New-Object System.IO.StreamReader($entry.Open())
    Write-Host $reader.ReadToEnd()
    $reader.Close()
}

$zip.Dispose()
