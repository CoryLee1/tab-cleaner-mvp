import React, { useState, useRef } from "react";
import { Component } from "../../components/Component";
import { getImageUrl } from "../../shared/utils";
import { DraggableImage } from "./DraggableImage";
import { initialImages } from "./imageData";
import { CanvasTools } from "./CanvasTools";
import "./style.css";

export const PersonalSpace = () => {
  const [images, setImages] = useState(() =>
    initialImages.map(img => ({
      ...img,
      src: getImageUrl(img.imageName),
    }))
  );
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeTool, setActiveTool] = useState(null); // 'draw' | 'lasso' | 'text' | null
  const canvasRef = useRef(null);

  // 处理选中
  const handleSelect = (id, isMultiSelect) => {
    setSelectedIds(prev => {
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
      return newSet;
    });
  };

  // 处理拖拽结束
  const handleDragEnd = (id, x, y) => {
    setImages(prev =>
      prev.map(img =>
        img.id === id ? { ...img, x, y } : img
      )
    );
  };

  // 改进的套索选择 - 更精确的碰撞检测
  const handleLassoSelect = (lassoPath) => {
    if (!lassoPath || lassoPath.length < 3) return;
    
    const selected = new Set(selectedIds);
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
    setSelectedIds(selected);
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
        (p1.y < rect.top && p2.y > rect.bottom) ||
        (p1.y > rect.bottom && p2.y < rect.top)) {
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

  // 根据工具设置光标样式
  const getCanvasCursor = () => {
    switch (activeTool) {
      case 'draw': {
        const drawIconUrl = getImageUrl('draw-button-1.svg');
        return `url(${drawIconUrl}) 8 8, crosshair`;
      }
      case 'lasso': {
        const lassoIconUrl = getImageUrl('lasso-button-1.svg');
        return `url(${lassoIconUrl}) 10 10, crosshair`;
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
        {images.map(img => (
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
        />
      </div>

      <div className="space-function">
        <div className="add-new-session">
          <img className="image-10" alt="Image" src={getImageUrl("3.svg")} />
          <div className="text-wrapper-16">新增洗衣篮</div>
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
      <div className="aiclustering-panel">
        <div className="design-tag">
          <div className="text-wrapper-20">设计</div>
        </div>

        <div className="workdoc-tag">
          <div className="text-wrapper-21">工作文档</div>
        </div>

        <div className="add-tag">
          <div className="text-wrapper-22">➕</div>
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

      <div className="tool-sets">
        <div className="tool">
          <ToolButton
            className="lasso-button"
            alt="Lasso button"
            src={getImageUrl("lasso-button-1.svg")}
            tooltip="套索工具 - 圈选图片"
            isActive={activeTool === 'lasso'}
            onClick={() => setActiveTool(activeTool === 'lasso' ? null : 'lasso')}
          />

          <ToolButton
            className="draw-button"
            alt="Draw button"
            src={getImageUrl("draw-button-1.svg")}
            tooltip="绘画工具 - 自由绘画"
            isActive={activeTool === 'draw'}
            onClick={() => setActiveTool(activeTool === 'draw' ? null : 'draw')}
          />

          <ToolButton
            className="text-button"
            alt="Text button"
            src={getImageUrl("text-button-1.svg")}
            tooltip="文字工具 - 添加文本"
            isActive={activeTool === 'text'}
            onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
          />
        </div>

        <div className="move">
          <img
            className="last-move-button"
            alt="Last move button"
            src={getImageUrl("last-move-button-1.svg")}
          />

          <img
            className="next-move-button"
            alt="Next move button"
            src={getImageUrl("next-move-button-1.svg")}
          />
        </div>

        <div className="AI-clustering-button">
          <img
            className="ai-clustering-icon"
            alt="Ai clustering icon"
            src={getImageUrl("ai-clustering-icon-1.svg")}
          />

          <div className="text-wrapper-24">AI 聚类</div>
        </div>
      </div>
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
            bottom: '-30px',
            left: '50%',
            transform: 'translateX(-50%)',
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

export default PersonalSpace;
