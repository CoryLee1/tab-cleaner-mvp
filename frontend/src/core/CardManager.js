/**
 * CardManager 类（协调管理）
 * 管理所有卡片和聚类，协调更新循环
 */

import { Cluster } from './Cluster';

export class CardManager {
  /**
   * @param {number} width - 画布宽度
   * @param {number} height - 画布高度
   */
  constructor(width = 1440, height = 1024) {
    this.width = width;
    this.height = height;
    this.cards = new Map(); // cardId -> Card对象
    this.clusters = []; // Cluster对象数组
    this.isSelecting = false;
    this.selectedCardIds = [];
    
    // 配置参数
    this.clusterCenterRadius = 200; // 聚类圆心到画布中心的距离
    this.cardSize = 120;
  }

  /**
   * 初始化卡片
   * @param {Array<Object>} items - 卡片数据数组（OpenGraph数据等）
   */
  initCards(items = []) {
    this.cards.clear();
    this.clusters = [];

    if (items.length === 0) {
      return;
    }

    // 创建所有卡片
    items.forEach((item, index) => {
      const cardId = item.id || `card-${index}`;
      const card = new Card(
        cardId,
        this.width / 2,
        this.height / 2,
        item.is_doc_card ? 200 : 120, // 文档卡片更大
        item
      );
      this.cards.set(cardId, card);
    });

    // 创建默认聚类（包含所有卡片）
    const defaultCluster = new Cluster(
      'default-cluster',
      this.width / 2,
      this.height / 2,
      Array.from(this.cards.keys()),
      {
        name: '未分类',
        type: 'default',
        baseRadius: 40,
        radiusGap: 70,
      }
    );
    this.clusters.push(defaultCluster);

    // 初始化卡片位置（同心圆排列）
    defaultCluster.updateCardPositions(this.cards);
  }

  /**
   * 计算聚类圆心的多边形排列
   * @returns {Array<{x: number, y: number}>}
   */
  getClusterCenterPositions() {
    const numClusters = this.clusters.length;
    if (numClusters === 0) {
      return [];
    }

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const positions = [];

    if (numClusters === 1) {
      // 单个聚类：在中心
      positions.push({ x: centerX, y: centerY });
    } else if (numClusters === 2) {
      // 两个聚类：水平对称
      positions.push(
        { x: centerX - this.clusterCenterRadius / 2, y: centerY },
        { x: centerX + this.clusterCenterRadius / 2, y: centerY }
      );
    } else {
      // 3个及以上：正多边形排列
      const angleStep = (2 * Math.PI) / numClusters;
      const startAngle = -Math.PI / 2; // -90度，让第一个在上方

      for (let i = 0; i < numClusters; i++) {
        const angle = startAngle + i * angleStep;
        let radius;

        if (numClusters === 3) {
          // 正三角形
          radius = this.clusterCenterRadius * 0.577; // 1/√3
        } else if (numClusters === 4) {
          // 正方形
          radius = this.clusterCenterRadius * 0.707; // 1/√2
        } else if (numClusters === 5) {
          // 正五边形
          radius = this.clusterCenterRadius * 0.588;
        } else if (numClusters <= 8) {
          // 6-8个：正多边形
          radius = (this.clusterCenterRadius * 0.5) / Math.sin(Math.PI / numClusters);
        } else {
          // 9个及以上：使用固定半径
          radius = this.clusterCenterRadius;
        }

        positions.push({
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        });
      }
    }

    return positions;
  }

  /**
   * 进入选择模式
   */
  enterSelectionMode() {
    this.isSelecting = true;
    this.selectedCardIds = [];
  }

  /**
   * 切换卡片选中状态
   * @param {string} cardId
   */
  selectCard(cardId) {
    const card = this.cards.get(cardId);
    if (!card) return;

    const index = this.selectedCardIds.indexOf(cardId);
    if (index > -1) {
      // 取消选中
      this.selectedCardIds.splice(index, 1);
      card.setSelected(false);
    } else {
      // 选中
      this.selectedCardIds.push(cardId);
      card.setSelected(true);
    }
  }

  /**
   * 取消选择模式
   */
  cancelSelection() {
    this.selectedCardIds.forEach(cardId => {
      const card = this.cards.get(cardId);
      if (card) {
        card.setSelected(false);
      }
    });
    this.selectedCardIds = [];
    this.isSelecting = false;
  }

  /**
   * 确认创建聚类
   * @param {string} clusterName - 聚类名称
   * @returns {Cluster|null}
   */
  confirmSelection(clusterName = '新聚类') {
    if (this.selectedCardIds.length === 0) {
      return null;
    }

    const cluster = this.createCluster(this.selectedCardIds.slice(), clusterName);
    this.cancelSelection();
    return cluster;
  }

