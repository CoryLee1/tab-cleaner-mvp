# Tab Cleaner 部署和打包指南

## 📦 一、后端部署建议

### 推荐部署平台（按优先级）

#### 1. **Railway** ⭐⭐⭐⭐⭐（推荐）
- **优点**：
  - 免费额度充足（$5/月免费额度）
  - 自动部署（GitHub 连接）
  - 支持 Python 3.13
  - 自动 HTTPS
  - 简单易用
- **部署步骤**：
  1. 注册 Railway 账号
  2. 连接 GitHub 仓库
  3. 选择 `backend/app` 目录
  4. 设置环境变量（`DASHSCOPE_API_KEY`）
  5. 自动部署完成

#### 2. **Render** ⭐⭐⭐⭐
- **优点**：
  - 免费套餐可用
  - 自动 HTTPS
  - 支持 GitHub 自动部署
- **缺点**：
  - 免费套餐有休眠限制（15分钟无请求后休眠）

#### 3. **Fly.io** ⭐⭐⭐⭐
- **优点**：
  - 免费额度充足
  - 全球边缘节点
  - 支持 Docker
- **适合**：需要全球低延迟的场景

#### 4. **阿里云/腾讯云** ⭐⭐⭐
- **优点**：
  - 国内访问速度快
  - 稳定可靠
- **缺点**：
  - 需要备案（如果使用国内服务器）
  - 需要手动配置服务器

### 后端部署步骤（以 Railway 为例）

#### 1. 准备部署文件

在 `backend/app` 目录创建 `railway.json`（可选）：

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### 2. 创建 `Procfile`（Railway 会自动识别）：

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

#### 3. 设置环境变量

在 Railway 控制台设置：
- `DASHSCOPE_API_KEY`: 你的阿里云 API Key
- `PORT`: Railway 会自动设置

#### 4. 部署

1. 在 Railway 创建新项目
2. 连接 GitHub 仓库
3. 设置根目录为 `backend/app`
4. 添加环境变量
5. 点击部署

#### 5. 获取后端 URL

部署完成后，Railway 会提供一个 URL，例如：
```
https://your-app-name.railway.app
```

---

## 📦 二、Chrome 插件打包指南

### 1. 修改 API 地址

在打包前，需要将 API 地址从 `localhost` 改为生产环境地址。

#### 修改 `frontend/src/shared/api.js`：

```javascript
// 开发环境
// const API = "http://localhost:8000/api/v1";

// 生产环境（替换为你的后端 URL）
const API = process.env.VITE_API_URL || "https://your-backend-url.railway.app/api/v1";
```

#### 或者使用环境变量（推荐）：

创建 `frontend/.env.production`：

```env
VITE_API_URL=https://your-backend-url.railway.app/api/v1
```

修改 `frontend/src/shared/api.js`：

```javascript
const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
```

### 2. 修改 `background.js` 中的 API 地址

修改 `frontend/public/assets/background.js`：

```javascript
// 开发环境
// const BACKEND_URL = 'http://localhost:8000';

// 生产环境
const BACKEND_URL = 'https://your-backend-url.railway.app';
```

**注意**：由于 `background.js` 是静态文件，不能使用环境变量。建议：
- 在构建时通过脚本替换
- 或使用构建工具（如 `vite-plugin-replace`）在构建时替换

### 3. 构建前端

```bash
cd frontend
npm run build
```

### 4. 准备打包文件

Chrome 插件需要打包 `frontend/dist` 目录，但需要：

#### 检查清单：

- ✅ `manifest.json` 存在
- ✅ 所有资源文件都在 `dist` 目录
- ✅ 没有 `node_modules` 等开发文件
- ✅ API 地址已更新为生产环境

#### 创建打包脚本 `frontend/package-extension.sh`：

```bash
#!/bin/bash

# 清理旧的打包文件
rm -f ../tab-cleaner-extension.zip

# 进入 dist 目录
cd dist

# 创建 zip 文件（排除不需要的文件）
zip -r ../../tab-cleaner-extension.zip . \
  -x "*.DS_Store" \
  -x "*node_modules/*" \
  -x "*.git/*" \
  -x "*.md"

echo "✅ 插件已打包到: ../tab-cleaner-extension.zip"
```

#### Windows 用户可以使用 PowerShell 脚本 `frontend/package-extension.ps1`：

```powershell
# 清理旧的打包文件
Remove-Item -Path "..\tab-cleaner-extension.zip" -ErrorAction SilentlyContinue

# 进入 dist 目录
Set-Location dist

# 创建 zip 文件
Compress-Archive -Path * -DestinationPath "..\..\tab-cleaner-extension.zip" -Force

Write-Host "✅ 插件已打包到: ..\tab-cleaner-extension.zip"
```

### 5. 打包步骤

#### macOS/Linux:

```bash
cd frontend
chmod +x package-extension.sh
./package-extension.sh
```

#### Windows:

```powershell
cd frontend
.\package-extension.ps1
```

#### 手动打包：

1. 进入 `frontend/dist` 目录
2. 全选所有文件
3. 右键 → 压缩为 zip
4. 重命名为 `tab-cleaner-extension.zip`

### 6. 验证打包文件

解压 `tab-cleaner-extension.zip`，检查：

- ✅ `manifest.json` 存在
- ✅ `assets/` 目录包含所有 JS/CSS 文件
- ✅ `static/img/` 包含所有图片
- ✅ HTML 文件存在（`personalspace.html`, `popup.html` 等）
- ✅ 文件大小合理（通常 < 10MB）

