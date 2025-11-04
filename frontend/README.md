# Tab Cleaner Frontend

Chrome MV3 扩展前端，采用混合架构：Shadow DOM（卡片/宠物） + React（个人空间）。

## 📁 项目结构

```
frontend/
├── public/                    # Chrome 扩展静态资源（运行时直接使用，无需构建）
│   ├── assets/               
│   │   ├── background.js     # Service Worker（后台脚本）
│   │   ├── content.js         # Content Script（卡片功能）
│   │   ├── pet.js             # 宠物模块（桌面宠物功能）
│   │   ├── card.html          # 卡片 HTML 模板
│   │   ├── style.css          # 卡片样式
│   │   └── styleguide.css     # 设计规范样式
│   ├── static/
│   │   └── img/               # 图片资源（卡片、宠物、个人空间）
│   ├── manifest.json          # Chrome 扩展清单
│   ├── popup.html             # Popup 页面（备用）
│   ├── sidepanel.html         # Side Panel 页面（备用）
│   └── blank.html             # 占位页面
│
├── src/                       # React 源码（需要构建）
│   ├── personalspace/         # 个人空间入口
│   │   └── index.jsx
│   ├── screens/               # 页面组件
│   │   └── PersonalSpace/     # 个人空间主组件
│   │       ├── PersonalSpace.jsx
│   │       ├── style.css
│   │       └── index.js
│   ├── components/            # 通用组件
│   │   └── Component/         # 侧边栏组件
│   │       ├── Component.jsx
│   │       ├── style.css
│   │       └── index.js
│   ├── shared/                # 共享工具
│   │   ├── utils.js           # 资源路径工具函数（getImageUrl 等）
│   │   └── api.js             # API 调用（预留）
│   └── styleguide.css         # 设计规范样式
│
├── personalspace.html         # 个人空间 HTML 入口（Vite 构建入口）
├── vite.config.js             # Vite 构建配置
├── package.json               # 项目依赖
└── README.md                  # 项目说明
```

## 🏗️ 架构说明

### 1. 卡片功能（Shadow DOM）
- **位置**：`public/assets/content.js` + `public/assets/card.html` + `public/assets/style.css`
- **技术**：原生 JavaScript + Shadow DOM
- **特点**：不依赖 Vite 构建，直接运行
- **开发**：修改 `public/assets/` 后，在 Chrome 扩展管理页面点击"重新加载"即可

### 2. 桌面宠物功能
- **位置**：`public/assets/pet.js` + `public/assets/background.js`
- **技术**：原生 JavaScript + Shadow DOM（在页面上下文执行）
- **特点**：独立模块，通过 `chrome.scripting.executeScript` 注入
- **开发**：修改 `public/assets/pet.js` 后重新加载扩展

### 3. 个人空间功能（React）
- **位置**：`src/screens/PersonalSpace/` + `src/components/Component/` + `personalspace.html`
- **技术**：React + Vite
- **特点**：需要构建，生成 `dist/personalspace.html` 和 `dist/assets/personalspace.js`
- **开发**：修改 `src/` 后需要执行 `npm run build`

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 监听文件变化并自动构建（仅个人空间需要）
npm run dev
```

> **注意**：卡片和宠物功能在 `public/` 目录，修改后直接重新加载扩展即可，无需构建。

### 生产构建

```bash
npm run build
```

构建输出在 `dist/` 目录：
- `public/` 目录的文件会原样复制到 `dist/`
- React 应用会打包为 `dist/assets/personalspace.js`

### 加载扩展到 Chrome

1. 打开 Chrome → 扩展程序 → 开发者模式
2. 点击"加载已解压的扩展"
3. 选择 `public/` 或 `dist/` 目录
   - **开发时**：使用 `public/` 目录，修改后只需"重新加载"
   - **生产时**：使用 `dist/` 目录（需要先执行 `npm run build`）

## 📝 开发指南

### 修改卡片功能

1. 编辑 `public/assets/content.js` 或 `public/assets/card.html`
2. 在 Chrome 扩展管理页面点击"重新加载"
3. 刷新当前网页标签页

### 修改宠物功能

1. 编辑 `public/assets/pet.js`
2. 在 Chrome 扩展管理页面点击"重新加载"
3. 刷新当前网页标签页

### 修改个人空间

1. 编辑 `src/screens/PersonalSpace/` 或 `src/components/Component/`
2. 执行 `npm run build`
3. 在 Chrome 扩展管理页面点击"重新加载"
4. 打开个人空间页面查看效果

### 资源路径

- **卡片/宠物**：在 `public/assets/` 中直接使用 `chrome.runtime.getURL('static/img/xxx.png')`
- **个人空间**：使用 `src/shared/utils.js` 中的 `getImageUrl()` 函数

## 🔧 技术栈

- **卡片/宠物**：原生 JavaScript + Shadow DOM
- **个人空间**：React 18 + Vite 6
- **样式**：CSS（保持 Anima 原始设计）

## 📚 相关文档

- 主项目 README：`../README.md`
- 清理计划：`CLEANUP_PLAN.md`（已完成清理）
