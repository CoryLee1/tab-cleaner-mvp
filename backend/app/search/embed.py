"""
统一的多模态 Embedding 模块
使用 qwen2.5-vl-embedding 处理文本和图像，确保它们在同一个向量空间
"""
from __future__ import annotations

import httpx
from typing import Optional, List

from .config import MM_EMBED_ENDPOINT, MM_EMBED_MODEL, MM_EMBED_DIM, get_api_key
from .preprocess import download_image, process_image


async def qwen_embed(input_data: dict) -> Optional[List[float]]:
    """
    统一的 Qwen Multimodal-Embedding API 调用
    
    Args:
        input_data: 包含 input.contents 的字典，例如：
            {"input": {"contents": [{"text": "hello"}]}}
            或
            {"input": {"contents": [{"image": "base64..."}]}}
    
    Returns:
        Embedding向量，失败返回None
    """
    api_key = get_api_key()
    if not api_key:
        print(f"[Embed] ERROR: API key not found")
        return None
    
    try:
        payload = {
            "model": MM_EMBED_MODEL,
            **input_data
        }
        
        # qwen2.5-vl-embedding 支持 dimensions 参数
        if MM_EMBED_MODEL == "qwen2.5-vl-embedding":
            payload["parameters"] = {
                "dimensions": MM_EMBED_DIM
            }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                MM_EMBED_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            
            if resp.status_code != 200:
                error_text = resp.text[:500]
                print(f"[Embed] ERROR: HTTP {resp.status_code}, response: {error_text}")
                return None
            
            data = resp.json()
            embs = data.get("output", {}).get("embeddings") or []
            
            if not embs:
                print(f"[Embed] ERROR: No embeddings in response. Response keys: {list(data.keys())}")
                return None
            
            # 取第一个 embedding（响应格式：output.embeddings[0].embedding）
            if embs and isinstance(embs[0].get("embedding"), list):
                emb = embs[0]["embedding"]
                print(f"[Embed] SUCCESS: Generated {len(emb)}-dim vector")
                return emb
            
            print(f"[Embed] ERROR: Invalid embedding format")
            return None
            
    except Exception as e:
        print(f"[Embed] EXCEPTION: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


async def embed_text(text: str) -> Optional[List[float]]:
    """
    生成文本的 Embedding 向量
    
    Args:
        text: 文本内容
    
    Returns:
        Embedding向量，失败返回None
    """
    if not text or not text.strip():
        print(f"[Embed] WARNING: Empty text provided")
        return None
    
    input_data = {
        "input": {
            "contents": [
                {"text": text}
            ]
        }
    }
    
    return await qwen_embed(input_data)


async def embed_image(image_base64_or_url: str) -> Optional[List[float]]:
    """
    生成图像的 Embedding 向量
    
    注意：
    - 如果输入是 URL，会先下载并转换为 Base64，避免 API "download form url error" 错误
    - 如果输入是 Base64（data:image/jpeg;base64,xxx 格式），直接使用
    
    通常从 pipeline.py 调用时，传入的应该是 Base64（因为 pipeline 已经下载并处理了）
    但如果直接传入 URL，此函数也会处理
    
    Args:
        image_base64_or_url: Base64编码的图片（data:image/jpeg;base64,xxx 格式）或图片URL
    
    Returns:
        Embedding向量，失败返回None
    """
    if not image_base64_or_url:
        print(f"[Embed] WARNING: Empty image data provided")
        return None
    
    # 检查输入类型
    is_url = image_base64_or_url.startswith("http://") or image_base64_or_url.startswith("https://")
    is_data_uri = image_base64_or_url.startswith("data:image")
    
    # 如果输入是 URL，先下载并转换为 Base64（避免 API 无法访问 URL 的问题）
    # 注意：通常 pipeline.py 已经下载并转换了，这里作为兜底处理
    if is_url:
        print(f"[Embed] URL detected (fallback), downloading: {image_base64_or_url[:50]}...")
        try:
            image_data = await download_image(image_base64_or_url)
            if image_data:
                print(f"[Embed] Downloaded {len(image_data)} bytes, processing...")
                img_b64 = process_image(image_data)
                if img_b64:
                    # 重要：process_image 返回的是完整的 Data URI 格式（data:image/jpeg;base64,xxx）
                    # API 要求使用完整的 Data URI 格式，不要去掉前缀！
                    print(f"[Embed] Processed to Base64 Data URI (length: {len(img_b64)})")
                    
                    # 直接使用完整的 Data URI 格式
                    input_data = {
                        "input": {
                            "contents": [
                                {
                                    "image": img_b64  # 使用完整的 data:image/jpeg;base64,{data} 格式
                                }
                            ]
                        }
                    }
                    print(f"[Embed] Calling API with Base64 Data URI (total length: {len(img_b64)})")
                    return await qwen_embed(input_data)
                else:
                    print(f"[Embed] ERROR: process_image returned None")
                    return None
            else:
                print(f"[Embed] ERROR: download_image returned None")
                return None
        except Exception as e:
            print(f"[Embed] EXCEPTION downloading/processing image: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    # 处理 base64 格式（通常是这种情况，因为 pipeline.py 已经下载并转换了）
    # 重要：API 要求 Base64 格式必须是完整的 Data URI：data:image/{format};base64,{data}
    # 不要去掉前缀！直接使用 process_image 返回的完整格式
    image_data_for_api = image_base64_or_url
    
    # 如果已经是 Data URI 格式（data:image/jpeg;base64,xxx），直接使用
    if image_base64_or_url.startswith("data:image"):
        print(f"[Embed] Using Base64 Data URI format (length: {len(image_data_for_api)})")
    else:
        # 如果是纯 base64 字符串（理论上不应该发生，因为 process_image 总是返回 Data URI）
        # 但为了兼容性，我们添加前缀
        print(f"[Embed] WARNING: Raw Base64 detected, adding Data URI prefix")
        image_data_for_api = f"data:image/jpeg;base64,{image_base64_or_url}"
    
    input_data = {
        "input": {
            "contents": [
                {
                    "image": image_data_for_api  # 使用完整的 Data URI 格式
                }
            ]
        }
    }
    
    print(f"[Embed] Calling API with Base64 Data URI (total length: {len(image_data_for_api)})")
    return await qwen_embed(input_data)

