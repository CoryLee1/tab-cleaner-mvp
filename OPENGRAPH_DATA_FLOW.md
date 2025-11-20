# OpenGraph JSON 数据处理流程详解

## 📋 数据流概览

```
页面 DOM → opengraph_local.js → content.js → background.js → 后端 API → 数据库
```

## 🔄 完整处理流程

### 阶段 1: 前端提取 (opengraph_local.js)

**输入**: 页面 DOM  
**输出**: 原始 OpenGraph JSON 对象

```javascript
// 示例：从页面提取的原始数据
const rawOGData = {
  url: "https://example.com/page",
  title: "页面标题",
  description: "页面描述",
  image: "https://example.com/image.jpg",  // ✅ 正常情况：字符串（URL）
  site_name: "Example Site",
  success: true,
  is_local_fetch: true
}
```

**正常情况**: `image` 是字符串（URL）  
**异常情况**: 某些网站可能返回数组（需要防御性处理）

---

### 阶段 2: 前端规范化 (background.js)

**位置**: `frontend/public/assets/background.js`  
**函数**: `normalizeItem()`

**处理逻辑**:

```javascript
const normalizeItem = (item) => {
  const normalized = {
    // 1. 字符串字段：trim 并处理 null
    url: String(item.url || '').trim(),
    title: item.title ? String(item.title).trim() : null,
    description: item.description ? String(item.description).trim() : null,
    site_name: item.site_name ? String(item.site_name).trim() : null,
    
    // 2. 关键：image 字段处理（数组 → 字符串）
    image: null,  // 先设为 null
    // ... 然后处理
  };
  
  // ✅ 关键处理：image 字段
  let image = item.image;
  if (image) {
    if (Array.isArray(image)) {
      // 如果是数组，取第一个元素
      image = image.length > 0 ? String(image[0]).trim() : null;
    } else if (typeof image === 'string') {
      image = image.trim() || null;
    } else {
      image = String(image).trim() || null;
    }
  }
  normalized.image = image;
  
  // 3. 数字字段：转换为整数或 null
  normalized.tab_id = item.tab_id !== undefined && item.tab_id !== null 
    ? Number(item.tab_id) 
    : null;
  
  // 4. 布尔字段：确保是布尔值
  normalized.is_doc_card = Boolean(item.is_doc_card || false);
  normalized.success = Boolean(item.success !== undefined ? item.success : true);
  
  return normalized;
};
```

**处理后的数据**:

```javascript
const normalizedData = {
  url: "https://example.com/page",
  title: "页面标题",
  description: "页面描述",
  image: "https://example.com/image.jpg",  // ✅ 确保是字符串
  site_name: "Example Site",
  tab_id: 123,  // ✅ 确保是数字或 null
  tab_title: "标签页标题",
  is_doc_card: false,  // ✅ 确保是布尔值
  success: true,
  // ... 其他字段
}
```

---

### 阶段 3: 发送到后端 (background.js → API)

**HTTP 请求**:

```javascript
fetch(`${apiUrl}/api/v1/search/embedding`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    opengraph_items: [normalizedData]  // ✅ 已规范化的数据
  })
})
```

**JSON 请求体**:

```json
{
  "opengraph_items": [
    {
      "url": "https://example.com/page",
      "title": "页面标题",
      "description": "页面描述",
      "image": "https://example.com/image.jpg",
      "site_name": "Example Site",
      "tab_id": 123,
      "tab_title": "标签页标题",
      "is_doc_card": false,
      "is_screenshot": false,
      "success": true
    }
  ]
}
```

---

### 阶段 4: 后端接收和规范化 (main.py)

**位置**: `backend/app/main.py`  
**端点**: `/api/v1/search/embedding`

```python
from search.normalize import normalize_opengraph_items

# 1. 接收请求
request = EmbeddingRequest(opengraph_items=[...])

# 2. 规范化输入数据
normalized_items = normalize_opengraph_items(request.opengraph_items)
print(f"[API] Normalized {len(normalized_items)} items")
```

---

### 阶段 5: 后端深度规范化 (normalize.py)

**位置**: `backend/app/search/normalize.py`  
**函数**: `normalize_opengraph_item()`

**处理逻辑**:

