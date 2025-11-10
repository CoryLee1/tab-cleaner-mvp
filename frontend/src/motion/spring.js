/**
 * Spring 物理动画系统
 * 实现类似 Figma Soot 的平滑动画效果
 */

/**
 * Spring 动画参数
 */
export const SPRING_CONFIG = {
  // 卡片动画参数
  card: {
    accel: 0.08,      // 加速度系数
    damping: 0.92,    // 阻尼（0-1，越小越慢）
  },
  // 聚类圆心动画参数
  cluster: {
    accel: 0.06,      // 加速度系数（比卡片稍慢）
    damping: 0.90,    // 阻尼
  },
};

/**
 * Spring 动画类
 * 用于平滑地从一个值过渡到目标值
 */
export class Spring {
  constructor(value, target, config = SPRING_CONFIG.card) {
    this.value = value;
    this.target = target;
    this.velocity = 0;
    this.config = config;
  }

  /**
   * 更新 Spring 状态
   * 使用物理模拟：加速度 + 阻尼
   */
  update() {
    const dx = this.target - this.value;
    this.velocity += dx * this.config.accel;
    this.velocity *= this.config.damping;
    this.value += this.velocity;
    
    // 如果速度很小且接近目标，直接设置为目标值（避免无限接近）
    if (Math.abs(this.velocity) < 0.01 && Math.abs(dx) < 0.01) {
      this.value = this.target;
      this.velocity = 0;
    }
  }

  /**
   * 设置目标值
   */
  setTarget(target) {
    this.target = target;
  }

  /**
   * 获取当前值
   */
  getValue() {
    return this.value;
  }

  /**
   * 是否已经到达目标（在容差范围内）
   */
  isAtTarget(tolerance = 0.5) {
    return Math.abs(this.target - this.value) < tolerance && Math.abs(this.velocity) < 0.1;
  }
}

/**
 * 2D Spring（用于位置）
 */
export class Spring2D {
  constructor(x, y, targetX, targetY, config = SPRING_CONFIG.card) {
    this.springX = new Spring(x, targetX, config);
    this.springY = new Spring(y, targetY, config);
  }

  update() {
    this.springX.update();
    this.springY.update();
  }

  setTarget(x, y) {
    this.springX.setTarget(x);
    this.springY.setTarget(y);
  }

  getValue() {
    return {
      x: this.springX.getValue(),
      y: this.springY.getValue(),
    };
  }

  isAtTarget(tolerance = 0.5) {
    return this.springX.isAtTarget(tolerance) && this.springY.isAtTarget(tolerance);
  }
}

/**
 * 创建 Spring 动画管理器
 * 用于统一管理所有 Spring 动画的更新循环
 */
export class SpringManager {
  constructor() {
    this.springs = [];
    this.animationFrameId = null;
    this.isRunning = false;
  }

  /**
   * 添加 Spring 对象
   */
  add(spring) {
    if (!this.springs.includes(spring)) {
      this.springs.push(spring);
    }
    this.start();
  }

  /**
   * 移除 Spring 对象
   */
  remove(spring) {
    const index = this.springs.indexOf(spring);
    if (index > -1) {
      this.springs.splice(index, 1);
    }
    if (this.springs.length === 0) {
      this.stop();
    }
  }

  /**
   * 开始动画循环
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    const update = () => {
      // 更新所有 Spring
      this.springs.forEach(spring => spring.update());
      
      // 继续下一帧
      if (this.isRunning && this.springs.length > 0) {
        this.animationFrameId = requestAnimationFrame(update);
      } else {
        this.isRunning = false;
      }
    };
    
    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * 停止动画循环
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 清除所有 Spring
   */
  clear() {
    this.springs = [];
    this.stop();
  }
}

// 全局 Spring 管理器实例
export const globalSpringManager = new SpringManager();