  /**
   * 创建新聚类（关键方法！）
   * @param {Array<string>} cardIds - 要加入聚类的卡片ID数组
   * @param {string} clusterName - 聚类名称
   * @param {string} clusterType - 聚类类型（'manual', 'ai-classify', 'ai-discover'）
   * @returns {Cluster}
   */
  createCluster(cardIds, clusterName = '新聚类', clusterType = 'manual') {
    if (cardIds.length === 0) {
      throw new Error('Cannot create cluster with no cards');
    }

    // 计算新聚类的初始圆心（所有选中卡片的中心）
    let sumX = 0;
    let sumY = 0;
    cardIds.forEach(cardId => {
      const card = this.cards.get(cardId);
      if (card) {
        const center = card.getCenter();
        sumX += center.x;
        sumY += center.y;
      }
    });
    const initialCenterX = sumX / cardIds.length;
    const initialCenterY = sumY / cardIds.length;

    // 创建新的 Cluster 对象
    const clusterId = `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cluster = new Cluster(
      clusterId,
      initialCenterX,
      initialCenterY,
      cardIds,
      {
        name: clusterName,
        type: clusterType,
        baseRadius: 40,
        radiusGap: 70,
      }
    );
    this.clusters.push(cluster);

    // 更新所有选中卡片的 clusterId
    cardIds.forEach(cardId => {
      const card = this.cards.get(cardId);
      if (card) {
        card.clusterId = clusterId;
      }
    });

    // 设置新聚类内卡片的目标位置
    cluster.updateCardPositions(this.cards);

    // 重要：更新旧聚类（去掉被移除的卡片）
    this.clusters.forEach(oldCluster => {
      if (oldCluster.id !== clusterId) {
        oldCluster.cardIds = oldCluster.cardIds.filter(id => !cardIds.includes(id));

        // 如果旧聚类还有卡片，重新排布
        if (oldCluster.cardIds.length > 0) {
          oldCluster.updateCardPositions(this.cards);
        }
      }
    });

    // 重新计算所有聚类的位置（多边形排列）
    this.updateClusterCenters();

    return cluster;
  }

  /**
   * 更新聚类圆心的目标位置到多边形
   */
  updateClusterCenters() {
    const positions = this.getClusterCenterPositions();
    this.clusters.forEach((cluster, i) => {
      if (positions[i]) {
        cluster.setTargetCenter(positions[i].x, positions[i].y);
      }
    });
  }

  /**
   * 每帧更新（关键！）
   * 必须按照正确的顺序执行
   */
  update() {
    // 1. 先更新聚类圆心的目标位置到多边形
    this.updateClusterCenters();

    // 2. 更新所有聚类的圆心位置
    this.clusters.forEach(cluster => cluster.update());

    // 3. 关键：根据新的圆心位置更新卡片的目标位置（随圆心移动）
    this.clusters.forEach(cluster => cluster.updateCardPositions(this.cards));

    // 4. 最后更新所有卡片位置
    this.cards.forEach(card => card.update());
  }

  /**
   * 获取指定点的卡片
   * @param {number} px - 点X坐标
   * @param {number} py - 点Y坐标
   * @returns {string|null} 卡片ID，如果没有则返回null
   */
  getCardAtPoint(px, py) {
    // 从后向前遍历（后添加的在上层）
    const cardArray = Array.from(this.cards.values());
    for (let i = cardArray.length - 1; i >= 0; i--) {
      const card = cardArray[i];
      if (card.contains(px, py)) {
        return card.id;
      }
    }
    return null;
  }

  /**
   * 获取所有卡片的位置信息（用于React渲染）
   * @returns {Array<Object>}
   */
  getCardsForRender() {
    return Array.from(this.cards.values()).map(card => ({
      id: card.id,
      ...card.getPosition(),
      isSelected: card.isSelected,
      clusterId: card.clusterId,
      data: card.data,
    }));
  }

  /**
   * 获取所有聚类信息（用于React渲染）
   * @returns {Array<Object>}
   */
  getClustersForRender() {
    return this.clusters.map(cluster => ({
      id: cluster.id,
      name: cluster.name,
      type: cluster.type,
      center: cluster.getCenter(),
      itemCount: cluster.cardIds.length,
      items: cluster.cardIds.map(cardId => {
        const card = this.cards.get(cardId);
        return card ? { id: card.id, ...card.getPosition(), data: card.data } : null;
      }).filter(Boolean),
    }));
  }

  /**
   * 重置
   */
  reset() {
    this.cards.clear();
    this.clusters = [];
    this.isSelecting = false;
    this.selectedCardIds = [];
  }

  /**
   * 添加外部创建的聚类（用于AI聚类等）
   * @param {Cluster} cluster
   */
  addCluster(cluster) {
    this.clusters.push(cluster);
    // 更新聚类内卡片的 clusterId
    cluster.cardIds.forEach(cardId => {
      const card = this.cards.get(cardId);
      if (card) {
        card.clusterId = cluster.id;
      }
    });
    // 重新计算所有聚类的位置
    this.updateClusterCenters();
  }
}

