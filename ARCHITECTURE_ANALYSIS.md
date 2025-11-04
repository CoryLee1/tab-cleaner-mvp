# 前后端架构结合分析

## 🎯 功能需求

用户点击卡片上的 **Clean Button** 后：
1. 获取所有打开的 tab
2. 获取每个 tab 的 OpenGraph 信息（标题、描述、图片）
3. 关闭这些 tab
4. 保存到后端（用于个人空间显示）
5. 处理 OpenGraph 获取失败的情况（用文本卡片包装）

## 📐 当前架构

### 前端架构
```
content.js (卡片 UI)
    ↓ 点击 Clean Button
    ↓ 发送消息 { action: "clean" }
background.js (Service Worker)
    ↓ 处理 clean 消息
    ↓ 需要调用后端 API
```

### 后端架构
```
main.py (FastAPI)
    ├── / (健康检查) ✅
    ├── /api/v1/sessions (待实现)
    ├── /api/v1/tabs (待实现)
    └── /api/v1/share (待实现)
```

### 现有代码
- `src/shared/api.js` - 已有 API 调用函数（但未使用）
- `content.js` - Clean Button 已发送 `{ action: "clean" }` 消息
- `background.js` - 需要处理 `clean` 消息

## 🔄 数据流设计

### 方案 A：前端主导（推荐）

```
用户点击 Clean Button
    ↓
content.js → background.js { action: "clean" }
    ↓
background.js:
  1. 获取所有 tab: chrome.tabs.query({})
  2. 遍历每个 tab，调用后端获取 OpenGraph
  3. 调用后端 API 保存 tab 数据
  4. 关闭所有 tab: chrome.tabs.remove(tabIds)
```

**优点**：
- Service Worker 可以访问 `chrome.tabs` API
- 前端控制关闭 tab 的时机
- 逻辑清晰

**后端需要提供的 API**：
- `POST /api/v1/tabs/batch` - 批量保存 tab 数据
- `POST /api/v1/tabs/opengraph` - 获取单个 URL 的 OpenGraph

### 方案 B：后端主导

```
用户点击 Clean Button
    ↓
content.js → background.js { action: "clean" }
    ↓
background.js:
  1. 获取所有 tab 信息
  2. 发送到后端 { tabs: [...] }
    ↓
后端:
  1. 接收 tab 列表
  2. 批量获取 OpenGraph
  3. 保存到数据库
  4. 返回结果
    ↓
background.js:
  5. 收到结果后关闭 tab
```

**优点**：
- 后端统一处理 OpenGraph 获取（避免 CORS）
- 可以批量处理，性能更好

**缺点**：
- 如果后端获取 OpenGraph 失败，前端无法知道具体哪个 tab 失败

## 🏗️ 推荐架构（方案 A + 后端辅助）

### 数据流

```
1. 用户点击 Clean Button
   ↓
2. content.js → background.js { action: "clean" }
   ↓
3. background.js:
   a. chrome.tabs.query({}) → 获取所有 tab
   b. 对每个 tab.url，调用后端获取 OpenGraph
      POST /api/v1/tabs/opengraph { url: "..." }
      → 返回 { title, description, image, ... }
   c. 批量保存到后端
      POST /api/v1/tabs/batch { tabs: [{ url, title, og_data, ... }] }
   d. chrome.tabs.remove(tabIds) → 关闭所有 tab
   e. 发送响应给 content.js（可选：显示成功提示）
```

### 后端 API 设计

#### 1. 获取 OpenGraph
```
POST /api/v1/tabs/opengraph
Request: { "url": "https://example.com" }
Response: {
  "title": "页面标题",
  "description": "页面描述",
  "image": "https://example.com/image.png",
  "site_name": "网站名称"
}
```

**实现方式**：
- 后端使用 Python 库（如 `requests` + `beautifulsoup4`）获取 OpenGraph
- 避免前端的 CORS 问题
- 可以设置超时和重试

**降级方案**：
- 如果获取失败，返回 `{ "title": "页面标题", "description": null, "image": null }`
- 前端可以用文本卡片包装

