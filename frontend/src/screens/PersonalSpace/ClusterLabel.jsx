import React, { useState, useRef, useEffect } from "react";

/**
 * 聚类中心标签组件
 * 显示聚类名称，支持双击编辑
 */
export const ClusterLabel = ({ cluster, onRename, onDrag }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(cluster.name);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const lastClickRef = useRef({ time: 0, id: null });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialCenterRef = useRef({ x: 720, y: 512 }); // 拖动开始时的初始中心位置

  // 确保从最新的 cluster prop 中读取 center
  // 如果 cluster.center 不存在，使用默认值（画布中心）
  const center = cluster?.center || { x: 720, y: 512 };
  
  // 调试信息：在开发环境中显示坐标和日志
  const isDev = process.env.NODE_ENV === 'development';
  
  // 调试日志：每次渲染时输出聚类信息
  useEffect(() => {
    if (isDev) {
      console.log(`[ClusterLabel] ${cluster.name}: center=(${center.x}, ${center.y})`);
    }
  }, [cluster.id, center.x, center.y, cluster.name, isDev]);

  const handleClick = (e) => {
    e.stopPropagation();
    // 双击编辑
    const now = Date.now();
    if (lastClickRef.current.id === cluster.id && now - lastClickRef.current.time < 300) {
      setIsEditing(true);
      lastClickRef.current = { time: 0, id: null };
    } else {
      lastClickRef.current = { time: now, id: cluster.id };
      // 单击显示详情
      alert(`聚类：${cluster.name}\n类型：${cluster.type}\n卡片数量：${cluster.item_count || cluster.items?.length || 0}`);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editName.trim() && editName !== cluster.name) {
      // 更新聚类名称
      if (onRename) {
        onRename(cluster.id, editName.trim());
      }
    } else {
      setEditName(cluster.name);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setEditName(cluster.name);
      setIsEditing(false);
    }
  };

  const handleMouseDown = (e) => {
    if (isEditing) return; // 编辑模式下不拖动
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
    // 保存拖动开始时的初始中心位置
    initialCenterRef.current = { ...center };
    setDragOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      
      setDragOffset({ x: deltaX, y: deltaY });
      
      // 实时更新聚类中心位置（基于初始位置计算）
      if (onDrag) {
        const newCenter = {
          x: initialCenterRef.current.x + deltaX,
          y: initialCenterRef.current.y + deltaY,
        };
        onDrag(cluster.id, newCenter, false); // false 表示拖动中
      }
    };

    const handleMouseUp = () => {
      if (onDrag && (dragOffset.x !== 0 || dragOffset.y !== 0)) {
        // 拖动结束，应用最终位置（基于初始位置计算）
        const finalCenter = {
          x: initialCenterRef.current.x + dragOffset.x,
          y: initialCenterRef.current.y + dragOffset.y,
        };
        onDrag(cluster.id, finalCenter, true); // true 表示拖动结束
      }
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, center, cluster.id, onDrag]);

  // 计算实际显示位置（拖动时添加偏移）
  const displayX = center.x + (isDragging ? dragOffset.x : 0);
  const displayY = center.y + (isDragging ? dragOffset.y : 0);

  return (
    <div
      className="cluster-label"
      style={{
        position: 'absolute',
        left: `${displayX}px`,
        top: `${displayY}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        cursor: isDragging ? 'grabbing' : 'grab',
        padding: '8px 16px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '2px solid #0077ff',
        borderRadius: '8px',
        boxShadow: isDragging ? '0 8px 16px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.2)',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#0077ff',
        minWidth: '80px',
        textAlign: 'center',
        userSelect: 'none',
        opacity: isDragging ? 0.9 : 1,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: '#0077ff',
            fontSize: '14px',
            fontWeight: 'bold',
            textAlign: 'center',
            width: '100%',
          }}
        />
      ) : (
        <span>
          {cluster.name}
          {isDev && (
            <span style={{ 
              display: 'block', 
              fontSize: '10px', 
              fontWeight: 'normal', 
              color: '#666',
              marginTop: '2px'
            }}>
              ({Math.round(center.x)}, {Math.round(center.y)})
            </span>
          )}
        </span>
      )}
    </div>
  );
};