---

## 📋 三、Chrome Web Store 上架清单

### 必需文件：

1. **插件 ZIP 包**：`tab-cleaner-extension.zip`
2. **图标**：
   - 16x16, 32x32, 48x48, 128x128 PNG
   - 建议放在 `frontend/dist/static/img/` 或单独提供
3. **截图**：
   - 至少 1 张，建议 1280x800 或 640x400
   - 展示主要功能
4. **描述**：
   - 简短描述（132 字符）
   - 详细描述（可以更长）
5. **隐私政策**（如果收集用户数据）

### 上架步骤：

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 支付一次性注册费（$5）
3. 点击"新建项目"
4. 上传 ZIP 包
5. 填写信息：
   - 名称：Tab Cleaner MVP
   - 描述：标签页管理和智能整理工具
   - 分类：生产力工具
   - 图标和截图
6. 提交审核

### 隐私政策模板（如果需要）：

如果插件收集了用户数据（如标签页 URL），需要提供隐私政策：

```
隐私政策

Tab Cleaner MVP 是一个标签页管理工具。

数据收集：
- 我们仅在本地存储标签页的 OpenGraph 数据（标题、描述、图片）
- 所有数据存储在用户的浏览器本地（chrome.storage.local）
- 我们不会将任何数据发送到第三方服务器

数据使用：
- 数据仅用于在插件内部展示和管理标签页
- 我们不会分析、出售或分享用户数据

联系信息：
[你的邮箱]
```

---

## 🔧 四、开发/生产环境切换

### 方案 1：使用环境变量（推荐）

#### 1. 创建环境配置文件

`frontend/.env.development`:
```env
VITE_API_URL=http://localhost:8000/api/v1
```

`frontend/.env.production`:
```env
VITE_API_URL=https://your-backend-url.railway.app/api/v1
```

#### 2. 修改 `vite.config.js`：

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
  },
});
```

#### 3. 修改 `api.js`：

```javascript
const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
```

#### 4. 修改 `background.js`（需要构建时替换）：

使用 `vite-plugin-replace`：

```bash
npm install --save-dev vite-plugin-replace
```

`vite.config.js`:

```javascript
import replace from 'vite-plugin-replace';

export default defineConfig({
  plugins: [
    react(),
    replace({
      __BACKEND_URL__: process.env.VITE_API_URL || 'http://localhost:8000',
    }),
  ],
});
```

`background.js`:

```javascript
const BACKEND_URL = __BACKEND_URL__;
```

### 方案 2：构建脚本自动替换

创建 `frontend/scripts/replace-api-url.js`：

```javascript
const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const apiUrl = isProduction 
  ? 'https://your-backend-url.railway.app'
  : 'http://localhost:8000';

const backgroundJsPath = path.join(__dirname, '../dist/assets/background.js');
let content = fs.readFileSync(backgroundJsPath, 'utf8');
content = content.replace(/http:\/\/localhost:8000/g, apiUrl);
fs.writeFileSync(backgroundJsPath, content);

console.log(`✅ API URL replaced: ${apiUrl}`);
```

在 `package.json` 中添加：

```json
{
  "scripts": {
    "build": "vite build && node scripts/replace-api-url.js"
  }
}
```

---

## 📝 五、部署检查清单

### 后端部署前：

- [ ] 环境变量已设置（`DASHSCOPE_API_KEY`）
- [ ] 后端服务可以正常启动
- [ ] API 端点可以访问
- [ ] CORS 配置正确（允许 Chrome 扩展访问）

### 插件打包前：

- [ ] API 地址已更新为生产环境
- [ ] `npm run build` 成功
- [ ] `dist` 目录包含所有必需文件
- [ ] `manifest.json` 版本号已更新
- [ ] 测试插件在本地可以正常工作

### 上架前：

- [ ] ZIP 包大小合理（< 10MB）
- [ ] 图标已准备（多尺寸）
- [ ] 截图已准备
- [ ] 描述已写好
- [ ] 隐私政策已准备（如需要）

---

## 🚀 快速部署命令

### 后端（Railway）：

```bash
# 1. 安装 Railway CLI
npm i -g @railway/cli

# 2. 登录
railway login

# 3. 初始化项目
cd backend/app
railway init

# 4. 设置环境变量
railway variables set DASHSCOPE_API_KEY=your_key

# 5. 部署
railway up
```

### 插件打包：

```bash
# 1. 构建
cd frontend
npm run build

# 2. 打包
cd dist
zip -r ../../tab-cleaner-extension.zip . -x "*.DS_Store"
```

---

## 📞 常见问题

### Q: 后端部署后无法访问？

A: 检查：
1. 端口是否正确（Railway 使用 `$PORT` 环境变量）
2. CORS 配置是否正确
3. 防火墙规则

### Q: 插件无法连接到后端？

A: 检查：
1. `background.js` 中的 API URL 是否正确
2. Chrome 扩展的权限是否正确
3. 后端 CORS 是否允许扩展访问

### Q: 打包文件太大？

A: 优化：
1. 删除 `node_modules`
2. 压缩图片
3. 使用代码压缩（Vite 已自动处理）

---

## 📚 参考资源

- [Railway 文档](https://docs.railway.app/)
- [Chrome Web Store 上架指南](https://developer.chrome.com/docs/webstore/publish/)
- [FastAPI 部署指南](https://fastapi.tiangolo.com/deployment/)

