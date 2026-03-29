$c = [System.IO.File]::ReadAllText('C:\Users\andreas.korte\Neuer Ordner\tennis-drinks\frontend\dist\assets\index--s4IVAPC.js')
$i = $c.IndexOf('text-white/40')
if ($i -ge 0) {
    Write-Output "GEFUNDEN bei Index $i"
    Write-Output $c.Substring([Math]::Max(0, $i - 10), 200)
} else {
    Write-Output "NICHT GEFUNDEN"
}
