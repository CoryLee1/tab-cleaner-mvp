from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from opengraph import fetch_multiple_opengraph

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
