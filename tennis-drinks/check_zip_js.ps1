Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('C:\Users\andreas.korte\Neuer Ordner\tennis-drinks\deploy.zip')

$entry = $zip.Entries | Where-Object { $_.FullName -eq "frontend/dist/assets/index--s4IVAPC.js" }
if ($entry) {
    $reader = New-Object System.IO.StreamReader($entry.Open())
    $content = $reader.ReadToEnd()
    $reader.Close()

    $i = $content.IndexOf('text-white/40')
    if ($i -ge 0) {
        Write-Host "GEFUNDEN - Copyright-Zeile:"
        Write-Host $content.Substring([Math]::Max(0, $i - 5), 200)
    } else {
        Write-Host "text-white/40 NICHT GEFUNDEN im ZIP"
        # Fallback: nach 1863 suchen
        $j = $content.LastIndexOf('1863')
        if ($j -ge 0) {
            Write-Host "Letztes Vorkommen von 1863:"
            Write-Host $content.Substring([Math]::Max(0, $j - 20), 150)
        }
    }
} else {
    Write-Host "Datei nicht im ZIP gefunden"
}

$zip.Dispose()
