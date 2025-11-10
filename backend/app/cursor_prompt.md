# 聚类排布系统 - Cursor实现指南

## 需求概述
实现一个层级多边形聚类排布系统，类似Figma Soot的效果：
- **第一层**：多个聚类的圆心按多边形排列（3个聚类→三角形，4个→菱形，5个→五边形）
- **第二层**：每个聚类内的卡片按同心圆排布围绕各自的圆心

## 核心架构

### 1. Card 类（卡片）
```javascript
class Card {
  // 属性
  - id: 卡片唯一ID
  - x, y: 当前位置
  - targetX, targetY: 目标位置
  - size: 卡片尺寸（如50px）
  - vx, vy: 速度（用于spring动画）
  - clusterId: 所属聚类ID
  - isSelected: 是否被选中
  
  // 方法
  - setTargetPosition(x, y): 设置目标位置
  - update(): 使用spring物理逼近目标位置
    * dx = targetX - x
    * vx += dx * 0.08
    * vx *= 0.92  // 阻尼
    * x += vx
    * 对y同理
  - display(p): 绘制卡片
  - contains(px, py): 检测点击
}
```

### 2. Cluster 类（聚类）
```javascript
class Cluster {
  // 属性
  - id: 聚类唯一ID
  - centerX, centerY: 圆心当前位置
  - targetCenterX, targetCenterY: 圆心目标位置
  - cardIds: 包含的卡片ID数组
  - vcx, vcy: 圆心速度
  - baseRadius: 最内层卡片距离圆心的距离（如40px）
  - radiusGap: 圆层间距（如70px）
  
  // 方法
  - getCardPositions(): 计算同心圆排布
    * 每层cardsPerLayer张卡片（如8张）
    * 第n层半径 = baseRadius + n * radiusGap
    * 在该半径上均匀分布（angleStep = 360 / 该层卡片数）
    * 返回 [{x, y}, {x, y}, ...]
    
  - updateCardPositions(cards): 更新所有卡片的目标位置
    * 获取getCardPositions()的结果
    * 逐个调用 cards[cardId].setTargetPosition(x, y)
    
  - setTargetCenter(x, y): 设置圆心目标位置
  
  - update(): 更新圆心位置（spring动画）
    * 类似Card.update()，对圆心进行物理模拟
    * dcx = targetCenterX - centerX
    * vcx += dcx * 0.06
    * vcx *= 0.90
    * centerX += vcx
    * 对y同理
    
  - display(p): 绘制聚类
    * 画同心圆参考线（可选）
    * 画圆心红点
    
  - getRadius(): 返回该聚类占用的最大半径
    * 用于碰撞检测
}
```

### 3. CardManager 类（协调管理）
```javascript
class CardManager {
  // 属性
  - width, height: 画布尺寸
  - cards: 所有卡片数组
  - clusters: 所有聚类数组
  - isSelecting: 是否在选择模式
  - selectedCardIds: 当前选中的卡片ID列表
  
  // 方法
  - initCards(count): 初始化
    * 创建一个圆心在画布中心的"默认聚类"
    * 创建count张卡片，都加入这个聚类
    * 调用默认聚类的updateCardPositions()排布卡片
    
  - getClusterCenterPositions(): 计算聚类圆心的多边形排列
    * numClusters = clusters.length
    * 中心点 = (width/2, height/2)
    * 多边形半径 ≈ 200-250px
    * angleStep = 360 / numClusters
    * startAngle = -90度（让第一个在上方）
    * 循环计算每个聚类圆心的位置
    * 返回 [{x, y}, {x, y}, ...]
    
  - enterSelectionMode(): 进入选择模式
    * isSelecting = true
    * selectedCardIds = []
    
  - selectCard(cardId): 切换卡片选中状态
    * 如果已选中就取消，反之选中
    * 更新 cards[cardId].isSelected
    
  - cancelSelection(): 退出选择模式
    * 清除所有选中状态
    * isSelecting = false
    
  - confirmSelection(): 确认创建聚类
    * 检查 selectedCardIds.length > 0
    * 调用 createCluster(selectedCardIds.slice())
    * 调用 cancelSelection()
    
  - createCluster(cardIds): 关键方法！
    * 计算新聚类的初始圆心（所有选中卡片的中心）
    * 创建新的 Cluster 对象，加入 clusters 数组
    * 更新所有选中卡片的 clusterId
    * 调用 newCluster.updateCardPositions(this.cards)
    * 更新旧聚类：从旧聚类中移除这些卡片ID
    * 调用旧聚类的 updateCardPositions() 让剩余卡片重新排布
    
  - updateClusterCenters(): 
    * 获取新的多边形位置 getClusterCenterPositions()
    * 为每个聚类调用 setTargetCenter(新位置)
    
  - update(): 每帧更新（关键！）
    * // 1. 更新聚类圆心的目标位置到多边形
    * const positions = getClusterCenterPositions()
    * clusters.forEach((cluster, i) => cluster.setTargetCenter(positions[i].x, positions[i].y))
    * 
    * // 2. 更新所有聚类的圆心位置
    * clusters.forEach(cluster => cluster.update())
    * 
    * // 3. 关键：更新每个聚类内卡片的目标位置（随圆心移动）
    * clusters.forEach(cluster => cluster.updateCardPositions(this.cards))
    * 
    * // 4. 更新所有卡片位置
    * cards.forEach(card => card.update())
    
  - display(p): 绘制
    * 绘制所有聚类 clusters.forEach(c => c.display(p, this.cards))
    * 绘制所有卡片 cards.forEach(c => c.display(p))
    * 绘制聚类圆心的连接线（多边形轮廓，可选）
    * 显示状态文字
    
  - getCardAtPoint(px, py): 点击检测
    * 从后向前遍历卡片数组
    * 返回first hit的卡片ID，或-1
    
  - reset(): 重置
    * 清空所有数据
    * 重新初始化
}
```