#### 2. 批量保存 Tab
```
POST /api/v1/tabs/batch
Request: {
  "session_id": "xxx",  # 可选，如果有会话概念
  "tabs": [
    {
      "url": "https://example.com",
      "title": "页面标题",
      "og_title": "OpenGraph 标题",
      "og_description": "OpenGraph 描述",
      "og_image": "https://example.com/image.png",
      "favicon": "https://example.com/favicon.ico",
      "created_at": "2025-11-04T..."
    },
    ...
  ]
}
Response: {
  "saved_count": 5,
  "failed_count": 0,
  "tabs": [
    { "id": "tab-1", "url": "...", ... },
    ...
  ]
}
```

### 前端代码结构

#### background.js 需要添加

```javascript
// 处理 clean 消息
if (req.action === "clean") {
  // 1. 获取所有 tab
  const tabs = await chrome.tabs.query({});
  
  // 2. 获取 OpenGraph（并行或串行）
  const tabsWithOG = await Promise.all(
    tabs.map(async (tab) => {
      try {
        const ogData = await fetchOpenGraph(tab.url);
        return { ...tab, ogData };
      } catch (e) {
        // 降级：使用 tab.title 和 favIconUrl
        return { 
          ...tab, 
          ogData: { 
            title: tab.title, 
            image: tab.favIconUrl,
            description: null 
          } 
        };
      }
    })
  );
  
  // 3. 保存到后端
  await saveTabsBatch(tabsWithOG);
  
  // 4. 关闭 tab
  const tabIds = tabs.map(t => t.id);
  await chrome.tabs.remove(tabIds);
  
  sendResponse({ ok: true, count: tabs.length });
}
```

#### 需要新增的工具函数

在 `src/shared/api.js` 中添加：
- `fetchOpenGraph(url)` - 调用后端获取 OpenGraph
- `saveTabsBatch(tabs)` - 批量保存 tab

或者在 `public/assets/` 中创建新文件，因为 background.js 不能直接 import ES module。

## 🔍 结构健康度分析

### ✅ 健康的方面

1. **职责分离清晰**：
   - `content.js` - UI 交互
   - `background.js` - 业务逻辑和 Chrome API
   - 后端 - 数据获取和存储

2. **消息传递机制完善**：
   - content.js ↔ background.js 通过 `chrome.runtime.sendMessage`
   - 已有处理其他消息的模板

3. **API 调用层已准备**：
   - `src/shared/api.js` 已有基础结构
   - 可以扩展

### ⚠️ 需要注意的点

1. **API 调用位置**：
   - `background.js` 是 Service Worker，不能直接 import ES module
   - 需要在 `public/assets/` 中创建 API 调用文件，或者直接在 background.js 中写 fetch

2. **错误处理**：
   - OpenGraph 获取可能失败（网络问题、CORS、页面无法访问）
   - 需要降级方案（使用 tab.title 和 favIconUrl）

3. **性能考虑**：
   - 如果有很多 tab，串行获取 OpenGraph 会很慢
   - 建议并行处理，但限制并发数（如 5 个同时请求）

4. **用户体验**：
   - 关闭 tab 前是否需要确认？
   - 是否需要显示处理进度？

## 📝 实现建议

### 阶段 1：基础实现
1. 后端实现 `POST /api/v1/tabs/opengraph`（单个 URL）
2. 后端实现 `POST /api/v1/tabs/batch`（批量保存）
3. `background.js` 处理 `clean` 消息
4. 简单实现：获取所有 tab → 获取 OpenGraph → 保存 → 关闭

### 阶段 2：优化
1. 并行获取 OpenGraph（限制并发）
2. 错误处理和降级方案
3. 用户反馈（进度提示）

### 阶段 3：扩展
1. 支持选择性关闭（让用户选择哪些 tab 要保存）
2. 支持延迟关闭（先保存，稍后关闭）
3. 支持撤销操作

## 🎯 结论

**结构健康度：✅ 良好**

- 当前架构清晰，职责分离明确
- 消息传递机制完善
- 只需要在 `background.js` 中添加处理逻辑
- 后端 API 设计简单明了

**建议**：
1. 在 `public/assets/` 中创建 `api.js`（IIFE 格式，供 background.js 使用）
2. 或者直接在 `background.js` 中写 fetch 调用（更简单）
3. 后端先实现单个 OpenGraph 获取，再优化为批量

**不需要过度设计**：
- 先实现基础功能
- 后续根据实际使用情况优化

