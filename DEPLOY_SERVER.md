# 奇门 qimen-web 上传到服务器说明

## 一、本机上传

1. **编辑部署脚本**  
   用记事本或 VS Code 打开 `deploy-to-server.ps1`，修改这三项：
   - `$serverUser`：服务器登录用户名（如 `root` 或 `ubuntu`）
   - `$serverHost`：服务器 IP 或域名（如 `123.45.67.89`）
   - `$serverPath`：服务器上项目目录（如 `/var/www/qimen-web`）

2. **运行上传**  
   在 PowerShell 中进入项目目录后执行：
   ```powershell
   cd C:\Users\Administrator\qimen-web
   .\deploy-to-server.ps1
   ```
   按提示输入服务器密码（若已配置 SSH 密钥则无需密码）。

3. **环境变量 .env**  
   - 脚本**不会**上传 `.env`（避免泄露密钥）。  
   - 上传后到服务器上执行：`cp .env.example .env`，再编辑 `.env` 填写：
     - `PORT`（默认 3001）
     - `DEEPSEEK_API_KEY`
     - `PAID_UNLOCK_CODES`、`PAID_SECRET` 等（若使用付费解锁）。  
   - 若希望沿用本机已有配置，可在本机执行：
     ```powershell
     scp "C:\Users\Administrator\qimen-web\.env" 用户名@服务器IP:/var/www/qimen-web/.env
     ```
     把 `用户名`、`服务器IP`、路径换成你的实际值。

## 二、服务器上运行

1. **安装 Node.js**  
   若未安装，可参考 [Node 官网](https://nodejs.org/) 或使用 nvm：
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

2. **安装依赖并启动**  
   ```bash
   cd /var/www/qimen-web   # 换成你在 deploy-to-server.ps1 里填的 serverPath
   cp .env.example .env
   nano .env                # 填写 PORT、DEEPSEEK_API_KEY 等
   npm install --production
   node server.js
   ```
   看到 “奇门遁甲网站已启动：http://localhost:3001” 即表示成功。

3. **长期运行（推荐用 pm2）**  
   ```bash
   npm install -g pm2
   pm2 start server.js --name qimen-web
   pm2 save
   pm2 startup   # 按提示执行，实现开机自启
   ```

4. **对外访问**  
   - 若只需本机访问：`http://服务器IP:3001`。  
   - 若要用域名或 80 端口：在服务器上配置 Nginx 反向代理到 `http://127.0.0.1:3001`，并开放 80/443 与 3001（如需要）端口。

## 三、注意事项

- 服务器需开放 **3001** 端口（或你在 `.env` 里设的 `PORT`），防火墙/安全组要放行。
- `knowledge/data/all_subtitles.json` 若存在会一并上传，解读接口会自动使用字幕知识库。
- 若上传失败，请检查本机是否已安装 **OpenSSH 客户端**（Windows 设置 → 应用 → 可选功能 → OpenSSH 客户端）。
