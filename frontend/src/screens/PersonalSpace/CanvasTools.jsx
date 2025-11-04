import React, { useState, useRef, useEffect } from "react";

/**
 * 画布工具组件
 * 包含绘画、套索、文字工具
 */
export const CanvasTools = ({ canvasRef, activeTool, onLassoSelect, selectedIds }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawPath, setCurrentDrawPath] = useState([]); // 当前正在绘制的路径
  const [drawPaths, setDrawPaths] = useState([]); // 所有已保存的绘画路径
  const [lassoPath, setLassoPath] = useState([]);
  const [isLassoActive, setIsLassoActive] = useState(false);
  const [textElements, setTextElements] = useState([]);
  const [currentText, setCurrentText] = useState(null);
  const canvas = canvasRef?.current;
  const svgRef = useRef(null);

  // 从 localStorage 加载数据
  useEffect(() => {
    try {
      const savedDrawPaths = localStorage.getItem('canvas_draw_paths');
      const savedTextElements = localStorage.getItem('canvas_text_elements');
      
      if (savedDrawPaths) {
        setDrawPaths(JSON.parse(savedDrawPaths));
      }
      
      if (savedTextElements) {
        setTextElements(JSON.parse(savedTextElements));
      }
    } catch (e) {
      console.error('[CanvasTools] Failed to load from localStorage:', e);
    }
  }, []);

  // 保存绘画路径到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('canvas_draw_paths', JSON.stringify(drawPaths));
    } catch (e) {
      console.error('[CanvasTools] Failed to save draw paths:', e);
    }
  }, [drawPaths]);

  // 保存文字元素到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('canvas_text_elements', JSON.stringify(textElements));
    } catch (e) {
      console.error('[CanvasTools] Failed to save text elements:', e);
    }
  }, [textElements]);

  // 绘画工具
  const handleDrawStart = (e) => {
    if (activeTool !== 'draw') return;
    setIsDrawing(true);
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentDrawPath([{ x, y }]);
  };

  const handleDrawMove = (e) => {
    if (activeTool !== 'draw' || !isDrawing) return;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentDrawPath(prev => [...prev, { x, y }]);
  };

  const handleDrawEnd = () => {
    if (activeTool === 'draw' && isDrawing) {
      setIsDrawing(false);
      // 保存绘画路径
      if (currentDrawPath.length > 1) {
        setDrawPaths(prev => [...prev, [...currentDrawPath]]);
      }
      setCurrentDrawPath([]);
    }
  };

  // 套索工具 - 开始自由绘制
  const handleLassoStart = (e) => {
    if (activeTool !== 'lasso') return;
    e.preventDefault();
    setIsLassoActive(true);
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // 初始化路径，从第一个点开始
    setLassoPath([{ x, y }]);
  };

  const handleLassoMove = (e) => {
    if (activeTool !== 'lasso' || !isLassoActive) return;
    e.preventDefault();
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // 自由绘制：持续添加点形成路径
    setLassoPath(prev => [...prev, { x, y }]);
  };

  const handleLassoEnd = () => {
    if (activeTool === 'lasso' && isLassoActive) {
      setIsLassoActive(false);
      // 只在松开鼠标时检测并选中图片
      if (lassoPath.length > 2 && onLassoSelect) {
        // 闭合路径（连接起点和终点）
        const closedPath = [...lassoPath, lassoPath[0]];
        onLassoSelect(closedPath);
      }
      // 清空路径（延迟一下让用户看到最终结果）
      setTimeout(() => {
        setLassoPath([]);
      }, 100);
    }
  };

  // 文字工具
  const handleTextClick = (e) => {
    if (activeTool !== 'text') return;
    // 如果点击的是已有的文字元素，不创建新的
    if (e.target.closest('.canvas-text-element')) return;
    // 如果点击的是输入框，不创建新的
    if (e.target.closest('input')) return;
    
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 创建文字输入框
    const textId = `text-${Date.now()}`;
    setCurrentText({ id: textId, x, y, text: '' });
    e.stopPropagation(); // 阻止事件冒泡
  };

  const handleTextConfirm = (text) => {
    if (currentText && text.trim()) {
      setTextElements(prev => [...prev, { ...currentText, text }]);
    }
    setCurrentText(null);
  };

  // 删除文字元素
  const handleDeleteText = (textId) => {
    setTextElements(prev => prev.filter(el => el.id !== textId));
  };

  // 事件监听
  useEffect(() => {
    if (!canvas || !activeTool) return;

    const handleMouseDown = (e) => {
      // 排除点击按钮的情况
      if (e.target.closest('.tool-button-wrapper')) return;
      // 排除点击文字输入框的情况
      if (e.target.closest('input')) return;
      if (activeTool === 'draw') handleDrawStart(e);
      if (activeTool === 'lasso') handleLassoStart(e);
      if (activeTool === 'text') handleTextClick(e);
    };

    const handleMouseMove = (e) => {
      if (activeTool === 'draw' && isDrawing) handleDrawMove(e);
      if (activeTool === 'lasso' && isLassoActive) handleLassoMove(e);
    };

    const handleMouseUp = () => {
      if (activeTool === 'draw' && isDrawing) handleDrawEnd();
      if (activeTool === 'lasso' && isLassoActive) handleLassoEnd();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    if (activeTool === 'draw' || activeTool === 'lasso') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeTool, isDrawing, isLassoActive, canvas, lassoPath, onLassoSelect]);

  // 绘制 SVG 路径
  const getPathString = (path) => {
    if (path.length < 2) return '';
    return path.map((point, i) => 
      i === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
    ).join(' ');
  };

  return (
    <>
      {/* SVG 层用于绘制路径 - 相对于 canvas 定位 */}
      <svg
        ref={svgRef}
        className="canvas-tools-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: activeTool === 'draw' || activeTool === 'lasso' ? 'auto' : 'none',
          zIndex: 50,
          overflow: 'visible',
        }}
      >
        {/* 已保存的绘画路径 */}
        {drawPaths.map((path, index) => (
          <path
            key={`draw-${index}`}
            d={getPathString(path)}
            stroke="#61caff"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}
        
        {/* 当前正在绘制的路径 */}
        {activeTool === 'draw' && currentDrawPath.length > 1 && (
          <path
            d={getPathString(currentDrawPath)}
            stroke="#61caff"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}
        
        {/* 套索路径 - 自由形状 */}
        {activeTool === 'lasso' && lassoPath.length > 1 && (
          <path
            d={`${getPathString(lassoPath)} ${lassoPath.length > 2 ? 'Z' : ''}`}
            stroke="#61caff"
            strokeWidth="2"
            fill="rgba(97, 202, 255, 0.15)"
            strokeDasharray="5,5"
            pointerEvents="none"
          />
        )}
      </svg>

      {/* 文字元素（可拖拽） */}
      {textElements.map(textEl => (
        <DraggableText
          key={textEl.id}
          id={textEl.id}
          x={textEl.x}
          y={textEl.y}
          text={textEl.text}
          onUpdate={(newX, newY) => {
            setTextElements(prev => prev.map(el => 
              el.id === textEl.id ? { ...el, x: newX, y: newY } : el
            ));
          }}
          onDelete={() => handleDeleteText(textEl.id)}
        />
      ))}

      {/* 文字输入框 */}
      {currentText && activeTool === 'text' && (
        <TextInput
          x={currentText.x}
          y={currentText.y}
          onConfirm={handleTextConfirm}
          onCancel={() => setCurrentText(null)}
        />
      )}
    </>
  );
};

/**
 * 文字输入组件
 */
const TextInput = ({ x, y, onConfirm, onCancel }) => {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onConfirm(text);
    }
    if (e.key === 'Escape') {
      onCancel();
    }
    e.stopPropagation(); // 阻止事件冒泡
  };

  const handleMouseDown = (e) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发画布点击
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 70,
      }}
      onMouseDown={handleMouseDown}
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (text.trim()) {
            onConfirm(text);
          } else {
            onCancel();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: /[\u4e00-\u9fa5]/.test(text)
            ? '"FZLanTingYuanS-R-GB-Regular", sans-serif'
            : '"SF Pro Display-Regular", sans-serif',
          fontSize: '16px',
          padding: '4px 8px',
          border: '2px solid #61caff',
          borderRadius: '4px',
          outline: 'none',
          minWidth: '100px',
          backgroundColor: '#fff',
        }}
        placeholder="输入文字..."
      />
    </div>
  );
};

