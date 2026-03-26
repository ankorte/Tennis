Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead("$PSScriptRoot\deploy.zip")

Write-Host "=== Dateien im ZIP ===" -ForegroundColor Cyan
foreach ($e in $z.Entries) {
    $size = $e.Length
    Write-Host ("  {0,-55} {1,8} bytes" -f $e.FullName, $size)
}

# package.json Inhalt anzeigen
Write-Host ""
Write-Host "=== package.json Inhalt ===" -ForegroundColor Yellow
$entry = $z.Entries | Where-Object { $_.FullName -eq "package.json" }
if ($entry) {
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host $reader.ReadToEnd()
    $reader.Dispose()
    $stream.Dispose()
}

# startup.sh erste Zeilen anzeigen
Write-Host ""
Write-Host "=== startup.sh (erste 5 Zeilen) ===" -ForegroundColor Yellow
$entry2 = $z.Entries | Where-Object { $_.FullName -eq "startup.sh" }
if ($entry2) {
    $stream2 = $entry2.Open()
    $reader2 = New-Object System.IO.StreamReader($stream2)
    $content = $reader2.ReadToEnd()
    $lines = $content -split "`n"
    for ($i = 0; $i -lt [Math]::Min(5, $lines.Count); $i++) {
        Write-Host $lines[$i]
    }
    $reader2.Dispose()
    $stream2.Dispose()
}

$z.Dispose()
