# 上传到 GitHub 的脚本
# 用法：先到 https://github.com/new 创建空仓库，再把下面 $repoUrl 改成你的仓库地址，然后运行本脚本

$repoUrl = "https://github.com/kevinkaiever-cloud/qimen-web.git"
$git = "C:\Program Files\Git\bin\git.exe"
$projectRoot = "C:\Users\Administrator\qimen-web"

Set-Location $projectRoot

# 若已添加过 origin 可先删除： git remote remove origin
& $git remote remove origin 2>$null
& $git remote add origin $repoUrl
& $git push -u origin main

Write-Host "若推送失败，请检查：1) 仓库地址是否正确 2) 是否已登录 GitHub（Token 或凭据）"
