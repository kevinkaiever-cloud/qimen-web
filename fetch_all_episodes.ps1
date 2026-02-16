$apiKey = "2zFyRWMVczSx"
$baseUrl = "https://www.bilibili.com/video/BV1PC4y1E769"
$allLines = @()
$wc = New-Object System.Net.WebClient
$wc.Encoding = [System.Text.Encoding]::UTF8
$wc.Headers.Add("Authorization", "Bearer $apiKey")

for ($p = 1; $p -le 13; $p++) {
    $videoUrl = $baseUrl + "?p=" + $p
    $apiUrl = "https://api.bibigpt.co/api/v1/getSubtitle?url=" + [uri]::EscapeDataString($videoUrl) + "&audioLanguage=zh"
    Write-Host "Fetching Episode $p ..."
    try {
        $json = $wc.DownloadString($apiUrl)
        $data = $json | ConvertFrom-Json
        if (-not $data.success -or -not $data.detail.subtitlesArray) {
            $allLines += ""
            $allLines += "========== Episode $p (no subs) =========="
            continue
        }
        $subs = $data.detail.subtitlesArray
        $allLines += ""
        $allLines += "========== Episode $p =========="
        foreach ($s in $subs) {
            $h = [int][Math]::Floor($s.startTime/3600)
            $m = [int][Math]::Floor(($s.startTime%3600)/60)
            $sec = [int]($s.startTime%60)
            $allLines += ("[{0:D2}:{1:D2}:{2:D2}] {3}" -f $h, $m, $sec, $s.text)
        }
        Write-Host "  OK: $($subs.Count) lines"
    } catch {
        Write-Host "  FAIL: $_"
        $allLines += ""
        $allLines += "========== Episode $p (failed) =========="
    }
}

$outPath = "C:\Users\Administrator\qimen-web\qimen_full_transcript_13ep.txt"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, ($allLines -join "`r`n"), $utf8)
Write-Host "Done. Saved to $outPath - $($allLines.Count) lines total"
