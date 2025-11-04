# Tab Cleaner Frontend

Chrome MV3 扩展前端，使用 React + Vite 构建。

## 开发

1. 安装依赖：
```bash
npm install
```

2. 开发模式（监听文件变化并自动构建）：
```bash
npm run dev
```

3. 生产构建：
```bash
npm run build
```

构建输出在 `dist/` 目录。

## 加载扩展

1. 构建项目：`npm run build`
2. 打开 Chrome → 扩展程序 → 开发者模式
3. 点击"加载已解压的扩展"
4. 选择 `dist/` 目录

## 项目结构

```
frontend/
├── src/
│   ├── popup/          # Popup 页面（React）
│   ├── sidepanel/      # Side Panel 页面（React）
│   ├── background/     # Service Worker
│   ├── shared/         # 共享逻辑（API 调用等）
│   ├── screens/        # Anima 组件
│   └── icons/          # SVG 图标
├── public/             # 静态资源（构建时会复制到 dist/）
│   ├── popup.html
│   ├── sidepanel.html
│   ├── manifest.json
│   └── img/            # 图片资源
└── dist/               # 构建输出（Chrome 扩展目录）
```

## 后续扩展

如需接入 React Three Fiber：
```bash
npm install @react-three/fiber @react-three/drei three
```

然后在 `sidepanel/SidePanelApp.jsx` 中使用。

## 架构与构建约定（MVP）

- 运行时入口（插件卡片）
  - 技术：Shadow DOM + 非模块 IIFE 脚本
  - 位置：`public/assets/content.js`、`public/assets/background.js`、`public/assets/style.css`、`public/assets/styleguide.css`
  - 资源：`public/static/img/*`
  - 清单：`public/manifest.json`（指向 `assets/background.js`；content 由 SW 注入）
  - 特性：不依赖 Vite 打包产物，public 会在构建时原样复制到 dist，路径不变

- 源码保留（未来“个人空间/React 页面”）
  - 位置：`src/screens/Card/*`、`src/shared/api.js`、`src/background/index.js` 等
  - 现在不参与插件卡片渲染，仅用于将来切回 Vite + React 的页面开发

### 开发与构建

- 调整插件卡片（Shadow DOM）：
  - 直接改 `public/assets/*` 或 `public/static/img/*`
  - 打开扩展管理页点击“重新加载”即可；如需产物，执行 `npm run build` → `dist/` 下文件与 `public/` 路径一致

- 调整 React 页面（未来“个人空间”）：
  - 当前 Vite 未配置入口（`vite.config.js` 的 `rollupOptions.input = {}`）
  - 需要时，再把入口加回去（例如 `app: resolve(__dirname, "src/app/index.jsx")`），再 `npm run build` 产出 React 页面的打包文件

### 目录稳定性

- `public/` → 构建时“原样拷贝”到 `dist/`（不会被改名/哈希/拆包）
- `src/` → 仅作为源码保留，不影响当前插件卡片运行（除非重新把入口加到 Vite）

