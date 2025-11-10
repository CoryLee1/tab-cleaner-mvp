"""
OpenGraph 抓取工具
支持截图功能：当 OpenGraph 抓取失败或识别为文档类网页时，使用截图
"""
import httpx
from bs4 import BeautifulSoup
from typing import Dict, List, Optional
import asyncio
import json
from pathlib import Path

# 延迟导入 screenshot 模块，避免 Playwright 未安装时出错
try:
    from screenshot import get_screenshot_as_base64, is_doc_like_url
    SCREENSHOT_AVAILABLE = True
except ImportError:
    SCREENSHOT_AVAILABLE = False
    print("[OpenGraph] WARNING: Screenshot module not available. Screenshot fallback disabled.")
    
    # 提供占位函数
    def is_doc_like_url(url: str) -> bool:
        """占位函数：判断是否为文档类网页"""
        url_lower = url.lower()
        doc_keywords = [
            "github.com",
            "readthedocs.io",
            "/docs/",
            "developer.",
            "dev.",
            "documentation",
            "wiki",
        ]
        return any(keyword in url_lower for keyword in doc_keywords)
    
    async def get_screenshot_as_base64(url: str) -> Optional[str]:
        """占位函数：获取截图"""
        return None


async def _try_backend_screenshot(url: str, result: Dict, wait_for_completion: bool = False) -> None:
    """
    异步尝试后端截图
    如果截图成功，会更新 result 字典（替换文档卡片）
    
    Args:
        url: 要截图的 URL
        result: 结果字典（会被更新）
        wait_for_completion: 如果为 True，等待截图完成（用于前端截图失败的情况）
    """
    try:
        from screenshot import get_screenshot_as_base64
        screenshot_b64 = await get_screenshot_as_base64(url)
        if screenshot_b64:
            # 更新结果（替换文档卡片）
            result["image"] = screenshot_b64
            result["is_screenshot"] = True
            result["is_doc_card"] = False  # 不再是文档卡片
            result["pending_screenshot"] = False  # 截图完成
            print(f"[OpenGraph] Backend screenshot completed for: {url[:60]}...")
        else:
            result["pending_screenshot"] = False  # 截图失败，保持文档卡片
            print(f"[OpenGraph] Backend screenshot failed (no image) for: {url[:60]}...")
    except Exception as e:
        result["pending_screenshot"] = False  # 截图失败，保持文档卡片
        print(f"[OpenGraph] Backend screenshot failed (error) for: {url[:60]}... Error: {str(e)}")


