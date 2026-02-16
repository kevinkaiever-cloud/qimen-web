# 🔮 奇门遁甲 · 宗师排盘版 (Qimen Dunjia & Stock Lab)

![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-Active-success)

> 结合「传统奇门排盘」与「AI 股市模拟」的全栈 Web 应用，内置奇门知识库与雨霖课程字幕检索，断事逻辑按步骤注入，解读更贴近课程体系。

**在线演示**：[https://7menquant.shop](https://7menquant.shop)

---

## 📑 目录

- [项目简介](#-项目简介)
- [功能特性](#-功能特性)
- [项目结构](#-项目结构)
- [知识库说明](#-知识库说明)
- [环境要求](#-环境要求)
- [快速开始](#-快速开始)
- [API 文档](#-api-文档)
- [部署与上线](#-部署与上线)
- [免责声明](#-免责声明)

---

## 📖 项目简介

本项目探索传统术数与现代 AI 的结合，主要包含：

1. **奇门问事**：真太阳时排盘、九宫推演、DeepSeek 宗师级解读、连续追问；解读时按「定人→定事→生克→门星神→旺衰」的断事逻辑输出。
2. **股市预测**：A 股 / 美股 K 线、模拟预测区间、奇门 + AI 综合分析。
3. **知识库**：内置八神八门九星与单宫分层法；可选加载 52 集雨霖奇门课程字幕，按用户问题检索相关片段注入提示词；另含从字幕整理的**断事逻辑**（用神取法、解盘步骤、九宫象意、空亡应期等），保证解读步骤统一、结论有据。
4. **付费解锁**：详细分析支持付费解锁码，收款后通过管理员页获取解锁码发给客户。

---

## ✨ 功能特性

| 板块 | 功能 |
|------|------|
| 奇门排盘 | 真太阳时、值符值使、门星神、九宫图 |
| AI 解读 | DeepSeek + 奇门知识库 + **断事逻辑**，支持追问；简要（免费）/ 详细（付费解锁） |
| 字幕知识库 | 52 集雨霖课程字幕按问题关键词检索，自动注入相关片段（约 4200 字内） |
| 断事逻辑 | 坐标定位、解盘步骤、单宫分层、九宫象意、空亡应期等，从课程字幕提炼并接入 system prompt |
| 股市 K 线 | 历史数据 + 10 日模拟预测、支撑压力区间 |
| 奇门股市 | 结合盘面气数做 AI 玄学分析 |
| 管理员 | 收款后访问 `/admin.html` 获取解锁码，一键复制发给客户 |

---

## 🏗️ 项目结构

```
qimen-web/
│
├── public/                       # 前端静态资源
│   ├── index.html                # 主入口（奇门 + 股市）
│   └── admin.html                # 管理员：收款后获取解锁码
│
├── knowledge/                    # 奇门知识库
│   ├── qimen-knowledge.js        # 八神八门九星、用神取法、单宫分析等
│   ├── duanshi-logic.js          # 断事逻辑（从字幕整理）
│   ├── subtitle-db.js            # 字幕检索：按问题关键词返回相关片段
│   └── data/
│       ├── all_subtitles.json    # 52 集雨霖课程字幕（可选）
│       └── README.md             # 数据来源说明
│
├── server.js                     # 后端入口 (Express)
├── package.json                  # 依赖配置
├── .env.example                  # 环境变量示例
├── deploy-to-server.ps1          # 上传代码到服务器（Windows）
├── upload-env.ps1                # 上传 .env 到服务器
├── 一键部署.ps1 / 一键部署.bat   # 一键部署代码 + 环境变量
├── nginx-7menquant.shop.conf    # Nginx 反向代理示例（域名绑定）
├── 域名绑定说明.md               # 域名与 Nginx 配置说明
├── GITHUB_UPLOAD.md             # 上传 GitHub 说明
└── README.md                     # 本文件
```

---

## 📚 知识库说明

- **qimen-knowledge.js**：静态知识（四盘体系、八神八门九星、用神取法、旺相休囚、生克、值符值使、单宫分层、断事原则），每次请求都会带入。
- **duanshi-logic.js**：从雨霖课程字幕提炼的断事逻辑（一盘一事、坐标定位、解盘步骤、九宫象意、空亡应期等），已拼入 system prompt，解读时按步骤执行。
- **subtitle-db.js + data/all_subtitles.json**：若存在 `knowledge/data/all_subtitles.json`，则根据用户问题检索相关字幕片段并追加到 system prompt，提升与课程表述的一致性；可通过 `GET /api/knowledge/status` 查看是否已加载。

---

## 🛠️ 环境要求

- **Node.js** ≥ 18（推荐 v20+）
- **网络**：可访问 `https://api.deepseek.com`
- **API Key**：DeepSeek API Key（前端可输入或放 `.env`）

---

## 🚀 快速开始

### 1. 克隆并安装

```bash
git clone https://github.com/kevinkaiever-cloud/qimen-web.git
cd qimen-web
npm install
```

### 2. 配置环境变量（可选）

```bash
cp .env.example .env
# 编辑 .env：DEEPSEEK_API_KEY、PORT、PAID_UNLOCK_CODES、PAID_SECRET 等
```

### 3. 启动

```bash
npm start
```

访问：**http://localhost:3001**（默认端口 3001）

启动成功且已放置字幕数据时，控制台会提示：`已加载字幕知识库，解读 API 将按问题注入相关课程片段`。

---

## 📡 API 文档

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/knowledge/status` | 知识库状态（字幕是否已加载） |
| GET | `/api/admin/unlock-code` | 管理员获取解锁码（需 adminKey） |
| POST | `/api/unlock` | 凭解锁码换取付费 token |
| POST | `/api/qimen/interpret` | 奇门盘面 + 问事 → AI 解读（含断事逻辑与可选字幕片段） |
| POST | `/api/qimen/chat` | 基于盘面连续追问 |
| POST | `/api/stocks/predict` | 基准点、支撑压力、趋势 |
| POST | `/api/stocks/kline` | 历史 + 模拟 K 线数据 |
| POST | `/api/stocks/qimen-interpret` | 奇门 + 股票 AI 分析 |

---

## ⚙️ 部署与上线

### 本机一键部署到服务器（Windows）

1. 编辑 `deploy-to-server.ps1` 中的 `$serverUser`、`$serverHost`、`$serverPath`。
2. 运行 **一键部署.bat** 或：
   ```powershell
   powershell -ExecutionPolicy Bypass -File ".\一键部署.ps1"
   ```
3. SSH 登录服务器后执行：
   ```bash
   cd /root/qimen-web   # 或你的 serverPath
   npm install --production
   pm2 restart qimen
   ```

### 服务器上长期运行

```bash
npm install -g pm2
pm2 start server.js --name qimen
pm2 save
pm2 startup
```

### 域名与 Nginx

参见 **域名绑定说明.md**：DNS 解析、Nginx 反向代理、HTTPS（certbot）配置。

---

## 📜 免责声明

- **玄学**：奇门排盘仅供民俗研究与娱乐，无科学依据
- **金融**：股市预测为算法模拟，非真实行情，据此操作盈亏自负
- **安全**：请勿将 `.env` 或真实 API Key 提交到公开仓库

---

## 🤝 贡献

欢迎提交 Issue 或 Pull Request。

## 📄 License

MIT © 2026
