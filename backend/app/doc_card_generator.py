"""
文档卡片生成器
当截图失败时，生成包含标题、类型、站点名称的可视化卡片（SVG）
参考 Starlight 文档网站的设计风格
"""
from __future__ import annotations

from typing import Optional, Dict
from urllib.parse import urlparse
import base64


def detect_doc_type(url: str, site_name: str = "") -> Dict[str, str]:
    """
    检测文档类型和图标
    
    Returns:
        {
            "type": "代码仓库" | "文档" | "博客" | "协作工具" | "其他",
            "icon": "📚" | "💻" | "📝" | "🤝" | "📄",
            "color": "#0366d6" | "#28a745" | "#ff6b6b" | "#4ecdc4" | "#95a5a6"
        }
    """
    url_lower = url.lower()
    site_lower = site_name.lower()
    
    # 代码仓库
    if any(kw in url_lower for kw in ["github.com", "gitlab.com", "bitbucket.org", "gitee.com"]):
        return {
            "type": "代码仓库",
            "icon": "💻",
            "color": "#0366d6",  # GitHub blue
            "bg_color": "#f6f8fa",
        }
    
    # 文档平台
    if any(kw in url_lower for kw in ["readthedocs.io", "docs.", "documentation", "wiki"]):
        return {
            "type": "文档",
            "icon": "📚",
            "color": "#28a745",  # Green
            "bg_color": "#f0f9f4",
        }
    
    # 协作工具
    if any(kw in url_lower for kw in ["notion.so", "notion.site", "feishu", "lark", "confluence"]):
        return {
            "type": "协作工具",
            "icon": "🤝",
            "color": "#4ecdc4",  # Teal
            "bg_color": "#f0fdfa",
        }
    
    # Google Docs
    if any(kw in url_lower for kw in ["docs.google.com", "workspace.google.com"]):
        return {
            "type": "文档",
            "icon": "📝",
            "color": "#4285f4",  # Google blue
            "bg_color": "#e8f0fe",
        }
    
    # 博客/文章
    if any(kw in url_lower for kw in ["zhihu.com", "juejin.cn", "csdn.net", "blog", "medium.com"]):
        return {
            "type": "博客",
            "icon": "📝",
            "color": "#ff6b6b",  # Red
            "bg_color": "#fff5f5",
        }
    
    # 微信公众号
    if "mp.weixin.qq.com" in url_lower:
        return {
            "type": "文章",
            "icon": "📰",
            "color": "#07c160",  # WeChat green
            "bg_color": "#f0fdf4",
        }
    
    # 小红书文档
    if "docs.xiaohongshu.com" in url_lower or "xiaohongshu.com/doc" in url_lower:
        return {
            "type": "文档",
            "icon": "📚",
            "color": "#ff2442",  # Xiaohongshu red
            "bg_color": "#fff5f5",
        }
    
    # 默认
    return {
        "type": "网页",
        "icon": "📄",
        "color": "#95a5a6",  # Gray
        "bg_color": "#f8f9fa",
    }


def generate_doc_card_svg(
    title: str,
    url: str,
    site_name: str = "",
    description: str = "",
    width: int = 320,  # 调整为更适合画板的尺寸
    height: int = 240,  # 调整为更适合画板的尺寸
) -> str:
    """
    生成文档卡片的 SVG 图片（Base64 编码）
    
    Args:
        title: 标题
        url: URL
        site_name: 站点名称
        description: 描述
        width: 卡片宽度
        height: 卡片高度
    
    Returns:
        Base64 编码的 SVG Data URI
    """
    # 检测文档类型
    doc_info = detect_doc_type(url, site_name)
    
    # 如果没有站点名称，从 URL 提取
    if not site_name:
        parsed = urlparse(url)
        site_name = parsed.netloc or ""
        # 移除 www. 前缀
        if site_name.startswith("www."):
            site_name = site_name[4:]
    
    # 截断标题和描述（适配卡片尺寸）
    title_display = title[:40] + "..." if len(title) > 40 else title
    desc_display = description[:60] + "..." if len(description) > 60 else description
    
    # 转义 XML 特殊字符
    def escape_xml(text: str) -> str:
        return (text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&apos;"))
    
    title_escaped = escape_xml(title_display)
    site_name_escaped = escape_xml(site_name)
    desc_escaped = escape_xml(desc_display) if desc_display else ""
    url_escaped = escape_xml(url[:60] + ("..." if len(url) > 60 else ""))
    
    # 生成 SVG（优化样式，参考用户提供的可视化方式）
    # 使用更突出的标题横幅和类型标签
    svg_content = f'''<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:{doc_info['bg_color']};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ffffff;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.15"/>
    </filter>
  </defs>
  
  <!-- 背景卡片 -->
  <rect width="{width}" height="{height}" fill="url(#grad)" rx="12" stroke="{doc_info['color']}" stroke-width="2" filter="url(#shadow)"/>
  
  <!-- 顶部图标和类型标签（更突出） -->
  <g transform="translate(16, 16)">
    <text x="0" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-size="32" fill="{doc_info['color']}">{doc_info['icon']}</text>
    <rect x="44" y="4" width="70" height="28" rx="14" fill="{doc_info['color']}" opacity="0.2"/>
    <text x="79" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-size="13" font-weight="700" fill="{doc_info['color']}" text-anchor="middle">{doc_info['type']}</text>
  </g>
  
  <!-- 标题横幅（参考图片中的黄色横幅样式，但使用文档类型的颜色） -->
  <rect x="16" y="60" width="{width - 32}" height="50" rx="8" fill="{doc_info['color']}" opacity="0.12"/>
  <text x="{width // 2}" y="88" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-size="16" font-weight="700" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">
    <tspan x="{width // 2}" dy="0">{title_escaped}</tspan>
  </text>
  
  <!-- 站点名称（在标题下方） -->
  <text x="16" y="130" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-size="12" font-weight="600" fill="#666666">{site_name_escaped}</text>
  
  <!-- 描述（如果有，显示在站点名称下方） -->
  {f'<text x="16" y="150" font-family="-apple-system, BlinkMacSystemFont, \'Segoe UI\', Arial, sans-serif" font-size="11" fill="#888888">{desc_escaped}</text>' if desc_display else ''}
  
  <!-- 底部类型按钮（参考图片中的"工作文档Doc"按钮样式） -->
  <rect x="16" y="{height - 40}" width="100" height="24" rx="12" fill="{doc_info['color']}" opacity="0.9"/>
  <text x="66" y="{height - 24}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-size="11" font-weight="600" fill="#ffffff" text-anchor="middle">{doc_info['type']}Doc</text>
  
  <!-- URL 预览（更小，在右下角） -->
  <text x="{width - 16}" y="{height - 12}" font-family="Monaco, 'Courier New', monospace" font-size="9" fill="#999999" text-anchor="end">{url_escaped}</text>
</svg>'''
    
    # 转换为 Base64
    svg_bytes = svg_content.encode('utf-8')
    svg_b64 = base64.b64encode(svg_bytes).decode('utf-8')
    
    # 返回 Data URI
    return f"data:image/svg+xml;base64,{svg_b64}"


def generate_doc_card_data_uri(
    title: str,
    url: str,
    site_name: str = "",
    description: str = "",
) -> str:
    """
    生成文档卡片的 Data URI（方便调用）
    """
    return generate_doc_card_svg(title, url, site_name, description)