async def fetch_opengraph(url: str, timeout: float = 10.0, use_screenshot_fallback: bool = True) -> Dict:
    """
    抓取单个 URL 的 OpenGraph 数据
    
    如果 OpenGraph 抓取失败或识别为文档类网页，将使用截图作为后备方案
    
    Args:
        url: 要抓取的网页 URL
        timeout: 请求超时时间（秒）
        use_screenshot_fallback: 是否在失败时使用截图后备方案
    
    Returns:
        {
            "url": str,
            "title": str,
            "description": str,
            "image": str,  # OpenGraph 图片 URL 或截图 Base64
            "site_name": str,
            "success": bool,
            "error": Optional[str],
            "is_screenshot": bool,  # 是否为截图
        }
    """
    result = {
        "url": url,
        "title": "",
        "description": "",
        "image": "",
        "site_name": "",
        "success": False,
        "error": None,
        "is_screenshot": False,
    }

    # 检查是否为文档类网页
    is_doc_like = is_doc_like_url(url)
    
    if is_doc_like:
        print(f"[OpenGraph] URL identified as doc-like: {url[:60]}...")
        # 对于文档类网页，先尝试抓取 OpenGraph（作为兜底显示）
        # 然后后端截图作为后续更新（如果前端截图失败）
        try:
            # 先尝试抓取 OpenGraph（快速返回，用于立即显示）
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                try:
                    response = await client.get(url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    })
                    response.raise_for_status()
                    
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # 提取 OpenGraph 标签
                    og_title = soup.find('meta', property='og:title')
                    og_description = soup.find('meta', property='og:description')
                    og_image = soup.find('meta', property='og:image')
                    og_site_name = soup.find('meta', property='og:site_name')
                    
                    # 提取标准 meta 标签作为后备
                    meta_title = soup.find('meta', attrs={'name': 'title'}) or soup.find('title')
                    meta_description = soup.find('meta', attrs={'name': 'description'})
                    
                    result["title"] = (
                        og_title.get('content', '') if og_title else
                        (meta_title.string if meta_title and hasattr(meta_title, 'string') else meta_title.get('content', '')) if meta_title else
                        url
                    )
                    
                    result["description"] = (
                        og_description.get('content', '') if og_description else
                        meta_description.get('content', '') if meta_description else
                        ''
                    )
                    
                    result["image"] = og_image.get('content', '') if og_image else ''
                    
                    # 处理相对路径的图片 URL
                    if result["image"] and not result["image"].startswith(('http://', 'https://')):
                        from urllib.parse import urljoin
                        result["image"] = urljoin(url, result["image"])
                    
                    result["site_name"] = og_site_name.get('content', '') if og_site_name else ''
                except Exception as og_error:
                    # OpenGraph 抓取失败，继续使用文档卡片
                    print(f"[OpenGraph] OpenGraph fetch failed for doc-like URL: {og_error}")
                    result["title"] = url
                    result["description"] = ""
                    result["image"] = ""
                    result["site_name"] = ""
            
            # 对于文档类网页，总是生成文档卡片作为视觉锚点（包含标题+类型）
            # 即使有 OpenGraph 图片，也生成文档卡片，等截图返回后替换
            from doc_card_generator import generate_doc_card_data_uri, detect_doc_type
            from urllib.parse import urlparse
            
            parsed = urlparse(url)
            site_name = result.get("site_name") or parsed.netloc or ""
            if site_name.startswith("www."):
                site_name = site_name[4:]
            
            if not result.get("title") or result["title"] == url:
                path_parts = [p for p in parsed.path.split("/") if p]
                result["title"] = path_parts[-1] if path_parts else site_name or url
            
            if not result.get("site_name"):
                result["site_name"] = site_name
            
            # 检测文档类型
            doc_type_info = detect_doc_type(url, result["site_name"])
            result["doc_type"] = doc_type_info.get("type", "网页")
            
            # 生成文档卡片（包含 OpenGraph 标题+类型，作为视觉锚点）
            doc_card_data_uri = generate_doc_card_data_uri(
                title=result["title"],
                url=url,
                site_name=result["site_name"],
                description=result.get("description", ""),
            )
            
            # 使用文档卡片作为初始图片（等截图返回后替换）
            result["image"] = doc_card_data_uri
            result["is_doc_card"] = True
            result["pending_screenshot"] = True  # 标记等待截图替换
            
            # 标记为文档类
            result["is_doc_like"] = True
            result["success"] = True
            
            # 后端截图作为后续更新
            # 如果前端截图失败（标签页不存在），需要等待后端截图完成
            # 否则异步进行（不阻塞返回）
            if SCREENSHOT_AVAILABLE:
                # 默认异步进行（不阻塞），前端会处理等待逻辑
                asyncio.create_task(_try_backend_screenshot(url, result, wait_for_completion=False))
            
            return result
        except Exception as e:
            result["error"] = f"处理文档类网页异常: {str(e)}"
            result["success"] = False
            return result

    # 尝试抓取 OpenGraph
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 提取 OpenGraph 标签
            og_title = soup.find('meta', property='og:title')
            og_description = soup.find('meta', property='og:description')
            og_image = soup.find('meta', property='og:image')
            og_site_name = soup.find('meta', property='og:site_name')
            
            # 提取标准 meta 标签作为后备
            meta_title = soup.find('meta', attrs={'name': 'title'}) or soup.find('title')
            meta_description = soup.find('meta', attrs={'name': 'description'})
            
            result["title"] = (
                og_title.get('content', '') if og_title else
                (meta_title.string if meta_title and hasattr(meta_title, 'string') else meta_title.get('content', '')) if meta_title else
                url
            )
            
            result["description"] = (
                og_description.get('content', '') if og_description else
                meta_description.get('content', '') if meta_description else
                ''
            )
            
            result["image"] = og_image.get('content', '') if og_image else ''
            
            # 处理相对路径的图片 URL
            if result["image"] and not result["image"].startswith(('http://', 'https://')):
                from urllib.parse import urljoin
                result["image"] = urljoin(url, result["image"])
            
            result["site_name"] = og_site_name.get('content', '') if og_site_name else ''
            
            # 如果 OpenGraph 抓取成功但没有图片，且启用截图后备，则使用截图
            if result["image"]:
                result["success"] = True
            elif use_screenshot_fallback and SCREENSHOT_AVAILABLE:
                print(f"[OpenGraph] No og:image found, using screenshot fallback: {url[:60]}...")
                screenshot_b64 = await get_screenshot_as_base64(url)
                if screenshot_b64:
                    result["image"] = screenshot_b64
                    result["is_screenshot"] = True
                    result["success"] = True
                else:
                    # 截图失败，如果是文档类 URL，使用文档卡片生成器
                    if is_doc_like_url(url):
                        print(f"[OpenGraph] Screenshot failed for doc-like URL, generating doc card: {url[:60]}...")
                        from doc_card_generator import generate_doc_card_data_uri, detect_doc_type
                        from urllib.parse import urlparse
                        
                        parsed = urlparse(url)
                        site_name = parsed.netloc or ""
                        if site_name.startswith("www."):
                            site_name = site_name[4:]
                        
                        path_parts = [p for p in parsed.path.split("/") if p]
                        title = result.get("title") or (path_parts[-1] if path_parts else site_name or url)
                        
                        doc_card_data_uri = generate_doc_card_data_uri(
                            title=title,
                            url=url,
                            site_name=result.get("site_name") or site_name,
                            description=result.get("description", ""),
                        )
                        
                        result["image"] = doc_card_data_uri
                        result["is_screenshot"] = False
                        result["is_doc_card"] = True
                        result["success"] = True
                        result["doc_type"] = detect_doc_type(url, result.get("site_name", "")).get("type", "网页")
                    else:
                        result["success"] = False
                        result["error"] = "OpenGraph 抓取成功但无图片，且截图生成失败"
            else:
                result["success"] = True  # 即使没有图片，也算成功
            
    except Exception as e:
        result["error"] = str(e)
        result["success"] = False
        
        # 如果 OpenGraph 抓取失败，且启用截图后备，则使用截图
        if use_screenshot_fallback and SCREENSHOT_AVAILABLE:
            print(f"[OpenGraph] OpenGraph fetch failed, using screenshot fallback: {url[:60]}...")
            try:
                screenshot_b64 = await get_screenshot_as_base64(url)
                if screenshot_b64:
                    result["image"] = screenshot_b64
                    result["is_screenshot"] = True
                    result["success"] = True
                    result["title"] = url  # 使用 URL 作为标题
                    result["description"] = "网页截图（OpenGraph 抓取失败）"
                    # 尝试从 URL 提取站点名称
                    from urllib.parse import urlparse
                    parsed = urlparse(url)
                    result["site_name"] = parsed.netloc or ""
                    result["error"] = None  # 清除错误，因为截图成功
                else:
                    # 截图失败，如果是文档类 URL，使用文档卡片生成器
                    if is_doc_like_url(url):
                        print(f"[OpenGraph] Screenshot failed for doc-like URL, generating doc card: {url[:60]}...")
                        from doc_card_generator import generate_doc_card_data_uri, detect_doc_type
                        from urllib.parse import urlparse
                        
                        parsed = urlparse(url)
                        site_name = parsed.netloc or ""
                        if site_name.startswith("www."):
                            site_name = site_name[4:]
                        
                        path_parts = [p for p in parsed.path.split("/") if p]
                        title = path_parts[-1] if path_parts else site_name or url
                        
                        doc_card_data_uri = generate_doc_card_data_uri(
                            title=title,
                            url=url,
                            site_name=site_name,
                            description="网页卡片（OpenGraph 抓取失败）",
                        )
                        
                        result["image"] = doc_card_data_uri
                        result["is_screenshot"] = False
                        result["is_doc_card"] = True
                        result["success"] = True
                        result["title"] = title
                        result["description"] = "网页卡片（OpenGraph 抓取失败）"
                        result["site_name"] = site_name
                        result["doc_type"] = detect_doc_type(url, site_name).get("type", "网页")
                        result["error"] = None  # 清除错误，因为卡片生成成功
                    else:
                        result["error"] = f"OpenGraph 抓取失败且截图生成失败: {str(e)}"
            except Exception as screenshot_error:
                # 如果截图也失败，且是文档类 URL，尝试生成文档卡片
                if is_doc_like_url(url):
                    try:
                        from doc_card_generator import generate_doc_card_data_uri, detect_doc_type
                        from urllib.parse import urlparse
                        
                        parsed = urlparse(url)
                        site_name = parsed.netloc or ""
                        if site_name.startswith("www."):
                            site_name = site_name[4:]
                        
                        path_parts = [p for p in parsed.path.split("/") if p]
                        title = path_parts[-1] if path_parts else site_name or url
                        
                        doc_card_data_uri = generate_doc_card_data_uri(
                            title=title,
                            url=url,
                            site_name=site_name,
                            description="网页卡片（OpenGraph 和截图均失败）",
                        )
                        
                        result["image"] = doc_card_data_uri
                        result["is_screenshot"] = False
                        result["is_doc_card"] = True
                        result["success"] = True
                        result["title"] = title
                        result["description"] = "网页卡片（OpenGraph 和截图均失败）"
                        result["site_name"] = site_name
                        result["doc_type"] = detect_doc_type(url, site_name).get("type", "网页")
                        result["error"] = None
                    except Exception as card_error:
                        result["error"] = f"OpenGraph 抓取失败: {str(e)}，截图生成异常: {str(screenshot_error)}，卡片生成异常: {str(card_error)}"
                else:
                    result["error"] = f"OpenGraph 抓取失败: {str(e)}，截图生成异常: {str(screenshot_error)}"
    
    return result


async def fetch_multiple_opengraph(urls: List[str]) -> List[Dict]:
    """
    并发抓取多个 URL 的 OpenGraph 数据
    """
    tasks = [fetch_opengraph(url) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 处理异常结果
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            processed_results.append({
                "url": urls[i],
                "title": "",
                "description": "",
                "image": "",
                "site_name": "",
                "success": False,
                "error": str(result)
            })
        else:
            processed_results.append(result)
    
    return processed_results


