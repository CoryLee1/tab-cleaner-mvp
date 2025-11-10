# 文档卡片视觉锚点优化

## 问题分析

用户提出的两个关键问题：

1. **标签页不存在时无法前端截图**：
   - 如果文档类标签页没有打开，前端 `captureVisibleTab` 无法截图
   - 需要等待后端截图完成

2. **先用 OpenGraph 标题+类型渲染到卡片上**：
   - 工作文档的 OpenGraph 标题很有用
   - 应该先用标题+类型生成文档卡片作为视觉锚点
   - 等截图返回后替换

## 优化方案

### 1. 文档类网页处理流程

**后端逻辑：**
```
1. 识别为文档类网页
   ↓
2. 尝试抓取 OpenGraph（获取标题、描述、站点名称）
   ↓
3. 总是生成文档卡片（包含 OpenGraph 标题+类型）
   - 即使有 OpenGraph 图片，也生成文档卡片
   - 文档卡片包含：标题、类型、站点名称、URL
   ↓
4. 标记 pending_screenshot = true（等待截图替换）
   ↓
5. 异步尝试后端截图（不阻塞返回）
   - 如果截图成功，替换文档卡片
   - 如果截图失败，保持文档卡片
```

### 2. 前端截图逻辑

**前端逻辑：**
```
1. 尝试前端截图（只对实际存在的标签页）
   ↓
2. 前端截图成功：
   - 立即关闭标签页
   - 替换文档卡片为截图
   ↓
3. 前端截图失败（标签页不存在）：
   - 不关闭标签页
   - 等待后端截图完成
   - 后端截图完成后替换文档卡片
```

### 3. 标签页关闭时机

**优化后的关闭逻辑：**
- ✅ **前端截图成功的文档类标签页**：立即关闭
- ⏳ **前端截图失败的文档类标签页**：等待后端截图完成（后端不依赖标签页存在）
- ✅ **其他标签页**：后端 API 返回后关闭

## 代码变更

### 后端 (`opengraph.py`)

1. **文档类网页总是生成文档卡片**：
   ```python
   # 对于文档类网页，总是生成文档卡片作为视觉锚点
   # 即使有 OpenGraph 图片，也生成文档卡片，等截图返回后替换
   doc_card_data_uri = generate_doc_card_data_uri(
       title=result["title"],  # 使用 OpenGraph 标题
       url=url,
       site_name=result["site_name"],
       description=result.get("description", ""),
   )
   result["image"] = doc_card_data_uri
   result["is_doc_card"] = True
   result["pending_screenshot"] = True  # 标记等待截图替换
   ```

2. **后端截图更新逻辑**：
   ```python
   async def _try_backend_screenshot(url: str, result: Dict, wait_for_completion: bool = False):
       # 如果截图成功，替换文档卡片
       if screenshot_b64:
           result["image"] = screenshot_b64
           result["is_screenshot"] = True
           result["is_doc_card"] = False
           result["pending_screenshot"] = False
   ```

### 前端 (`background.js`)

1. **只关闭成功截图的标签页**：
   ```javascript
   // 前端截图完成后，只关闭成功截图的标签页
   const successfullyScreenshotTabIds = screenshotResults
     .filter(result => result.screenshot && result.tabId)
     .map(result => result.tabId);
   
   // 关闭这些标签页
   for (const tabId of successfullyScreenshotTabIds) {
     await chrome.tabs.remove(tabId);
   }
   ```

2. **记录前端截图失败的 URL**：
   ```javascript
   // 记录哪些文档类标签页前端截图失败（需要等待后端截图）
   const failedScreenshotUrls = screenshotResults
     .filter(result => !result.screenshot && isDocLikeUrl(result.url))
     .map(result => result.url);
   ```

3. **合并截图时标记完成**：
   ```javascript
   if (frontendScreenshot) {
     return {
       ...item,
       image: frontendScreenshot,
       is_screenshot: true,
       is_doc_card: false,
       pending_screenshot: false, // 截图完成
     };
   }
   ```

## 用户体验改进

### 之前的问题：
- ❌ 文档类网页没有立即显示
- ❌ 标签页不存在时无法截图
- ❌ 没有视觉锚点

### 现在的优势：
- ✅ **立即显示文档卡片**：包含 OpenGraph 标题+类型，作为视觉锚点
- ✅ **前端截图优先**：如果标签页存在，快速截图并替换
- ✅ **后端截图兜底**：如果标签页不存在，后端截图完成后替换
- ✅ **标签页及时关闭**：前端截图成功的立即关闭，失败的等待后端

## 数据流

```
用户点击"Clean Button"
  ↓
前端尝试截图文档类标签页
  ├─ 成功 → 立即关闭标签页，替换文档卡片
  └─ 失败 → 保持标签页，等待后端截图
  ↓
后端快速返回（包含文档卡片，pending_screenshot=true）
  ↓
个人空间立即显示文档卡片（视觉锚点）
  ↓
后端截图完成（异步）
  ├─ 成功 → 替换文档卡片为截图
  └─ 失败 → 保持文档卡片
```

## 文档卡片内容

文档卡片包含：
- **图标**：根据类型（💻 代码仓库、📚 文档、🤝 协作工具等）
- **类型标签**：如"代码仓库"、"文档"、"博客"
- **标题**：OpenGraph 标题（如果有）
- **站点名称**：OpenGraph 站点名称或从 URL 提取
- **URL 预览**：显示在卡片底部

## 相关文件

- `backend/app/opengraph.py` - 后端 OpenGraph 抓取（已优化）
- `backend/app/doc_card_generator.py` - 文档卡片生成器
- `frontend/public/assets/background.js` - 前端清理逻辑（已优化）
- `frontend/src/screens/PersonalSpace/PersonalSpace.jsx` - 前端显示逻辑（已支持文档卡片）

