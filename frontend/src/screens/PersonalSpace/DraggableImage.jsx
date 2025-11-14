import React, { useState, useRef, useEffect } from "react";
import { CARD_ANIMATION, calculateDistance, calculateDurationByDistance } from "../../motion";

/**
 * 可拖拽图片组件
 * 支持拖拽和选中功能
 */
export const DraggableImage = ({
  id,
  className,
  src,
  alt,
  initialX,
  initialY,
  width,
  height,
  animationDelay = 0,
  isSelected,
  onSelect,
  onDragEnd,
  onClick,  // 添加 onClick prop
  zoom = 1,  // 画布缩放比例
  pan = { x: 0, y: 0 },  // 画布平移
}) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const prevPositionRef = useRef({ x: initialX, y: initialY });
  const imgRef = useRef(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 }); // 记录拖拽开始时的鼠标位置
  const hasMovedRef = useRef(false); // 记录是否真的移动了

  // 当 initialX 或 initialY 改变时（从父组件更新），同步位置并触发动画
  useEffect(() => {
    if (!isDragging) {
      const prevX = prevPositionRef.current.x;
      const prevY = prevPositionRef.current.y;
      
      // 如果位置发生变化，触发动画
      if (prevX !== initialX || prevY !== initialY) {
        const distance = calculateDistance(prevX, prevY, initialX, initialY);
        
        // 只有当距离足够大时才触发动画（避免微小抖动）
        if (distance > 5) {
          setIsAnimating(true);
          setPosition({ x: initialX, y: initialY });
          
          // 根据距离计算动画时长
          const duration = calculateDurationByDistance(
            distance,
            CARD_ANIMATION.MOVE_DURATION,
            CARD_ANIMATION.MOVE_DURATION * 2
          );
          
          // 动画结束后重置状态
          const timer = setTimeout(() => {
            setIsAnimating(false);
          }, duration);
          
          prevPositionRef.current = { x: initialX, y: initialY };
          
          return () => clearTimeout(timer);
        } else {
          // 距离太小，直接更新位置，不触发动画
          setPosition({ x: initialX, y: initialY });
          prevPositionRef.current = { x: initialX, y: initialY };
        }
      }
    }
  }, [initialX, initialY, isDragging]);

  // 鼠标按下
  const handleMouseDown = (e) => {
    // 如果工具激活，不处理图片拖拽
    const canvas = imgRef.current?.closest('.canvas');
    if (canvas && canvas.style.cursor !== 'default') {
      // 有工具激活时，不处理图片拖拽
      return;
    }
    
    // 如果点击的是图片本身，开始拖拽
    if (e.button !== 0) return; // 只处理左键
    
    // 先处理选中
    if (onSelect) {
      onSelect(id, e.shiftKey); // shift 键支持多选
    }

    // 记录拖拽开始时的鼠标位置（用于判断是否真的移动了）
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false; // 重置移动标志

    // 计算鼠标相对于图片的偏移
    const rect = imgRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡
  };

  // 鼠标移动
  useEffect(() => {
    if (!isDragging) return;

    let currentPos = { x: position.x, y: position.y };

    const handleMouseMove = (e) => {
      // 计算鼠标移动距离（用于区分点击和拖拽）
      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartPosRef.current.x, 2) +
        Math.pow(e.clientY - dragStartPosRef.current.y, 2)
      );
      
      // 如果移动距离超过阈值（5px），认为是拖拽
      if (moveDistance > 5) {
        hasMovedRef.current = true;
      }
      
      // 计算新位置（相对于 canvas）
      const canvas = imgRef.current?.closest('.canvas');
      if (!canvas) return;
      
      const canvasRect = canvas.getBoundingClientRect();
      const canvasWidth = 1440; // 画布逻辑宽度
      const canvasHeight = 1024; // 画布逻辑高度
      
      // 画布中心在屏幕的位置
      const canvasCenterX = canvasRect.left + canvasRect.width / 2;
      const canvasCenterY = canvasRect.top + canvasRect.height / 2;
      
      // 将鼠标坐标转换为画布坐标
      // 鼠标相对于画布中心的偏移（屏幕坐标）
      const screenOffsetX = e.clientX - canvasCenterX;
      const screenOffsetY = e.clientY - canvasCenterY;
      
      // 转换为画布逻辑坐标（考虑 zoom）
      const canvasOffsetX = screenOffsetX / zoom;
      const canvasOffsetY = screenOffsetY / zoom;
      
      // 画布中心在画布坐标系中的位置（考虑 pan）
      // 因为画布使用了 translate(-50%, -50%)，所以画布中心在画布坐标系中是 (720, 512)
      // 但是还有 pan 偏移，所以实际中心是 (720 + pan.x, 512 + pan.y)
      const canvasCenterInCanvas = { 
        x: 720 + pan.x, 
        y: 512 + pan.y 
      };
      
      // 计算鼠标在画布坐标系中的位置
      const mouseXInCanvas = canvasCenterInCanvas.x + canvasOffsetX;
      const mouseYInCanvas = canvasCenterInCanvas.y + canvasOffsetY;
      
      // 拖拽偏移也需要转换为画布逻辑坐标
      const dragOffsetInCanvas = {
        x: dragOffset.x / zoom,
        y: dragOffset.y / zoom
      };
      
      // 新位置 = 鼠标位置 - 拖拽偏移
      const newX = mouseXInCanvas - dragOffsetInCanvas.x;
      const newY = mouseYInCanvas - dragOffsetInCanvas.y;
      
      currentPos = { x: newX, y: newY };
      setPosition(currentPos);
    };

    const handleMouseUp = () => {
      // 如果移动距离很小（小于阈值），认为是点击，触发 onClick
      if (!hasMovedRef.current && onClick) {
        onClick();
      }
      
      // 如果移动了，认为是拖拽，触发 onDragEnd
      if (hasMovedRef.current && onDragEnd) {
        onDragEnd(id, currentPos.x, currentPos.y);
      }
      
      setIsDragging(false);
      hasMovedRef.current = false; // 重置移动标志
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, id, position.x, position.y, onDragEnd, zoom, pan]);

  // 计算动画样式
  const getAnimationStyle = () => {
    if (isDragging || !isAnimating) {
      return {}; // 拖拽时或没有动画时，不使用 transition
    }
    
    const distance = calculateDistance(
      prevPositionRef.current.x,
      prevPositionRef.current.y,
      position.x,
      position.y
    );
    
    const duration = calculateDurationByDistance(
      distance,
      CARD_ANIMATION.MOVE_DURATION,
      CARD_ANIMATION.MOVE_DURATION * 2
    );
    
    return {
      transition: `left ${duration}ms ${CARD_ANIMATION.MOVE_EASING}, top ${duration}ms ${CARD_ANIMATION.MOVE_EASING}`,
      transitionDelay: `${animationDelay}ms`,
    };
  };

  return (
    <img
      ref={imgRef}
      className={`${className} ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isAnimating ? 'animating' : ''}`}
      src={src}
      alt={alt}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        borderRadius: (className && className.includes('opengraph-image')) ? '8px' : undefined,
        objectFit: (className && className.includes('opengraph-image')) ? 'contain' : undefined, // 使用 contain 保持比例，不裁剪
        backgroundColor: (className && className.includes('opengraph-image')) ? '#f5f5f5' : undefined, // contain 模式下的背景色
        ...getAnimationStyle(),
      }}
      onMouseDown={handleMouseDown}
      draggable={false}
    />
  );
};

