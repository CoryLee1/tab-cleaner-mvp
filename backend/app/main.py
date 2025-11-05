from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from opengraph import fetch_multiple_opengraph
from ai_insight import analyze_opengraph_data

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