```python
def normalize_opengraph_item(item: Dict[str, Any]) -> Dict[str, Any]:
    normalized = {}
    
    # 1. url (必需)
    normalized["url"] = str(item.get("url")).strip()
    
    # 2. title (字符串或 None)
    title = item.get("title") or item.get("og:title") or item.get("tab_title")
    normalized["title"] = str(title).strip() if title else None
    
    # 3. description (字符串或 None)
    description = item.get("description") or item.get("og:description")
    normalized["description"] = str(description).strip() if description else None
    
    # 4. ✅ image (关键处理：数组 → 字符串)
    image = item.get("image") or item.get("og:image") or item.get("thumbnail_url")
    if image:
        if isinstance(image, list):
            # 如果是数组，取第一个元素
            if len(image) > 0:
                normalized["image"] = str(image[0]).strip()
            else:
                normalized["image"] = None
        elif isinstance(image, str):
            normalized["image"] = image.strip() if image.strip() else None
        else:
            normalized["image"] = str(image).strip() if image else None
    else:
        normalized["image"] = None
    
    # 5. site_name
    site_name = item.get("site_name") or item.get("og:site_name")
    normalized["site_name"] = str(site_name).strip() if site_name else None
    
    # 6. tab_id (整数或 None)
    tab_id = item.get("tab_id")
    if tab_id is not None:
        try:
            normalized["tab_id"] = int(tab_id)
        except (ValueError, TypeError):
            normalized["tab_id"] = None
    else:
        normalized["tab_id"] = None
    
    # 7. text_embedding (向量验证)
    text_embedding = item.get("text_embedding")
    if text_embedding and isinstance(text_embedding, list) and len(text_embedding) > 0:
        try:
            normalized["text_embedding"] = [float(x) for x in text_embedding]
            # 验证维度（应该是1024）
            if len(normalized["text_embedding"]) != 1024:
                print(f"[Normalize] Warning: text_embedding has {len(normalized['text_embedding'])} dims, expected 1024")
        except (ValueError, TypeError):
            normalized["text_embedding"] = None
    else:
        normalized["text_embedding"] = None
    
    # 8. image_embedding (同上)
    # ...
    
    # 9. 布尔字段
    normalized["is_doc_card"] = bool(item.get("is_doc_card", False))
    normalized["success"] = bool(item.get("success", True))
    
    return normalized
```

---

### 阶段 6: 生成 Embedding (pipeline.py)

**位置**: `backend/app/search/pipeline.py`  
**函数**: `process_opengraph_for_search()`

```python
# 使用规范化后的数据生成 embedding
enriched_items = await process_opengraph_for_search(normalized_items)

# 每个项现在包含：
# - text_embedding: List[float] (1024维)
# - image_embedding: List[float] (1024维)
```

---

### 阶段 7: 数据库写入前最后验证 (vector_db.py)

**位置**: `backend/app/vector_db.py`  
**函数**: `upsert_opengraph_item()`

```python
async def upsert_opengraph_item(...):
    # ✅ 再次验证 image 字段
    if image is not None:
        if isinstance(image, list):
            # 如果是数组，取第一个元素
            if len(image) > 0:
                image = str(image[0]).strip()
            else:
                image = None
        elif not isinstance(image, str):
            image = str(image).strip() if image else None
        else:
            image = image.strip() if image.strip() else None
    
    # ✅ 确保字符串字段正确
    title = str(title).strip() if title else None
    description = str(description).strip() if description else None
    
    # ✅ 确保 tab_id 是整数
    if tab_id is not None:
        try:
            tab_id = int(tab_id)
        except (ValueError, TypeError):
            tab_id = None
    
    # ✅ 转换向量为字符串格式
    text_vec = to_vector_str(text_embedding)  # "[0.1,0.2,0.3,...]"
    image_vec = to_vector_str(image_embedding)
    
    # 写入数据库
    await conn.execute(f"""
        INSERT INTO {NAMESPACE}.opengraph_items (...)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector(1024), $9::vector(1024), ...)
    """, url, title, description, image, ...)
```

---

## 🎯 关键处理点总结

### 1. **image 字段处理**（防御性处理）

**正常情况**: `image` 字段始终是字符串（URL 或 Base64），如 `"https://example.com/image.jpg"`

**异常情况**: 某些网站可能返回数组 `["url1", "url2"]`（这是数据异常，需要防御性处理）

**处理**（防御性代码，正常情况下不会执行）:
```javascript
// 前端：如果遇到数组，取第一个（这是异常情况）
if (Array.isArray(image)) {
  console.warn('[Normalize] Image is array, taking first element:', image);
  image = image.length > 0 ? String(image[0]).trim() : null;
}

// 后端：如果遇到数组，取第一个（这是异常情况）
if isinstance(image, list):
    print(f"[Normalize] Warning: Image is array, taking first element: {image}")
    if len(image) > 0:
        normalized["image"] = str(image[0]).strip()
    else:
        normalized["image"] = None
```

