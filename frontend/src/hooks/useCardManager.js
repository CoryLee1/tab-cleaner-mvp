/**
 * useCardManager Hook
 * 桥接 CardManager 和 React 状态
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { CardManager } from '../core/CardManager';

/**
 * 使用 CardManager 的 React Hook
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {Array} initialItems - 初始卡片数据
 * @returns {Object} CardManager 的方法和状态
 */
export const useCardManager = (width = 1440, height = 1024, initialItems = []) => {
  const managerRef = useRef(null);
  const [cards, setCards] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const animationFrameRef = useRef(null);

  // 初始化 CardManager
  useEffect(() => {
    managerRef.current = new CardManager(width, height);
    
    if (initialItems.length > 0) {
      managerRef.current.initCards(initialItems);
      syncState();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []); // 只在组件挂载时初始化一次

  // 同步 CardManager 状态到 React 状态
  const syncState = useCallback(() => {
    if (!managerRef.current) return;

    setCards(managerRef.current.getCardsForRender());
    setClusters(managerRef.current.getClustersForRender());
    setIsSelecting(managerRef.current.isSelecting);
    setSelectedCardIds([...managerRef.current.selectedCardIds]);
  }, []);

  // 更新循环
  useEffect(() => {
    if (!managerRef.current) return;

    const update = () => {
      managerRef.current.update();
      syncState();
      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [syncState]);

  // 初始化卡片
  const initCards = useCallback((items) => {
    if (managerRef.current) {
      managerRef.current.initCards(items);
      syncState();
    }
  }, [syncState]);

  // 进入选择模式
  const enterSelectionMode = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.enterSelectionMode();
      syncState();
    }
  }, [syncState]);

  // 选择卡片
  const selectCard = useCallback((cardId) => {
    if (managerRef.current) {
      managerRef.current.selectCard(cardId);
      syncState();
    }
  }, [syncState]);

  // 取消选择
  const cancelSelection = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.cancelSelection();
      syncState();
    }
  }, [syncState]);

  // 确认创建聚类
  const confirmSelection = useCallback((clusterName = '新聚类') => {
    if (managerRef.current) {
      const cluster = managerRef.current.confirmSelection(clusterName);
      syncState();
      return cluster;
    }
    return null;
  }, [syncState]);

  // 创建聚类
  const createCluster = useCallback((cardIds, clusterName = '新聚类', clusterType = 'manual') => {
    if (managerRef.current) {
      const cluster = managerRef.current.createCluster(cardIds, clusterName, clusterType);
      syncState();
      return cluster;
    }
    return null;
  }, [syncState]);

  // 获取指定点的卡片
  const getCardAtPoint = useCallback((px, py) => {
    if (managerRef.current) {
      return managerRef.current.getCardAtPoint(px, py);
    }
    return null;
  }, []);

  // 添加聚类（用于AI聚类等）
  const addCluster = useCallback((cluster) => {
    if (managerRef.current) {
      managerRef.current.addCluster(cluster);
      syncState();
    }
  }, [syncState]);

  // 重置
  const reset = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.reset();
      syncState();
    }
  }, [syncState]);

  return {
    // 状态
    cards,
    clusters,
    isSelecting,
    selectedCardIds,
    
    // 方法
    initCards,
    enterSelectionMode,
    selectCard,
    cancelSelection,
    confirmSelection,
    createCluster,
    getCardAtPoint,
    addCluster,
    reset,
    
    // 直接访问 manager（用于高级操作）
    manager: managerRef.current,
  };
};

