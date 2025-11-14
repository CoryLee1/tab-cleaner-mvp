/**
 * 聚类 Spring 动画 Hook
 * 实现层级动画：聚类圆心 → 卡片位置
 */

import { useEffect, useRef, useCallback } from 'react';
import { Spring2D, SPRING_CONFIG, globalSpringManager } from '../motion/spring';
import { calculateRadialLayout } from '../utils/radialLayout';

/**
 * 使用聚类 Spring 动画的 Hook
 * 管理聚类圆心和卡片位置的 Spring 动画
 * 
 * @param {Array} clusters - 聚类列表
 * @param {Function} updateCardPosition - 更新卡片位置的函数 (cardId, x, y) => void
 * @param {Function} updateClusterCenter - 更新聚类中心的函数 (clusterId, x, y) => void
 */
export const useClusterSpringAnimation = (
  clusters,
  updateCardPosition,
  updateClusterCenter
) => {
  const clusterSpringsRef = useRef(new Map()); // clusterId -> Spring2D
  const cardSpringsRef = useRef(new Map()); // cardId -> Spring2D
  const animationFrameRef = useRef(null);
  const isRunningRef = useRef(false);

  // 初始化或更新聚类 Spring
  useEffect(() => {
    clusters.forEach(cluster => {
      const clusterId = cluster.id;
      const targetCenter = cluster.center || { x: 720, y: 512 };
      
      if (!clusterSpringsRef.current.has(clusterId)) {
        // 创建新的 Spring
        const spring = new Spring2D(
          targetCenter.x,
          targetCenter.y,
          targetCenter.x,
          targetCenter.y,
          SPRING_CONFIG.cluster
        );
        clusterSpringsRef.current.set(clusterId, spring);
        globalSpringManager.add(spring);
      } else {
        // 更新目标位置
        const spring = clusterSpringsRef.current.get(clusterId);
        spring.setTarget(targetCenter.x, targetCenter.y);
      }
    });

    // 移除不存在的聚类 Spring
    const currentClusterIds = new Set(clusters.map(c => c.id));
    clusterSpringsRef.current.forEach((spring, clusterId) => {
      if (!currentClusterIds.has(clusterId)) {
        globalSpringManager.remove(spring);
        clusterSpringsRef.current.delete(clusterId);
      }
    });
  }, [clusters]);

  // 生成 clusters 的依赖字符串（用于精确检测变化）
  const getClustersDependency = useCallback((clusters) => {
    return clusters.map(cluster => {
      const itemIds = (cluster.items || []).map(item => item.id).filter(Boolean).sort().join(',');
      const center = cluster.center || { x: 720, y: 512 };
      // 包括 items 列表和圆心位置
      return `${cluster.id}|${itemIds}|${center.x},${center.y}`;
    }).join(';');
  }, []);

  // 使用 ref 存储最新的 clusters，避免闭包问题
  const clustersRef = useRef(clusters);
  useEffect(() => {
    clustersRef.current = clusters;
  }, [clusters]);

  // 更新卡片 Spring 和位置
  const updateCardPositions = useCallback(() => {
    // 使用 ref 获取最新的 clusters，避免闭包问题
    const currentClusters = clustersRef.current;
    
    currentClusters.forEach(cluster => {
      const clusterId = cluster.id;
      const clusterSpring = clusterSpringsRef.current.get(clusterId);
      if (!clusterSpring) return;

      // 获取聚类圆心的当前 Spring 位置
      const currentCenter = clusterSpring.getValue();
      
      // 计算卡片的目标位置（基于当前圆心位置）
      const clusterItems = cluster.items || [];
      if (clusterItems.length === 0) return;

      // 调试日志
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        console.log('[Spring] Updating card positions for cluster:', {
          clusterId: cluster.id,
          clusterName: cluster.name,
          itemCount: clusterItems.length,
          centerX: currentCenter.x,
          centerY: currentCenter.y,
          itemIds: clusterItems.map(i => i.id).slice(0, 5), // 只显示前5个
        });
      }

      // 检查 items 是否已经有位置信息
      // 如果 items 已经有 x, y 坐标，直接使用；否则重新计算
      const itemsWithPositions = clusterItems.filter(item => 
        item.x !== undefined && item.y !== undefined && 
        !isNaN(item.x) && !isNaN(item.y)
      );
      
      let positionedItems;
      if (itemsWithPositions.length === clusterItems.length && clusterItems.length > 0) {
        // 所有 items 都有有效的位置，直接使用（但需要根据当前圆心调整偏移）
        // 计算原圆心（假设是 720, 512）到新圆心的偏移
        const originalCenter = { x: 720, y: 512 };
        const offsetX = currentCenter.x - originalCenter.x;
        const offsetY = currentCenter.y - originalCenter.y;
        
        positionedItems = clusterItems.map(item => ({
          ...item,
          x: item.x + offsetX,
          y: item.y + offsetY,
        }));
      } else {
        // 部分或全部 items 没有位置，重新计算
        const avgCardSize = clusterItems.reduce((sum, item) => {
          const width = item.width || (item.is_doc_card ? 200 : 120);
          const height = item.height || (item.is_doc_card ? 150 : 120);
          return sum + Math.max(width, height);
        }, 0) / clusterItems.length || 120;

        positionedItems = calculateRadialLayout(clusterItems, {
          centerX: currentCenter.x,
          centerY: currentCenter.y,
          imageSize: avgCardSize,
          spacing: null,
        });
      }

      // 更新每个卡片的 Spring
      positionedItems.forEach((item, index) => {
        const cardId = item.id;
        if (!cardId) return;

        if (!cardSpringsRef.current.has(cardId)) {
          // 创建新的卡片 Spring
          // 使用 item 的当前 x, y 作为初始位置，如果不存在则使用计算出的位置
          const currentX = item.x ?? (item.initialX ?? item.x);
          const currentY = item.y ?? (item.initialY ?? item.y);
          const targetX = item.x;
          const targetY = item.y;
          
          const cardSpring = new Spring2D(
            currentX,
            currentY,
            targetX,
            targetY,
            SPRING_CONFIG.card
          );
          cardSpringsRef.current.set(cardId, cardSpring);
          globalSpringManager.add(cardSpring);
        } else {
          // 更新卡片目标位置
          const cardSpring = cardSpringsRef.current.get(cardId);
          // 获取当前 Spring 的位置作为起始位置，避免跳跃
          const currentPos = cardSpring.getValue();
          cardSpring.setPosition(currentPos.x, currentPos.y);
          cardSpring.setTarget(item.x, item.y);
        }
      });
    });

    // 移除不在任何聚类中的卡片 Spring
    const allCardIds = new Set(
      currentClusters.flatMap(c => (c.items || []).map(item => item.id).filter(Boolean))
    );
    cardSpringsRef.current.forEach((spring, cardId) => {
      if (!allCardIds.has(cardId)) {
        globalSpringManager.remove(spring);
        cardSpringsRef.current.delete(cardId);
      }
    });
  }, []); // 移除 clusters 依赖，使用 ref 获取最新值

  // 缓存上次的位置，用于检测变化（避免不必要的状态更新）
  const lastPositionsRef = useRef(new Map()); // cardId -> {x, y}
  const lastCentersRef = useRef(new Map()); // clusterId -> {x, y}

  // 使用依赖字符串来精确检测 clusters 的变化
  const clustersDependencyRef = useRef('');
  useEffect(() => {
    const newDependency = getClustersDependency(clusters);
    if (newDependency !== clustersDependencyRef.current) {
      clustersDependencyRef.current = newDependency;
      // 当 clusters 变化时，立即更新卡片位置（不等待动画循环）
      updateCardPositions();
    }
  }, [clusters, getClustersDependency, updateCardPositions]);

  // 主更新循环
  useEffect(() => {
    // 如果没有聚类，不启动动画循环
    if (clusters.length === 0) {
      isRunningRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }
    
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const update = () => {
      // 按照参考实现的正确顺序：
      // 1. 更新聚类圆心的目标位置（已在 clusters 变化时通过 useEffect 更新）
      // 2. 更新聚类圆心的实际位置（Spring 动画）
      clusterSpringsRef.current.forEach((spring, clusterId) => {
        spring.update();
        const center = spring.getValue();
        
        // 只在位置变化足够大时才更新 React 状态（优化性能）
        const lastCenter = lastCentersRef.current.get(clusterId);
        if (!lastCenter || 
            Math.abs(center.x - lastCenter.x) > 0.5 || 
            Math.abs(center.y - lastCenter.y) > 0.5) {
          updateClusterCenter(clusterId, center.x, center.y);
          lastCentersRef.current.set(clusterId, { x: center.x, y: center.y });
        }
      });

      // 3. 关键：根据新的圆心位置更新卡片的目标位置（随聚类圆心移动）
      // 每帧都调用，确保卡片跟随圆心
      updateCardPositions();

      // 4. 最后更新卡片位置（Spring 动画）
      cardSpringsRef.current.forEach((spring, cardId) => {
        spring.update();
        const position = spring.getValue();
        
        // 只在位置变化足够大时才更新 React 状态（优化性能）
        const lastPos = lastPositionsRef.current.get(cardId);
        if (!lastPos || 
            Math.abs(position.x - lastPos.x) > 0.5 || 
            Math.abs(position.y - lastPos.y) > 0.5) {
          updateCardPosition(cardId, position.x, position.y);
          lastPositionsRef.current.set(cardId, { x: position.x, y: position.y });
        }
      });

      // 继续下一帧
      if (isRunningRef.current) {
        animationFrameRef.current = requestAnimationFrame(update);
      }
    };

    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      isRunningRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateCardPosition, updateClusterCenter, updateCardPositions]);

  // 清理函数
  useEffect(() => {
    return () => {
      // 清理所有 Spring
      clusterSpringsRef.current.forEach(spring => {
        globalSpringManager.remove(spring);
      });
      cardSpringsRef.current.forEach(spring => {
        globalSpringManager.remove(spring);
      });
      clusterSpringsRef.current.clear();
      cardSpringsRef.current.clear();
    };
  }, []);
};

