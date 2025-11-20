# ✅ 正确的 OpenGraph 数据处理流程

## 🔄 完整数据流

```
1. 页面提取
   image: "https://example.com/image.jpg"  (字符串 URL)
   ↓
2. 发送到后端
   image: "https://example.com/image.jpg"  (字符串 URL)
   ↓
3. 后端下载图片
   image URL → 下载 → Base64 字符串
   ↓
4. 生成 embedding
   Base64 → embedding API → [0.1, 0.2, ...] (数组，1024维)
   ↓
5. 存储到数据库
   image: "https://example.com/image.jpg"           (字符串，保持不变)
   text_embedding: "[0.1,0.2,0.3,...]"            (数组 → 字符串)
   image_embedding: "[0.1,0.2,0.3,...]"           (数组 → 字符串)
```

## 📋 字段类型说明

### image 字段
- **类型**: `str` (字符串)
- **值**: URL 或 Base64 字符串
- **处理**: 不需要转换，保持字符串格式
- **异常处理**: 如果遇到数组（异常情况），取第一个元素

### text_embedding / image_embedding 字段
- **类型**: `List[float]` (数组，1024维)
- **值**: `[0.1, 0.2, 0.3, ...]` (1024个浮点数)
- **处理**: 需要转换为字符串格式 `"[0.1,0.2,0.3,...]"` 才能存入 PostgreSQL
- **转换函数**: `to_vector_str()`

## 🎯 关键理解

1. **image 字段**: 始终是字符串，不需要数组转换
2. **embedding 字段**: 是数组，需要转换为字符串格式存储
3. **防御性代码**: image 字段的数组处理只是防止异常数据崩溃，正常情况下不会执行

