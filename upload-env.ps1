# Upload .env to server (edit serverUser, serverHost, serverPath if needed)
$serverUser = "root"
$serverHost = "103.189.141.176"
$serverPath = "/root/qimen-web"

$projectRoot = "C:\Users\Administrator\qimen-web"
$envFile = Join-Path $projectRoot ".env"

if (-not (Test-Path $envFile)) {
    Write-Host ".env not found. Create it first." -ForegroundColor Red
    exit 1
}

$scpTarget = "${serverUser}@${serverHost}:${serverPath}/.env"
Write-Host "Uploading .env to ${serverUser}@${serverHost}:${serverPath}/.env" -ForegroundColor Cyan
& scp $envFile $scpTarget
if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed." -ForegroundColor Red
    exit 1
}
Write-Host "Done. SSH to server then run: pm2 restart qimen" -ForegroundColor Green
