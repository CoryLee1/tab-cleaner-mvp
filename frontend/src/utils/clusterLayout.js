/**
 * 聚类布局工具函数
 * 用于计算多个聚类的位置，避免重叠
 */

/**
 * 计算多个聚类的布局位置，避免重叠
 * 使用螺旋布局算法，从中心向外扩散
 * 
 * @param {Array} clusters - 聚类列表，每个聚类包含 items 和 center 信息
 * @param {Object} options - 布局选项
 * @param {number} options.canvasWidth - 画布宽度（默认 1440）
 * @param {number} options.canvasHeight - 画布高度（默认 1024）
 * @param {number} options.clusterSpacing - 聚类之间的最小间距（默认 500）
 * @returns {Array} 更新了 center 位置的聚类列表
 */
export const calculateMultipleClustersLayout = (clusters, options = {}) => {
  if (!clusters || clusters.length === 0) {
    return [];
  }

  const {
    canvasWidth = 1440,
    canvasHeight = 1024,
    clusterSpacing = 1000, // 聚类之间的最小间距（增加以避免重叠）
    clusterCenterRadius = 500, // 聚类圆心到画布中心的距离（增加以让聚类更分散）
  } = options;

  // 计算每个聚类的半径（基于其 items 数量）
  // 考虑文档卡片可能更大（240x180），所以半径估算要更保守
  const clusterRadii = clusters.map(cluster => {
    const items = cluster.items || [];
    const itemCount = items.length;
    // 估算聚类半径：基于圆形排列的最大半径
    // 假设每圈6个，计算需要多少圈
    // 卡片尺寸：普通120x120，文档240x180，取最大240作为基准
    const cardSize = 240; // 使用文档卡片的最大尺寸
    if (itemCount <= 1) {
      return cardSize / 2 + 50; // 单个卡片半径 + 边距
    }
    const rings = Math.ceil((itemCount - 1) / 6) + 1;
    return rings * (cardSize * 0.6) + 100; // 每圈间距，加上边距
  });

  // 使用螺旋布局：从画布中心开始，按螺旋向外排列
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  const positionedClusters = [];
  const usedPositions = []; // 记录已使用的位置，用于碰撞检测

  // 按照正多边形方式布局：1个在中心，2个水平对称，3个正三角形，4个正方形，5个正五边形
  const getOptimalPosition = (idx, total) => {
    if (total === 1) {
      // 单个聚类：在中心
      return [centerX, centerY];
    } else if (total === 2) {
      // 两个聚类：水平对称
      if (idx === 0) return [centerX - clusterCenterRadius / 2, centerY];
      return [centerX + clusterCenterRadius / 2, centerY];
    } else if (total === 3) {
      // 三个聚类：正三角形（等边三角形）
      // 第一个在上方，第二个在左下，第三个在右下
      const angle = (idx * 2 * Math.PI) / 3 - Math.PI / 2; // -90度开始，让第一个在上方
      return [
        centerX + Math.cos(angle) * clusterCenterRadius, // 文档要求：radius = 200px
        centerY + Math.sin(angle) * clusterCenterRadius
      ];
    } else if (total === 4) {
      // 四个聚类：正方形（菱形）
      const angle = (idx * 2 * Math.PI) / 4 - Math.PI / 4; // -45度开始
      return [
        centerX + Math.cos(angle) * clusterCenterRadius, // 文档要求：radius = 200px
        centerY + Math.sin(angle) * clusterCenterRadius
      ];
    } else if (total === 5) {
      // 五个聚类：正五边形
      const angle = (idx * 2 * Math.PI) / 5 - Math.PI / 2; // -90度开始，让第一个在上方
      return [
        centerX + Math.cos(angle) * clusterCenterRadius, // 文档要求：radius = 200px
        centerY + Math.sin(angle) * clusterCenterRadius
      ];
    }
    // 6个及以上：使用正多边形或螺旋布局
    if (total <= 8) {
      // 6-8个聚类：使用正多边形
      const angle = (idx * 2 * Math.PI) / total - Math.PI / 2;
      const radius = clusterCenterRadius; // 使用文档要求的半径
      return [
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius
      ];
    }
    // 9个及以上：使用螺旋布局
    return null;
  };

  clusters.forEach((cluster, idx) => {
    const items = cluster.items || [];
    const clusterRadius = clusterRadii[idx];

    let centerXPos, centerYPos;
    let useOptimalLayout = false;

    // 尝试使用最优布局（适用于1-5个聚类）
    const optimalPos = getOptimalPosition(idx, clusters.length);
    if (optimalPos) {
      [centerXPos, centerYPos] = optimalPos;
      
      // 检查是否与已有聚类重叠（对于1-5个聚类，通常不会重叠，但还是要检查）
      let overlaps = false;
      for (const usedPos of usedPositions) {
        const [usedX, usedY, usedR] = usedPos;
        const distance = Math.sqrt((centerXPos - usedX) ** 2 + (centerYPos - usedY) ** 2);
        if (distance < (clusterRadius + usedR + 80)) { // 80px 安全边距
          overlaps = true;
          break;
        }
      }
      
      if (overlaps) {
        // 如果重叠，回退到螺旋布局，清除已设置的位置
        centerXPos = undefined;
        centerYPos = undefined;
      } else {
        // 没有重叠，使用最优布局
        useOptimalLayout = true;
      }
    }

    // 如果没有最优布局或重叠，使用螺旋布局
    if (!useOptimalLayout) {
      // 如果这是第一个聚类，放在中心
      if (idx === 0) {
        centerXPos = centerX;
        centerYPos = centerY;
      } else {
        // 从中心开始螺旋搜索
        let bestPosition = null;
        let bestDistance = Infinity;
        const angleStep = Math.PI / 4; // 每45度一个位置，更密集

        for (let ring = 1; ring < 15; ring++) {
          for (let angleIdx = 0; angleIdx < ring * 8; angleIdx++) {
            const angle = angleIdx * angleStep;
            // 螺旋半径随圈数增加
            const spiralR = ring * (clusterSpacing * 0.8);
            const testX = centerX + Math.cos(angle) * spiralR;
            const testY = centerY + Math.sin(angle) * spiralR;

            // 检查是否与已有聚类重叠
            let overlaps = false;
            for (const usedPos of usedPositions) {
              const [usedX, usedY, usedR] = usedPos;
              const distance = Math.sqrt((testX - usedX) ** 2 + (testY - usedY) ** 2);
              if (distance < (clusterRadius + usedR + 80)) { // 80px 安全边距
                overlaps = true;
                break;
              }
            }

            // 检查是否超出画布
            if (testX - clusterRadius < 0 || testX + clusterRadius > canvasWidth ||
                testY - clusterRadius < 0 || testY + clusterRadius > canvasHeight) {
              continue;
            }

            if (!overlaps) {
              // 选择距离中心最近的位置（优先）
              const distanceFromCenter = Math.sqrt((testX - centerX) ** 2 + (testY - centerY) ** 2);
              if (distanceFromCenter < bestDistance) {
                bestDistance = distanceFromCenter;
                bestPosition = [testX, testY];
              }
            }
          }

          if (bestPosition) {
            break;
          }
        }

        if (bestPosition) {
          [centerXPos, centerYPos] = bestPosition;
        } else {
          // 如果找不到合适位置，使用简单的网格布局作为后备
          const cols = Math.ceil(Math.sqrt(clusters.length));
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          centerXPos = 200 + col * clusterSpacing;
          centerYPos = 200 + row * clusterSpacing;
        }
      }
    }

    // 更新聚类的中心位置
    cluster.center = { x: centerXPos, y: centerYPos };

    positionedClusters.push(cluster);

    // 记录已使用的位置
    usedPositions.push([centerXPos, centerYPos, clusterRadius]);
  });

  return positionedClusters;
};

