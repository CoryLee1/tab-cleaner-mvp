/**
 * Cluster 类（聚类）
 * 管理聚类的圆心、卡片列表和同心圆布局
 */

export class Cluster {
  /**
   * @param {string} id - 聚类唯一ID
   * @param {number} centerX - 圆心初始X坐标
   * @param {number} centerY - 圆心初始Y坐标
   * @param {Array<string>} cardIds - 包含的卡片ID数组
   * @param {Object} options - 配置选项
   */
  constructor(id, centerX, centerY, cardIds = [], options = {}) {
    this.id = id;
    this.centerX = centerX;
    this.centerY = centerY;
    this.targetCenterX = centerX;
    this.targetCenterY = centerY;
    this.cardIds = [...cardIds]; // 卡片ID数组
    this.vcx = 0; // 圆心速度X
    this.vcy = 0; // 圆心速度Y
    
    // 配置参数
    this.baseRadius = options.baseRadius || 40; // 最内层半径
    this.radiusGap = options.radiusGap || 70; // 层间距
    this.cardsPerLayer = options.cardsPerLayer || 8; // 每层最多卡片数
    
    // Spring 动画参数
    this.springAccel = options.springAccel || 0.06; // 加速度系数（比卡片慢）
    this.springDamping = options.springDamping || 0.90; // 阻尼
    
    // 元数据
    this.name = options.name || '未命名聚类';
    this.type = options.type || 'manual';
  }

  /**
   * 计算同心圆排布
   * @returns {Array<{cardId: string, x: number, y: number}>}
   */
  getCardPositions() {
    const positions = [];
    let currentRing = 0;
    let currentIndexInRing = 0;
    let itemsInCurrentRing = 1; // 第一圈1个，第二圈6个，第三圈12个...

    this.cardIds.forEach((cardId, index) => {
      if (currentIndexInRing >= itemsInCurrentRing) {
        currentRing++;
        currentIndexInRing = 0;
        // 每圈数量：1, 6, 12, 18, 24...
        itemsInCurrentRing = currentRing === 0 ? 1 : currentRing * 6;
      }

      const angleStep = (2 * Math.PI) / itemsInCurrentRing;
      const angle = currentIndexInRing * angleStep;
      const radius = this.baseRadius + currentRing * this.radiusGap;

      const x = this.centerX + Math.cos(angle) * radius;
      const y = this.centerY + Math.sin(angle) * radius;

      positions.push({
        cardId,
        x: x - 60, // 减去卡片尺寸的一半（假设卡片120x120）
        y: y - 60,
      });

      currentIndexInRing++;
    });

    return positions;
  }

  /**
   * 更新所有卡片的目标位置
   * @param {Map<string, Card>} cards - 卡片Map（cardId -> Card对象）
   */
  updateCardPositions(cards) {
    const positions = this.getCardPositions();
    positions.forEach(({ cardId, x, y }) => {
      const card = cards.get(cardId);
      if (card) {
        card.setTargetPosition(x, y);
      }
    });
  }

  /**
   * 设置圆心目标位置
   * @param {number} x - 目标X坐标
   * @param {number} y - 目标Y坐标
   */
  setTargetCenter(x, y) {
    this.targetCenterX = x;
    this.targetCenterY = y;
  }

  /**
   * 更新圆心位置（Spring动画）
   */
  update() {
    // X方向
    const dcx = this.targetCenterX - this.centerX;
    this.vcx += dcx * this.springAccel;
    this.vcx *= this.springDamping;
    this.centerX += this.vcx;

    // Y方向
    const dcy = this.targetCenterY - this.centerY;
    this.vcy += dcy * this.springAccel;
    this.vcy *= this.springDamping;
    this.centerY += this.vcy;

    // 如果速度很小且接近目标，直接设置为目标值
    if (Math.abs(this.vcx) < 0.01 && Math.abs(dcx) < 0.01) {
      this.centerX = this.targetCenterX;
      this.vcx = 0;
    }
    if (Math.abs(this.vcy) < 0.01 && Math.abs(dcy) < 0.01) {
      this.centerY = this.targetCenterY;
      this.vcy = 0;
    }
  }

  /**
   * 获取该聚类占用的最大半径（用于碰撞检测）
   * @returns {number}
   */
  getRadius() {
    if (this.cardIds.length === 0) {
      return this.baseRadius;
    }
    const rings = Math.ceil((this.cardIds.length - 1) / 6) + 1;
    return this.baseRadius + (rings - 1) * this.radiusGap + 60; // 60是卡片半径
  }

  /**
   * 添加卡片到聚类
   * @param {string} cardId
   */
  addCard(cardId) {
    if (!this.cardIds.includes(cardId)) {
      this.cardIds.push(cardId);
    }
  }

  /**
   * 从聚类移除卡片
   * @param {string} cardId
   */
  removeCard(cardId) {
    this.cardIds = this.cardIds.filter(id => id !== cardId);
  }

  /**
   * 获取圆心位置
   * @returns {{x: number, y: number}}
   */
  getCenter() {
    return {
      x: this.centerX,
      y: this.centerY,
    };
  }
}

