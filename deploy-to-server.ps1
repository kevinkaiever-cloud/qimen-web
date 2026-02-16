# qimen-web deploy to server (edit serverUser, serverHost, serverPath below)

$serverUser = "root"
$serverHost = "103.189.141.176"
$serverPath = "/root/qimen-web"

$projectRoot = "C:\Users\Administrator\qimen-web"
$deployDir = Join-Path $projectRoot "_deploy"

# Skip if host not set (placeholder)
if ($serverHost -match "^\s*$" -or $serverHost -eq "YOUR_SERVER_IP") {
    Write-Host "Edit this script: set serverUser, serverHost, serverPath first." -ForegroundColor Yellow
    exit 1
}

Write-Host "Deploy to: ${serverUser}@${serverHost}:${serverPath}" -ForegroundColor Cyan

if (Test-Path $deployDir) {
    Remove-Item $deployDir -Recurse -Force
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

$toCopy = @(
    "server.js",
    "package.json",
    "package-lock.json",
    ".env.example",
    "README.md",
    ".gitignore",
    "fetch-transcript.js",
    "fetch_all_episodes.ps1",
    "fetch_transcript.py",
    "GITHUB_UPLOAD.md",
    "push-to-github.ps1",
    "nginx-7menquant.shop.conf"
)
foreach ($item in $toCopy) {
    $src = Join-Path $projectRoot $item
    if (Test-Path $src) {
        Copy-Item $src -Destination $deployDir -Force
        Write-Host "  + $item"
    }
}

foreach ($dir in @("public", "knowledge")) {
    $srcDir = Join-Path $projectRoot $dir
    if (Test-Path $srcDir) {
        Copy-Item $srcDir -Destination (Join-Path $deployDir $dir) -Recurse -Force
        Write-Host "  + dir: $dir"
    }
}

$scpTarget = "${serverUser}@${serverHost}:${serverPath}"
Write-Host ""
Write-Host "Uploading (enter server password if asked)..." -ForegroundColor Green

$sshCmd = "mkdir -p `"$serverPath`""
& ssh "${serverUser}@${serverHost}" $sshCmd 2>$null

& scp -r "$deployDir\*" "${scpTarget}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed. Check: server IP/user, OpenSSH installed, firewall." -ForegroundColor Red
    exit 1
}

Remove-Item $deployDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Upload done." -ForegroundColor Green
Write-Host "On server run:" -ForegroundColor Yellow
Write-Host "  ssh ${serverUser}@${serverHost}"
Write-Host "  cd $serverPath"
Write-Host "  cp .env.example .env  &&  nano .env"
Write-Host "  npm install --production"
Write-Host "  node server.js   (or: pm2 start server.js --name qimen-web)"
Write-Host ""
Write-Host "To copy .env from this PC:"
Write-Host "  scp `"$projectRoot\.env`" ${scpTarget}/.env"
Write-Host ""
