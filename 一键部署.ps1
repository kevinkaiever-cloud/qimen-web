# Deploy code + upload .env, then remind to restart pm2
$projectRoot = "C:\Users\Administrator\qimen-web"
Set-Location $projectRoot

Write-Host "Step 1: Deploy code..." -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File (Join-Path $projectRoot "deploy-to-server.ps1")
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`nStep 2: Upload .env..." -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File (Join-Path $projectRoot "upload-env.ps1")
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`nDeploy finished. Next: SSH to server and run (in server terminal, not PowerShell):" -ForegroundColor Yellow
Write-Host "  ssh root@103.189.141.176"
Write-Host "  cd /root/qimen-web; npm install --production; pm2 restart qimen"
Write-Host ""
