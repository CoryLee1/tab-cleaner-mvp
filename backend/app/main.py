from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
from opengraph import fetch_multiple_opengraph
from ai_insight import analyze_opengraph_data
from search import process_opengraph_for_search, search_relevant_items

app = FastAPI(title="Tab Cleaner MVP", version="0.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# serve static pages (for share link)
static_dir = Path(__file__).parent / "static"
app.mount("/public", StaticFiles(directory=static_dir, html=True), name="public")

@app.get("/")
def root():
    return {"ok": True, "message": "Hello Tab Cleaner"}


# OpenGraph API
class TabItem(BaseModel):
    url: str
    title: Optional[str] = None
    id: Optional[int] = None


class OpenGraphRequest(BaseModel):
    tabs: List[TabItem]


@app.post("/api/v1/tabs/opengraph")
async def fetch_tabs_opengraph(request: OpenGraphRequest):
    """
    批量抓取多个 tabs 的 OpenGraph 数据
    """
    try:
        urls = [tab.url for tab in request.tabs]
        if not urls:
            return {"ok": True, "data": []}
        
        results = await fetch_multiple_opengraph(urls)
        
        # 将结果与原始 tab 信息合并
        opengraph_data = []
        for i, result in enumerate(results):
            opengraph_data.append({
                **result,
                "tab_id": request.tabs[i].id,
                "tab_title": request.tabs[i].title,
            })
        
        return {"ok": True, "data": opengraph_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# AI 洞察 API
class AIInsightRequest(BaseModel):
    opengraph_items: List[Dict[str, Any]]


@app.post("/api/v1/ai/insight")
async def get_ai_insight(request: AIInsightRequest):
    """
    使用通义千问分析 OpenGraph 数据并生成总结
    """
    try:
        if not request.opengraph_items:
            raise HTTPException(status_code=400, detail="No OpenGraph items provided")
        
        result = analyze_opengraph_data(request.opengraph_items)
        
        if result["success"]:
            return {
                "ok": True,
                "summary": result["summary"],
                "error": None
            }
        else:
            return {
                "ok": False,
                "summary": None,
                "error": result.get("error", "Unknown error")
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 搜索 API
class EmbeddingRequest(BaseModel):
    opengraph_items: List[Dict[str, Any]]


class SearchRequest(BaseModel):
    query_text: Optional[str] = None
    query_image_url: Optional[str] = None
    opengraph_items: List[Dict[str, Any]]


@app.post("/api/v1/search/embedding")
async def generate_embeddings(request: EmbeddingRequest):
    """
    为OpenGraph数据生成Embedding向量（批量处理）
    注意：这个API会处理大量数据，建议分批调用避免过载
    """
    try:
        if not request.opengraph_items:
            return {"ok": True, "data": []}
        
        print(f"[API] Generating embeddings for {len(request.opengraph_items)} items")
        
        # 处理OpenGraph数据，生成Embedding
        processed_items = await process_opengraph_for_search(request.opengraph_items)
        
        # 返回必要的字段，包括 text_embedding 和 image_embedding（用于分别计算相似度）
        result_data = []
        for item in processed_items:
            result_data.append({
                "url": item.get("url"),
                "title": item.get("title") or item.get("tab_title", ""),
                "description": item.get("description", ""),
                "image": item.get("image", ""),
                "site_name": item.get("site_name", ""),
                "tab_id": item.get("tab_id"),
                "tab_title": item.get("tab_title"),
                "embedding": item.get("embedding"),  # 融合向量（用于向后兼容）
                "text_embedding": item.get("text_embedding"),  # 文本向量（用于分别计算相似度）
                "image_embedding": item.get("image_embedding"),  # 图像向量（用于分别计算相似度）
                "has_embedding": item.get("has_embedding", False),
                "similarity": item.get("similarity")  # 如果有相似度分数
            })
        
        items_with_embedding = sum(1 for r in result_data if r.get("has_embedding", False))
        print(f"[API] Returning {len(result_data)} items, {items_with_embedding} have embedding")
        
        return {"ok": True, "data": result_data}
    except Exception as e:
        print(f"[API] CRITICAL ERROR in generate_embeddings: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        # 返回更详细的错误信息
        error_detail = f"{type(e).__name__}: {str(e)}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.post("/api/v1/search/query")
async def search_content(request: SearchRequest):
    """
    搜索相关内容（支持文本和图片查询）
    
    请求参数:
    - query_text: 查询文本（可选）
    - query_image_url: 查询图片URL（可选，至少需要提供query_text或query_image_url之一）
    - opengraph_items: 包含Embedding的OpenGraph数据列表（应该已经通过/embedding接口处理过）
    
    返回:
    - 按相关性排序的OpenGraph数据列表（包含similarity分数）
    """
    try:
        if not request.query_text and not request.query_image_url:
            raise HTTPException(status_code=400, detail="至少需要提供query_text或query_image_url之一")
        
        if not request.opengraph_items:
            return {"ok": True, "data": []}
        
        # 调试：检查接收到的数据
        items_with_embedding = sum(1 for item in request.opengraph_items if item.get("embedding"))
        print(f"[API] Received {len(request.opengraph_items)} items, {items_with_embedding} have embedding")
        if items_with_embedding > 0:
            first_embedding = request.opengraph_items[0].get("embedding")
            if first_embedding:
                print(f"[API] First item embedding type: {type(first_embedding)}, length: {len(first_embedding) if isinstance(first_embedding, list) else 'N/A'}")
        
        # 执行搜索
        results = await search_relevant_items(
            query_text=request.query_text,
            query_image_url=request.query_image_url,
            opengraph_items=request.opengraph_items,
            top_k=20
        )
        
        # 格式化返回结果
        result_data = []
        for item in results:
            result_data.append({
                "url": item.get("url"),
                "title": item.get("title") or item.get("tab_title", ""),
                "description": item.get("description", ""),
                "image": item.get("image", ""),
                "site_name": item.get("site_name", ""),
                "tab_id": item.get("tab_id"),
                "tab_title": item.get("tab_title"),
                "similarity": item.get("similarity", 0.0)
            })
        
        # 保存搜索结果到本地文件（用于调试）
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            query_safe = (request.query_text or "empty")[:50].replace("/", "_").replace("\\", "_")
            output_file = Path(__file__).parent / f"search_results_{query_safe}_{timestamp}.json"
            
            output_data = {
                "query": request.query_text,
                "query_image_url": request.query_image_url,
                "timestamp": timestamp,
                "total_results": len(result_data),
                "results": [
                    {
                        "rank": idx + 1,
                        "title": item.get("title") or item.get("tab_title", ""),
                        "url": item.get("url"),
                        "description": item.get("description", ""),
                        "similarity": item.get("similarity", 0.0),
                        "similarity_precise": f"{item.get('similarity', 0.0):.15f}",  # 保留15位小数
                    }
                    for idx, item in enumerate(result_data)
                ]
            }
            
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            
            print(f"[API] Search results saved to: {output_file}")
            print(f"[API] Total results: {len(result_data)}, similarity range: "
                  f"min={min(r.get('similarity', 0.0) for r in result_data):.10f}, "
                  f"max={max(r.get('similarity', 0.0) for r in result_data):.10f}")
        except Exception as save_error:
            print(f"[API] Failed to save search results: {save_error}")
        
        return {"ok": True, "data": result_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