/**
 * 可拖拽的文字元素
 */
const DraggableText = ({ id, x, y, text, onUpdate, onDelete }) => {
  const [position, setPosition] = useState({ x, y });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showDelete, setShowDelete] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // 只处理左键
    e.stopPropagation();
    
    const rect = textRef.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const canvas = textRef.current?.closest('.canvas');
      if (!canvas) return;
      
      const canvasRect = canvas.getBoundingClientRect();
      const newX = e.clientX - canvasRect.left - dragOffset.x;
      const newY = e.clientY - canvasRect.top - dragOffset.y;
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (isDragging && onUpdate) {
        onUpdate(position.x, position.y);
      }
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position, onUpdate]);

  return (
    <div
      ref={textRef}
      className="canvas-text-element"
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        fontFamily: /[\u4e00-\u9fa5]/.test(text) 
          ? '"FZLanTingYuanS-R-GB-Regular", sans-serif'
          : '"SF Pro Display-Regular", sans-serif',
        fontSize: '16px',
        color: '#000',
        zIndex: 60,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        padding: '4px 8px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '4px',
        border: '1px solid #61caff',
        boxShadow: '0 2px 8px rgba(97, 202, 255, 0.2)',
        whiteSpace: 'nowrap',
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <span>{text}</span>
      {showDelete && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            marginLeft: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#ff6b6b',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '0 4px',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default CanvasTools;

