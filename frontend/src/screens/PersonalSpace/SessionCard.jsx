import React, { useState } from 'react';
import { MASONRY_CONFIG } from '../../config/masonryConfig';
import { getPlaceholderImage, handleImageError } from '../../utils/imagePlaceholder';

/**
 * 单个卡片组件（带悬浮功能）
 */
export const SessionCard = ({ 
  og, 
  isSelected, 
  onSelect, 
  onDelete, 
  onOpenLink,
  isTopResult = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleCardClick = (e) => {
    // 如果点击的是按钮，不触发卡片点击
    if (e.target.closest('.card-action-button')) {
      return;
    }
    // 可以在这里添加双击打开链接的逻辑
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(og.id);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(og.id);
    }
  };

  const handleOpenLink = (e) => {
    e.stopPropagation();
    if (onOpenLink) {
      onOpenLink(og.url);
    }
  };

  const isDocCard = og.is_doc_card || false;
  const BASE_HEIGHT = 120;
  let cardWidth, cardHeight;

  if (isDocCard) {
    cardWidth = 200;
    cardHeight = 150;
  } else {
    if (og.image_width && og.image_height) {
      const aspectRatio = og.image_width / og.image_height;
      cardHeight = BASE_HEIGHT;
      cardWidth = BASE_HEIGHT * aspectRatio;
    } else if (og.original_width && og.original_height) {
      const aspectRatio = og.original_width / og.original_height;
      cardHeight = BASE_HEIGHT;
      cardWidth = BASE_HEIGHT * aspectRatio;
    } else if (og.width && og.height) {
      const aspectRatio = og.width / og.height;
      cardHeight = BASE_HEIGHT;
      cardWidth = BASE_HEIGHT * aspectRatio;
    } else {
      cardHeight = BASE_HEIGHT;
      cardWidth = BASE_HEIGHT * (16/9);
    }
  }

  // 使用配置中的固定宽度（Pinterest 风格：固定宽度，fitWidth 要求）
  // 注意：不再使用动态计算的 displayWidth，而是使用配置中的固定 cardWidth
  // 这样可以确保 fitWidth 正常工作
  const fixedCardWidth = MASONRY_CONFIG.columns.getColumnWidth();

  return (
    <div
      className={`masonry-item ${isSelected ? 'selected' : ''}`}
      style={{
        width: `${fixedCardWidth}px`,  // 固定像素值，fitWidth 要求
        marginBottom: `${MASONRY_CONFIG.columns.gutter}px`,  // 使用配置中的 gutter
        breakInside: 'avoid',
        position: 'relative',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div style={{ position: 'relative' }}>
        <img
          src={og.image || getPlaceholderImage(og)}
          alt={og.title || og.url}
          className={`opengraph-image ${isDocCard ? 'doc-card' : ''} ${isTopResult ? 'top-result' : ''} ${isSelected ? 'selected' : ''}`}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: '8px',
            boxShadow: isSelected 
              ? '0 0 0 3px #1a73e8, 0 2px 8px rgba(0,0,0,0.15)' 
              : '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s ease',
            objectFit: 'contain',
            backgroundColor: '#f5f5f5',
          }}
          onError={(e) => handleImageError(e, og, 'text')}
        />
        
        {/* 悬浮按钮（底部左侧） */}
        {isHovered && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              display: 'flex',
              gap: '8px',
              zIndex: 10,
            }}
          >
            {/* 删除按钮 */}
            <button
              className="card-action-button"
              onClick={handleDelete}
              title="删除"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(220, 53, 69, 0.9)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            {/* 打开链接按钮 */}
            <button
              className="card-action-button"
              onClick={handleOpenLink}
              title="打开链接"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(26, 115, 232, 0.9)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 4L12 10M12 4V10H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* 单选按钮 */}
            <button
              className="card-action-button"
              onClick={handleSelect}
              title="选择（批量操作）"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: isSelected ? 'rgba(26, 115, 232, 0.9)' : 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.target.style.backgroundColor = 'rgba(26, 115, 232, 0.9)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                }
              }}
            >
              {isSelected ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 8L6 11L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="10" height="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

