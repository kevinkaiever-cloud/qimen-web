# 上传到 GitHub 的步骤

本地已经完成：`git init`、`git add`、`git commit`，当前分支为 `main`。

## 1. 在 GitHub 上新建仓库

1. 打开 https://github.com/new
2. **Repository name**：填 `qimen-web`（或你喜欢的名字）
3. **Description**（可选）：`奇门遁甲排盘 + 字幕知识库 + 断事逻辑`
4. 选择 **Public**
5. **不要**勾选 "Add a README" / "Add .gitignore"（本地已有）
6. 点击 **Create repository**

## 2. 在本地添加远程并推送

创建好仓库后，GitHub 会显示仓库地址，形如：

- `https://github.com/你的用户名/qimen-web.git`
- 或 `git@github.com:你的用户名/qimen-web.git`

在**本机 PowerShell** 中进入项目目录，执行（把下面地址换成你的仓库地址）：

```powershell
cd C:\Users\Administrator\qimen-web

# 添加远程（替换成你的 GitHub 用户名和仓库名）
& "C:\Program Files\Git\bin\git.exe" remote add origin https://github.com/你的用户名/qimen-web.git

# 推送到 GitHub
& "C:\Program Files\Git\bin\git.exe" push -u origin main
```

如果提示输入账号密码：GitHub 已不支持密码，需用 **Personal Access Token** 当密码，或使用 **Git Credential Manager** 登录。

## 3. 设置 Git 用户信息（可选，用于以后提交显示）

```powershell
& "C:\Program Files\Git\bin\git.exe" config --global user.email "你的邮箱@example.com"
& "C:\Program Files\Git\bin\git.exe" config --global user.name "你的GitHub用户名"
```

---

**说明**：`knowledge/data/all_subtitles.json` 约 2.6MB，已一并提交；若以后不想推送到 GitHub，可在 `.gitignore` 中加入 `knowledge/data/all_subtitles.json` 再提交一次。
