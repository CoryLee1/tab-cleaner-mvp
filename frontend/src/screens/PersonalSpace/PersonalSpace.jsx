import React, { useState, useRef, useEffect } from "react";
import { Component } from "../../components/Component";
import { getImageUrl } from "../../shared/utils";
import { DraggableImage } from "./DraggableImage";
import { initialImages } from "./imageData";
import { CanvasTools } from "./CanvasTools";
import { OpenGraphCard } from "./OpenGraphCard";
import "./style.css";

export const PersonalSpace = () => {
  // OpenGraph 数据
  const [opengraphData, setOpengraphData] = useState([]);
  const [selectedOG, setSelectedOG] = useState(null); // 选中的 OpenGraph 卡片（用于显示详情）
  const lastOGClickRef = useRef({ time: 0, id: null }); // 用于双击检测
  
  // 管理图片位置和选中状态
  // 如果有 OpenGraph 数据，隐藏原有图片；否则显示原有图片
  const [showOriginalImages, setShowOriginalImages] = useState(true);
  const [images, setImages] = useState(() =>
    initialImages.map(img => ({
      ...img,
      src: getImageUrl(img.imageName),
    }))
  );
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeTool, setActiveTool] = useState(null); // 'draw' | 'lasso' | 'text' | null
  const canvasRef = useRef(null);

  // 画布工具状态（由父组件管理，支持撤销/重做）
  const [drawPaths, setDrawPaths] = useState([]);
  const [textElements, setTextElements] = useState([]);
  
  // 撤销/重做历史记录
  const [history, setHistory] = useState([]); // 历史记录栈
  const [historyIndex, setHistoryIndex] = useState(-1); // 当前历史记录索引
  const [selectedIdsHistory, setSelectedIdsHistory] = useState([]); // 选中状态历史

  // AI 聚类面板显示状态
  const [showAIClusteringPanel, setShowAIClusteringPanel] = useState(false);

  // 从 storage 加载 OpenGraph 数据
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['opengraphData'], (result) => {
        try {
          if (result.opengraphData) {
            // 处理两种可能的数据结构：{data: [...]} 或直接是数组
            const ogData = Array.isArray(result.opengraphData) 
              ? result.opengraphData 
              : (result.opengraphData.data || []);
            
            console.log('[PersonalSpace] Loaded OpenGraph data:', ogData);
            
            // 确保 ogData 是数组
            if (!Array.isArray(ogData)) {
              console.warn('[PersonalSpace] OpenGraph data is not an array:', ogData);
              return;
            }
            
            // 过滤掉失败的数据
            const validOG = ogData.filter(item => 
              item && 
              typeof item === 'object' && 
              item.success && 
              item.image
            );
            
            if (validOG.length > 0) {
              setShowOriginalImages(false); // 隐藏原有图片
              
            // 计算放射状布局位置，并为每个 OpenGraph 图片生成唯一 ID
            const positionedOG = calculateRadialLayout(validOG).map((og, index) => ({
              ...og,
              id: `og-${index}-${Date.now()}`, // 生成唯一 ID
            }));
            setOpengraphData(positionedOG);
            }
          }
        } catch (error) {
          console.error('[PersonalSpace] Error loading OpenGraph data:', error);
        }
      });
    }
  }, []);

  // 计算放射状布局（从圆心开始，一圈一圈向外）
  const calculateRadialLayout = (ogData) => {
    if (!ogData || !Array.isArray(ogData) || ogData.length === 0) {
      return [];
    }
    
    const centerX = 720; // 画布中心 X (1440 / 2)
    const centerY = 512; // 画布中心 Y (1024 / 2)
    const imageSize = 120; // 图片大小
    const spacing = 150; // 每圈之间的间距
    
    const positioned = [];
    let currentRing = 0;
    let currentIndexInRing = 0;
    let itemsInCurrentRing = 1; // 第一圈 1 个，第二圈 6 个，第三圈 12 个...
    
    ogData.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        console.warn('[PersonalSpace] Invalid item in OpenGraph data:', item);
        return;
      }
      if (currentIndexInRing >= itemsInCurrentRing) {
        currentRing++;
        currentIndexInRing = 0;
        // 每圈数量：1, 6, 12, 18, 24...
        itemsInCurrentRing = currentRing === 0 ? 1 : currentRing * 6;
      }
      
      const angleStep = (2 * Math.PI) / itemsInCurrentRing;
      const angle = currentIndexInRing * angleStep;
      const radius = currentRing * spacing + (currentRing === 0 ? 0 : spacing / 2);
      
      const x = centerX + Math.cos(angle) * radius - imageSize / 2;
      const y = centerY + Math.sin(angle) * radius - imageSize / 2;
      
      positioned.push({
        ...item,
        x: Math.round(x),
        y: Math.round(y),
        width: imageSize,
        height: imageSize,
      });
      
      currentIndexInRing++;
    });
    
    return positioned;
  };

  // 处理选中
  const handleSelect = (id, isMultiSelect) => {
    setSelectedIds(prev => {
      const prevSelected = new Set(prev);
      const newSet = new Set(prev);
      if (isMultiSelect) {
        // Shift 键：切换选中状态
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      } else {
        // 普通点击：单选
        newSet.clear();
        newSet.add(id);
      }
      // 记录选中状态到历史
      addToHistory({ type: 'selection', action: 'select', selectedIds: Array.from(newSet), prevSelectedIds: Array.from(prevSelected) });
      return newSet;
    });
  };

  // 处理拖拽结束
  const handleDragEnd = (id, x, y) => {
    // 如果是 OpenGraph 图片
    if (id.startsWith('og-')) {
      setOpengraphData(prev =>
        prev.map(og =>
          og.id === id ? { ...og, x, y } : og
        )
      );
      // 记录到历史
      const prevOG = opengraphData.find(og => og.id === id);
      if (prevOG) {
        addToHistory({ 
          type: 'opengraph-move', 
          action: 'move', 
          ogId: id, 
          x, 
          y, 
          prevX: prevOG.x, 
          prevY: prevOG.y 
        });
      }
    } else {
      // 原有图片
      setImages(prev =>
        prev.map(img =>
          img.id === id ? { ...img, x, y } : img
        )
      );
      // 记录到历史
      const prevImg = images.find(img => img.id === id);
      if (prevImg) {
        addToHistory({ 
          type: 'image-move', 
          action: 'move', 
          imageId: id, 
          x, 
          y, 
          prevImages: images 
        });
      }
    }
  };

  // 改进的套索选择 - 更精确的碰撞检测
  const handleLassoSelect = (lassoPath) => {
    if (!lassoPath || lassoPath.length < 3) return;
    
    const selected = new Set(selectedIds); // 保留已选中的
    
    // 处理原有图片
    images.forEach(img => {
      // 检查图片是否与套索路径相交
      const imgRect = {
        left: img.x,
        top: img.y,
        right: img.x + img.width,
        bottom: img.y + img.height,
      };
      
      // 检查图片的四个角是否在套索内
      const corners = [
        { x: img.x, y: img.y },
        { x: img.x + img.width, y: img.y },
        { x: img.x, y: img.y + img.height },
        { x: img.x + img.width, y: img.y + img.height },
        { x: img.x + img.width / 2, y: img.y + img.height / 2 },
      ];
      
      // 如果任何一个点在套索内，或套索路径穿过图片矩形，则选中
      const hasPointInLasso = corners.some(corner => 
        isPointInPolygon(corner.x, corner.y, lassoPath)
      );
      
      const hasPathIntersection = lassoPath.some(point => 
        point.x >= imgRect.left && point.x <= imgRect.right &&
        point.y >= imgRect.top && point.y <= imgRect.bottom
      );
      
      // 检查套索边界是否与图片矩形相交
      const hasBoundaryIntersection = isPolylineIntersectRect(lassoPath, imgRect);
      
      if (hasPointInLasso || hasPathIntersection || hasBoundaryIntersection) {
        selected.add(img.id);
      }
    });
    
    // 处理 OpenGraph 图片
    if (opengraphData && Array.isArray(opengraphData)) {
      opengraphData.forEach(og => {
        if (!og || !og.x || !og.y || !og.width || !og.height) return;
        
        const ogRect = {
          left: og.x,
          top: og.y,
          right: og.x + og.width,
          bottom: og.y + og.height,
        };
        
        // 检查 OpenGraph 图片的四个角和中心点
        const corners = [
          { x: og.x, y: og.y },
          { x: og.x + og.width, y: og.y },
          { x: og.x, y: og.y + og.height },
          { x: og.x + og.width, y: og.y + og.height },
          { x: og.x + og.width / 2, y: og.y + og.height / 2 },
        ];
        
        const hasPointInLasso = corners.some(corner => 
          isPointInPolygon(corner.x, corner.y, lassoPath)
        );
        
        const hasPathIntersection = lassoPath.some(point => 
          point.x >= ogRect.left && point.x <= ogRect.right &&
          point.y >= ogRect.top && point.y <= ogRect.bottom
        );
        
        const hasBoundaryIntersection = isPolylineIntersectRect(lassoPath, ogRect);
        
        if (hasPointInLasso || hasPathIntersection || hasBoundaryIntersection) {
          selected.add(og.id);
        }
      });
    }
    
    const prevSelected = new Set(selectedIds);
    setSelectedIds(selected);
    // 记录选中状态到历史
    addToHistory({ type: 'selection', action: 'select', selectedIds: Array.from(selected), prevSelectedIds: Array.from(prevSelected) });
  };

  // 判断点是否在多边形内（射线法）
  const isPointInPolygon = (x, y, polygon) => {
    if (!polygon || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // 检查折线是否与矩形相交
  const isPolylineIntersectRect = (polyline, rect) => {
    for (let i = 0; i < polyline.length - 1; i++) {
      const p1 = polyline[i];
      const p2 = polyline[i + 1];
      
      // 检查线段是否与矩形相交
      if (isLineIntersectRect(p1, p2, rect)) {
        return true;
      }
    }
    return false;
  };

  // 检查线段是否与矩形相交
  const isLineIntersectRect = (p1, p2, rect) => {
    // 快速检查：线段的两端都在矩形外的同一侧
    if ((p1.x < rect.left && p2.x < rect.left) ||
        (p1.x > rect.right && p2.x > rect.right) ||
        (p1.y < rect.top && p2.y < rect.top) ||
        (p1.y > rect.bottom && p2.y > rect.bottom)) {
      return false;
    }
    
    // 检查线段是否与矩形的四条边相交
    return (
      lineSegmentIntersect(p1, p2, { x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }) ||
      lineSegmentIntersect(p1, p2, { x: rect.right, y: rect.top }, { x: rect.right, y: rect.bottom }) ||
      lineSegmentIntersect(p1, p2, { x: rect.right, y: rect.bottom }, { x: rect.left, y: rect.bottom }) ||
      lineSegmentIntersect(p1, p2, { x: rect.left, y: rect.bottom }, { x: rect.left, y: rect.top })
    );
  };

  // 检查两条线段是否相交
  const lineSegmentIntersect = (p1, p2, p3, p4) => {
    const ccw = (A, B, C) => {
      return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    };
    
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  };

  // 历史记录管理
  const addToHistory = (action) => {
    setHistory(prev => {
      // 如果当前不在历史记录末尾，删除后面的记录
      const newHistory = prev.slice(0, historyIndex + 1);
      // 添加新操作
      newHistory.push(action);
      // 限制历史记录数量（最多 50 条）
      if (newHistory.length > 50) {
        newHistory.shift();
        setHistoryIndex(newHistory.length - 1);
      } else {
        setHistoryIndex(newHistory.length - 1);
      }
      return newHistory;
    });
  };

  // 处理画布工具的历史记录变化
  const handleHistoryChange = (action) => {
    addToHistory(action);
  };

  // 撤销功能
  const handleUndo = () => {
    if (!history || history.length === 0 || historyIndex < 0) return;
    
    const action = history[historyIndex];
    if (!action) return;
    console.log('[Undo] Undoing action:', action);
    
    // 根据操作类型执行撤销
    switch (action.type) {
      case 'draw':
        if (action.action === 'add') {
          setDrawPaths(prev => {
            if (!prev || !Array.isArray(prev)) return [];
            return prev.slice(0, -1);
          });
        }
        break;
      case 'text':
        if (action.action === 'add' && action.element) {
          setTextElements(prev => {
            if (!prev || !Array.isArray(prev)) return [];
            return prev.filter(el => el.id !== action.element.id);
          });
        } else if (action.action === 'delete' && action.element) {
          setTextElements(prev => {
            if (!prev || !Array.isArray(prev)) return [action.element];
            return [...prev, action.element];
          });
        }
        break;
      case 'lasso':
        if (action.action === 'select') {
          // 套索选择的撤销需要恢复之前的选中状态
          // 注意：这里需要从历史记录中查找前一个选中状态
          // 简化处理：如果历史记录中有前一个选中操作，恢复它
          const prevAction = (historyIndex > 0 && history && history[historyIndex - 1]) ? history[historyIndex - 1] : null;
          if (prevAction && prevAction.type === 'selection' && prevAction.prevSelectedIds) {
            setSelectedIds(new Set(prevAction.prevSelectedIds));
          } else {
            // 如果没有前一个选中状态，清空选中
            setSelectedIds(new Set());
          }
        }
        break;
      case 'selection':
        if (action.prevSelectedIds) {
          setSelectedIds(new Set(action.prevSelectedIds));
        }
        break;
      case 'image-move':
        // 恢复图片位置
        if (action.prevImages && Array.isArray(action.prevImages)) {
          setImages(action.prevImages);
        }
        break;
      case 'opengraph-move':
        // 恢复 OpenGraph 图片位置
        if (action.ogId && action.prevX !== undefined && action.prevY !== undefined) {
          setOpengraphData(prev =>
            prev.map(og =>
              og.id === action.ogId ? { ...og, x: action.prevX, y: action.prevY } : og
            )
          );
        }
        break;
    }
    
    setHistoryIndex(prev => prev - 1);
  };

  // 重做功能
  const handleRedo = () => {
    if (!history || !Array.isArray(history) || history.length === 0) return;
    if (historyIndex >= history.length - 1) return;
    
    const nextIndex = historyIndex + 1;
    const action = history[nextIndex];
    if (!action) return;
    console.log('[Redo] Redoing action:', action);
    
    // 根据操作类型执行重做
    switch (action.type) {
      case 'draw':
        if (action.action === 'add' && action.path) {
          setDrawPaths(prev => {
            if (!prev || !Array.isArray(prev)) return [action.path];
            return [...prev, action.path];
          });
        }
        break;
      case 'text':
        if (action.action === 'add' && action.element) {
          setTextElements(prev => {
            if (!prev || !Array.isArray(prev)) return [action.element];
            return [...prev, action.element];
          });
        } else if (action.action === 'delete' && action.element) {
          setTextElements(prev => {
            if (!prev || !Array.isArray(prev)) return [];
            return prev.filter(el => el.id !== action.element.id);
          });
        }
        break;
      case 'lasso':
        if (action.action === 'select') {
          setSelectedIds(new Set(action.selectedIds || []));
        }
        break;
      case 'selection':
        if (action.selectedIds) {
          setSelectedIds(new Set(action.selectedIds));
        }
        break;
      case 'image-move':
        // 恢复图片位置
        setImages(prev => prev.map(img =>
          img.id === action.imageId ? { ...img, x: action.x, y: action.y } : img
        ));
        break;
      case 'opengraph-move':
        // 恢复 OpenGraph 图片位置
        if (action.ogId && action.x !== undefined && action.y !== undefined) {
          setOpengraphData(prev =>
            prev.map(og =>
              og.id === action.ogId ? { ...og, x: action.x, y: action.y } : og
            )
          );
        }
        break;
    }
    
    setHistoryIndex(nextIndex);
  };

  // 根据工具设置光标样式（使用 SVG 图标）
  const getCanvasCursor = () => {
    switch (activeTool) {
      case 'draw': {
        const drawIconUrl = getImageUrl('draw-button-1.svg');
        return `url(${drawIconUrl}) 8 8, crosshair`; // 8 8 是热点位置（图标中心）
      }
      case 'lasso': {
        const lassoIconUrl = getImageUrl('lasso-button-1.svg');
        return `url(${lassoIconUrl}) 10 10, crosshair`; // 10 10 是热点位置
      }
      case 'text':
        return 'text';
      default:
        return 'default';
    }
  };

  return (
    <div className="personal-space">
      <div 
        className="canvas" 
        ref={canvasRef}
        style={{ cursor: getCanvasCursor() }}
      >
        {/* 原有图片（仅在未加载 OpenGraph 时显示） */}
        {showOriginalImages && images.map(img => (
          <DraggableImage
            key={img.id}
            id={img.id}
            className={img.className}
            src={img.src}
            alt={img.alt}
            initialX={img.x}
            initialY={img.y}
            width={img.width}
            height={img.height}
            isSelected={selectedIds.has(img.id)}
            onSelect={handleSelect}
            onDragEnd={handleDragEnd}
          />
        ))}

        {/* OpenGraph 图片（使用 DraggableImage，支持拖拽和工具） */}
        {!showOriginalImages && opengraphData && Array.isArray(opengraphData) && opengraphData.length > 0 && opengraphData.map((og) => {
          if (!og || typeof og !== 'object' || !og.x || !og.y || !og.id) {
            return null;
          }
          
          // 直接使用 DraggableImage，位置由组件内部管理
          return (
            <DraggableImage
              key={og.id}
              id={og.id}
              className="opengraph-image"
              src={og.image || 'https://via.placeholder.com/120'}
              alt={og.title || og.url}
              initialX={og.x}
              initialY={og.y}
              width={og.width}
              height={og.height}
              isSelected={selectedIds.has(og.id)}
              onSelect={(id, isMultiSelect) => {
                handleSelect(id, isMultiSelect);
                // 快速双击显示 OpenGraph 卡片（300ms 内两次点击同一图片）
                const now = Date.now();
                if (lastOGClickRef.current.id === id && now - lastOGClickRef.current.time < 300) {
                  setSelectedOG(og);
                  lastOGClickRef.current = { time: 0, id: null };
                } else {
                  lastOGClickRef.current = { time: now, id };
                }
              }}
              onDragEnd={handleDragEnd}
            />
          );
        })}

        {/* 保留非图片元素 */}
        <div className="i-leave-you-love-and" />
        <div className="live-NEAR" />
        <div className="flow-on-the-edge" />

        <div className="text-wrapper-15">视觉参考</div>

        {/* 画布工具层 */}
        <CanvasTools
          canvasRef={canvasRef}
          activeTool={activeTool}
          onLassoSelect={handleLassoSelect}
          selectedIds={selectedIds}
          drawPaths={drawPaths}
          setDrawPaths={setDrawPaths}
          textElements={textElements}
          setTextElements={setTextElements}
          onHistoryChange={handleHistoryChange}
        />
      </div>

      <div className="space-function">
        <div className="add-new-session">
          <img className="image-10" alt="Image" src={getImageUrl("3.svg")} />

          <div className="text-wrapper-16">加新洗衣筐</div>
        </div>

        <div className="share">
          <img className="image-11" alt="Image" src={getImageUrl("4.svg")} />

          <div className="text-wrapper-17">分享</div>
        </div>
      </div>

      <div className="space-title">
        <img
          className="basket-icon"
          alt="Basket icon"
          src={getImageUrl("basket-icon-1.png")}
        />

        <div className="text-wrapper-18">我的收藏</div>
      </div>

      <div className="search-bar">
        <img className="image-12" alt="Image" src={getImageUrl("5.svg")} />

        <div className="text-wrapper-19">大促物料参考</div>
      </div>

      <img
        className="view-buttons"
        alt="View buttons"
        src={getImageUrl("viewbuttons-1.svg")}
      />

      <Component className="side-panel" property1="one" />
      {showAIClusteringPanel && (
        <div 
          className="aiclustering-panel"
          onClick={(e) => {
            // 点击面板本身时关闭
            if (e.target.classList.contains('aiclustering-panel')) {
              setShowAIClusteringPanel(false);
            }
          }}
        >
        <div className="design-tag">
          <div className="text-wrapper-20">设计</div>
        </div>

        <div className="workdoc-tag">
          <div className="text-wrapper-21">工作文档</div>
        </div>

        <div className="add-tag">
          <div className="text-wrapper-22"></div>
        </div>

        <div className="upload">
          <div className="upload-tag">
            <div className="image-wrapper">
              <img className="image-13" alt="Image" src={getImageUrl("1.svg")} />
            </div>
          </div>
        </div>

        <div className="rectangle" />

        <div className="auto-cluster">
          <div className="frame-wrapper">
            <div className="frame-10">
              <div className="text-wrapper-23">自动聚类</div>
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="tool-sets">
        <div className="tool">
          <ToolButton
            className="lasso-button"
            alt="Lasso button"
            src={getImageUrl("lasso-button-1.svg")}
            tooltip="套索工具"
            isActive={activeTool === 'lasso'}
            onClick={() => setActiveTool(activeTool === 'lasso' ? null : 'lasso')}
          />

          <ToolButton
            className="draw-button"
            alt="Draw button"
            src={getImageUrl("draw-button-1.svg")}
            tooltip="绘画工具"
            isActive={activeTool === 'draw'}
            onClick={() => setActiveTool(activeTool === 'draw' ? null : 'draw')}
          />

          <ToolButton
            className="text-button"
            alt="Text button"
            src={getImageUrl("text-button-1.svg")}
            tooltip="文字工具"
            isActive={activeTool === 'text'}
            onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
          />
        </div>

        <div className="move">
          <img
            className="last-move-button"
            alt="Last move button"
            src={getImageUrl("last-move-button-1.svg")}
            onClick={handleUndo}
            style={{ cursor: 'pointer', opacity: historyIndex >= 0 ? 1 : 0.5 }}
            title="撤销 (Undo)"
          />

          <img
            className="next-move-button"
            alt="Next move button"
            src={getImageUrl("next-move-button-1.svg")}
            onClick={handleRedo}
            style={{ cursor: 'pointer', opacity: (history && history.length > 0 && historyIndex < history.length - 1) ? 1 : 0.5 }}
            title="重做 (Redo)"
          />
        </div>

        <div 
          className="AI-clustering-button"
          onClick={() => setShowAIClusteringPanel(!showAIClusteringPanel)}
          style={{ cursor: 'pointer' }}
        >
          <img
            className="ai-clustering-icon"
            alt="Ai clustering icon"
            src={getImageUrl("ai-clustering-icon-1.svg")}
          />

          <div className="text-wrapper-24">AI 聚类</div>
        </div>
      </div>

      {/* OpenGraph 卡片（点击图片后显示） */}
      {selectedOG && (
        <OpenGraphCard
          data={selectedOG}
          onClose={() => setSelectedOG(null)}
        />
      )}
    </div>
  );
};

/**
 * 工具按钮组件（带 tooltip）
 */
const ToolButton = ({ className, alt, src, tooltip, isActive, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef(null);

  return (
    <div
      className={`tool-button-wrapper ${isActive ? 'active' : ''}`}
      ref={buttonRef}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
      style={{ position: 'relative', cursor: 'pointer' }}
    >
      <img
        className={className}
        alt={alt}
        src={src}
        style={{
          opacity: isActive ? 1 : 0.7,
          filter: isActive ? 'none' : 'grayscale(20%)',
        }}
      />
      {showTooltip && (
        <div
          className="tool-tooltip"
          style={{
            position: 'absolute',
            bottom: '-30px',        // 调整垂直位置：负数向上，正数向下
            left: '50%',            // 调整水平位置：'50%' 居中，或 '0' 左对齐，'100%' 右对齐
            transform: 'translateX(-50%)', // 水平居中，或 'translate(-50%, -100%)' 完全居中
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
};
