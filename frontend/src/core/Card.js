/**
 * Card 类（卡片）
 * 管理单个卡片的位置、动画和状态
 */

export class Card {
  /**
   * @param {string} id - 卡片唯一ID
   * @param {number} x - 初始X坐标
   * @param {number} y - 初始Y坐标
   * @param {number} size - 卡片尺寸（默认120）
   * @param {Object} data - 卡片数据（OpenGraph数据等）
   */
  constructor(id, x, y, size = 120, data = {}) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.size = size;
    this.vx = 0; // 速度X
    this.vy = 0; // 速度Y
    this.clusterId = null; // 所属聚类ID
    this.isSelected = false;
    this.data = data; // 存储原始数据（OpenGraph等）
    
    // Spring 动画参数
    this.springAccel = 0.08; // 加速度系数
    this.springDamping = 0.92; // 阻尼
  }

  /**
   * 设置目标位置
   * @param {number} x - 目标X坐标
   * @param {number} y - 目标Y坐标
   */
  setTargetPosition(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  /**
   * 更新位置（使用Spring物理模拟）
   */
  update() {
    // X方向
    const dx = this.targetX - this.x;
    this.vx += dx * this.springAccel;
    this.vx *= this.springDamping;
    this.x += this.vx;

    // Y方向
    const dy = this.targetY - this.y;
    this.vy += dy * this.springAccel;
    this.vy *= this.springDamping;
    this.y += this.vy;

    // 如果速度很小且接近目标，直接设置为目标值（避免无限接近）
    if (Math.abs(this.vx) < 0.01 && Math.abs(dx) < 0.01) {
      this.x = this.targetX;
      this.vx = 0;
    }
    if (Math.abs(this.vy) < 0.01 && Math.abs(dy) < 0.01) {
      this.y = this.targetY;
      this.vy = 0;
    }
  }

  /**
   * 检测点是否在卡片内
   * @param {number} px - 点X坐标
   * @param {number} py - 点Y坐标
   * @returns {boolean}
   */
  contains(px, py) {
    return (
      px >= this.x &&
      px <= this.x + this.size &&
      py >= this.y &&
      py <= this.y + this.size
    );
  }

  /**
   * 获取卡片中心点
   * @returns {{x: number, y: number}}
   */
  getCenter() {
    return {
      x: this.x + this.size / 2,
      y: this.y + this.size / 2,
    };
  }

  /**
   * 设置选中状态
   * @param {boolean} selected
   */
  setSelected(selected) {
    this.isSelected = selected;
  }

  /**
   * 获取位置信息（用于React渲染）
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  getPosition() {
    return {
      x: this.x,
      y: this.y,
      width: this.size,
      height: this.size,
    };
  }
}