**注意**: 正常情况下 `image` 就是字符串，不需要转换。这段代码只是防御性处理，防止数据异常导致崩溃。

### 2. **undefined/null 处理**

**问题**: JavaScript 的 `undefined` 在 JSON 中会丢失

**处理**:
```javascript
// 前端：显式转换为 null
title: item.title ? String(item.title).trim() : null

// 后端：使用 get() 默认值
title = item.get("title") or None
```

### 3. **类型转换**

**字符串字段**: `trim()` + 空字符串检查  
**数字字段**: `Number()` / `int()` + 错误处理  
**布尔字段**: `Boolean()` / `bool()`  
**向量字段**: 验证长度（1024维）

### 4. **向量格式转换**（这才是真正的数组→字符串转换）

**问题**: `text_embedding` 和 `image_embedding` 是 Python List[float]（1024维数组），但 PostgreSQL 的 `vector(1024)` 类型需要字符串格式

**处理流程**:
1. **生成 embedding**: URL/Base64 → embedding API → 返回 `List[float]` (1024维)
2. **存储到数据库**: `List[float]` → 转换为字符串 `"[0.1,0.2,0.3,...]"` → 存入 PostgreSQL

**转换函数**:
```python
def to_vector_str(vec: Optional[List[float]]) -> Optional[str]:
    """
    将 Python List[float] 转换为 PostgreSQL vector 需要的字符串格式
    
    输入: [0.1, 0.2, 0.3, ...]  (1024个浮点数)
    输出: "[0.1,0.2,0.3,...]"   (字符串格式)
    """
    if not vec:
        return None
    return "[" + ",".join(str(float(x)) for x in vec) + "]"
```

**使用位置**:
```python
# 在 vector_db.py 的 upsert_opengraph_item() 中
text_vec = to_vector_str(text_embedding)   # List[float] → "[0.1,0.2,...]"
image_vec = to_vector_str(image_embedding)  # List[float] → "[0.1,0.2,...]"

# 然后存入数据库
await conn.execute(f"""
    INSERT INTO ... VALUES (..., $8::vector(1024), $9::vector(1024), ...)
""", ..., text_vec, image_vec, ...)
```

---

## 📊 数据转换示例

### 示例 1: 正常流程（image 是字符串）

**输入（前端提取的原始数据）**:
```json
{
  "url": "https://example.com",
  "title": "  标题  ",
  "description": "描述",
  "image": "https://example.com/image.jpg",  // ✅ 正常情况：字符串
  "tab_id": 123,
  "is_doc_card": false
}
```

**处理后（规范化）**:
```json
{
  "url": "https://example.com",
  "title": "标题",  // ✅ trim 空格
  "description": "描述",
  "image": "https://example.com/image.jpg",  // ✅ 保持不变（已经是字符串）
  "tab_id": 123,
  "is_doc_card": false
}
```

**生成 embedding 后**:
```json
{
  "url": "https://example.com",
  "title": "标题",
  "image": "https://example.com/image.jpg",  // ✅ 仍然是字符串
  "text_embedding": [0.1, 0.2, 0.3, ...],   // ✅ 数组（1024维）
  "image_embedding": [0.1, 0.2, 0.3, ...]   // ✅ 数组（1024维）
}
```

**存储到数据库前（向量转换）**:
```python
{
  "url": "https://example.com",
  "title": "标题",
  "image": "https://example.com/image.jpg",           # ✅ 字符串
  "text_embedding": "[0.1,0.2,0.3,...]",              # ✅ 数组 → 字符串
  "image_embedding": "[0.1,0.2,0.3,...]"             # ✅ 数组 → 字符串
}
```

### 示例 2: 异常情况（image 是数组，防御性处理）

**输入（异常数据）**:
```json
{
  "url": "https://example.com",
  "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"]  // ⚠️ 异常：数组
}
```

**处理后（防御性处理）**:
```json
{
  "url": "https://example.com",
  "image": "https://example.com/img1.jpg"  // ✅ 取第一个元素，记录警告
}
```

---

## 🔍 调试建议

如果遇到类型错误，检查：

1. **前端发送前**: 在 `background.js` 的 `normalizeItem()` 中添加 `console.log`
2. **后端接收时**: 在 `main.py` 的 API 端点添加日志
3. **数据库写入前**: 在 `vector_db.py` 的 `upsert_opengraph_item()` 中添加日志

```python
print(f"[Debug] Image type: {type(image)}, value: {image}")
print(f"[Debug] Tab ID type: {type(tab_id)}, value: {tab_id}")
```

