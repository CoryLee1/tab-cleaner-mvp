"""
OpenGraph 抓取工具
"""
import httpx
from bs4 import BeautifulSoup
from typing import Dict, List, Optional
import asyncio


async def fetch_opengraph(url: str, timeout: float = 10.0) -> Dict:
    """
    抓取单个 URL 的 OpenGraph 数据
    
    Returns:
        {
            "url": str,
            "title": str,
            "description": str,
            "image": str,
            "site_name": str,
            "success": bool,
            "error": Optional[str]
        }
    """
    result = {
        "url": url,
        "title": "",
        "description": "",
        "image": "",
        "site_name": "",
        "success": False,
        "error": None
    }

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
            result["success"] = True
            
    except Exception as e:
        result["error"] = str(e)
        result["success"] = False
    
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