## 初始化和交互流程

### p5.js setup()
```javascript
const manager = new CardManager(width, height, 20)
```

### p5.js draw()
```javascript
background(255)
manager.update()
manager.display(p)
```

### 鼠标交互
```javascript
mousePressed() {
  if (manager.isSelecting) {
    const cardId = manager.getCardAtPoint(mouseX, mouseY)
    if (cardId !== -1) {
      manager.selectCard(cardId)
    }
  }
}
```

### UI按钮
```javascript
"开始选择卡片" → manager.enterSelectionMode()
"确认创建聚类" → manager.confirmSelection()
"取消选择" → manager.cancelSelection()
"重置" → manager.reset()
```

## 关键算法详解

### 同心圆排布（Cluster.getCardPositions）
```
输入：this.cardIds 数组（包含5张卡片）
输出：[(x1,y1), (x2,y2), (x3,y3), (x4,y4), (x5,y5)]

cardsPerLayer = 8
第0层：基础半径 = 40px，3张卡片，角度间隔 = 360/3 = 120°
  (centerX + cos(0°)×40, centerY + sin(0°)×40)
  (centerX + cos(120°)×40, centerY + sin(120°)×40)
  (centerX + cos(240°)×40, centerY + sin(240°)×40)
第1层：半径 = 40 + 70 = 110px，2张卡片，角度间隔 = 360/2 = 180°
  (centerX + cos(0°)×110, centerY + sin(0°)×110)
  (centerX + cos(180°)×110, centerY + sin(180°)×110)
```

### 多边形圆心排列（CardManager.getClusterCenterPositions）
```
输入：clusters.length = 3（3个聚类）
输出：3个圆心应该排列的位置

angleStep = 360 / 3 = 120°
startAngle = -90°（上方）
radius = 200px（到画布中心的距离）

聚类0: angle = -90°
  (580 + cos(-90°)×200, 350 + sin(-90°)×200) = (580, 150)
聚类1: angle = -90° + 120° = 30°
  (580 + cos(30°)×200, 350 + sin(30°)×200) ≈ (754, 450)
聚类2: angle = -90° + 240° = 150°
  (580 + cos(150°)×200, 350 + sin(150°)×200) ≈ (406, 450)
```

### Spring动画（Card.update 和 Cluster.update）
```
向目标靠近的物理模型：

dx = targetX - x
vx += dx × 0.08       // 受力加速度
vx *= 0.92            // 阻尼（模拟摩擦）
x += vx               // 更新位置

结果：光滑的缓动效果，不会生硬跳跃
```

## 实现优先级

### Phase 1（必须）
- [ ] Card 类（位置、更新、绘制）
- [ ] Cluster 类（同心圆排布、圆心更新）
- [ ] CardManager 基础（初始化、卡片管理）

### Phase 2（核心）
- [ ] getClusterCenterPositions()（多边形排列）
- [ ] createCluster()（创建新聚类、更新旧聚类）
- [ ] update() 主循环（确保每帧都更新卡片目标位置）

### Phase 3（交互）
- [ ] 选择模式（按钮、卡片高亮）
- [ ] 鼠标点击检测
- [ ] UI状态反馈

## 关键注意点

### 最容易出错的地方：update()方法顺序
❌ 错误：
```javascript
update() {
  cards.forEach(c => c.update())  // 卡片还没有新的目标位置
  clusters.forEach(c => c.update())  // 圆心才更新
  // 结果：卡片滞后，不跟随圆心
}
```

✅ 正确：
```javascript
update() {
  // 1. 先更新聚类圆心的目标位置
  const positions = getClusterCenterPositions()
  clusters.forEach((c, i) => c.setTargetCenter(positions[i].x, positions[i].y))
  
  // 2. 更新聚类圆心的实际位置
  clusters.forEach(c => c.update())
  
  // 3. 关键：根据新的圆心位置更新卡片的目标位置
  clusters.forEach(c => c.updateCardPositions(this.cards))
  
  // 4. 最后更新卡片位置
  cards.forEach(c => c.update())
}
```

### 创建聚类时的步骤
```javascript
createCluster(cardIds) {
  // 1. 创建新聚类对象
  const cluster = new Cluster(id, cx, cy, cardIds)
  clusters.push(cluster)
  
  // 2. 更新卡片的聚类关联
  cardIds.forEach(id => cards[id].clusterId = cluster.id)
  
  // 3. 设置新聚类内卡片的目标位置
  cluster.updateCardPositions(this.cards)
  
  // 4. 重要：更新旧聚类（去掉被移除的卡片）
  clusters.forEach(old => {
    if (old.id !== cluster.id) {
      old.cardIds = old.cardIds.filter(id => !cardIds.includes(id))
      old.updateCardPositions(this.cards)  // 让剩余卡片补位
    }
  })
}
```

## 调试建议

1. 先用简单的固定多边形测试（3个聚类的三角形）
2. 在 display() 中画出聚类圆心的目标位置（用虚线或不同颜色）
3. 用 console.log() 追踪 update() 循环中的顺序
4. 检查 spring 参数（0.08, 0.92）是否需要调整阻尼

## 参考数值

```javascript
// Cluster
baseRadius = 40        // 第一层半径
radiusGap = 70         // 层间距
cardsPerLayer = 8      // 每层最多卡片数

// CardManager
clusterCenterRadius = 200  // 聚类圆心到画布中心的距离
cardSize = 50

// Spring
cardSpringAccel = 0.08    // 加速度系数
cardSpringDamping = 0.92  // 阻尼
clusterSpringAccel = 0.06
clusterSpringDamping = 0.90
```
