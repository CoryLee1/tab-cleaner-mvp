/**
 * 图片占位符工具函数
 * 用于处理 OpenGraph 图片加载失败的情况
 */

/**
 * 水色色板（4种蓝色系）
 */
const WATER_COLORS = [
  '#E3F2FD', // 非常浅的淡蓝色（pastel blue）
  '#60D7FD', // 鲜艳的天空蓝（sky blue/azure）
  '#93BBFA', // 中等薰衣草蓝/紫蓝色（lavender/periwinkle）
  '#78909C', // 深色钢蓝/石板蓝（steel blue/slate blue）
];

/**
 * 根据 URL 生成一个稳定的颜色（从水色色板中选择）
 */
export const getColorFromUrl = (url) => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = url.charCodeAt(i) + ((hash << 5) - hash);
  }
  // 从4种水色中选择一个
  const index = Math.abs(hash) % WATER_COLORS.length;
  return WATER_COLORS[index];
};

/**
 * 从 Google Search URL 中提取搜索关键词
 */
export const extractGoogleSearchQuery = (url) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    // 检查是否是 Google Search
    if (urlObj.hostname.includes('google.') && urlObj.pathname.includes('/search')) {
      const params = new URLSearchParams(urlObj.search);
      const query = params.get('q');
      if (query) {
        return decodeURIComponent(query);
      }
    }
  } catch (e) {
    // URL 解析失败
  }
  return null;
};

/**
 * 从 URL 中提取更有意义的显示文本
 */
export const extractMeaningfulTextFromUrl = (url) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    // 提取域名（去掉 .com, .org 等后缀）
    const domainParts = hostname.split('.');
    if (domainParts.length > 0) {
      return domainParts[0];
    }
    
    return hostname;
  } catch (e) {
    // URL 解析失败，尝试直接提取
    try {
      const match = url.match(/\/\/([^\/]+)/);
      if (match) {
        return match[1].replace('www.', '');
      }
    } catch (e2) {
      // 忽略
    }
  }
  return null;
};

/**
 * 获取占位符显示的文本（智能提取）
 */
export const getPlaceholderText = (og) => {
  // 1. 如果是 Google Search，提取搜索关键词
  const searchQuery = extractGoogleSearchQuery(og.url);
  if (searchQuery) {
    return `搜索: ${searchQuery}`;
  }
  
  // 2. 优先使用 title（但排除通用标题）
  if (og.title && og.title.trim()) {
    const title = og.title.trim();
    // 排除一些通用标题
    const genericTitles = ['Google Search', 'Google', 'Search', 'Loading...', 'Untitled'];
    if (!genericTitles.includes(title)) {
      return title;
    }
  }
  
  // 3. 使用 description（如果有）
  if (og.description && og.description.trim()) {
    const desc = og.description.trim();
    // 限制长度
    return desc.length > 50 ? desc.substring(0, 50) + '...' : desc;
  }
  
  // 4. 使用 site_name（如果有）
  if (og.site_name && og.site_name.trim()) {
    return og.site_name.trim();
  }
  
  // 5. 从 URL 提取域名
  const domainText = extractMeaningfulTextFromUrl(og.url);
  if (domainText) {
    return domainText;
  }
  
  // 6. 使用 tab_title（如果有）
  if (og.tab_title && og.tab_title.trim()) {
    return og.tab_title.trim();
  }
  
  // 7. 最后使用 URL 本身（截取一部分）
  if (og.url) {
    try {
      const urlObj = new URL(og.url);
      const path = urlObj.pathname;
      if (path && path !== '/') {
        const parts = path.split('/').filter(p => p);
        if (parts.length > 0) {
          return parts[parts.length - 1];
        }
      }
    } catch (e) {
      // 如果 URL 解析失败，返回 URL 的一部分
      return og.url.length > 30 ? og.url.substring(0, 30) + '...' : og.url;
    }
  }
  
  return 'No Title';
};

/**
 * 从 URL 或标题中提取首字母
 */
export const getInitials = (og) => {
  // 优先从占位符文本提取
  const text = getPlaceholderText(og);
  if (text && text !== 'No Title') {
    const words = text.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase().substring(0, 2);
    }
    if (words[0]) {
      return words[0][0].toUpperCase();
    }
  }
  
  // 从 URL 提取域名首字母
  if (og.url) {
    try {
      const urlObj = new URL(og.url);
      const hostname = urlObj.hostname.replace('www.', '');
      const parts = hostname.split('.');
      if (parts.length > 0) {
        return parts[0][0].toUpperCase();
      }
    } catch (e) {
      // URL 解析失败
    }
  }
  
  return '?';
};

/**
 * 生成纯色背景 + 居中标题的占位符（方案1：用户要求的）
 */
export const generateTextPlaceholder = (og, width = 200, height = 150) => {
  const color = getColorFromUrl(og.url || 'default');
  const text = getPlaceholderText(og);
  
  // 限制文本长度，避免 SVG 过大
  // 对于较长的文本，使用更小的字体并换行
  let displayText = text;
  let fontSize = 14;
  let lines = [text];
  
  if (text.length > 25) {
    // 尝试智能换行
    const words = text.split(/\s+/);
    if (words.length > 1) {
      // 尝试分成两行
      const mid = Math.ceil(words.length / 2);
      lines = [
        words.slice(0, mid).join(' '),
        words.slice(mid).join(' ')
      ];
      fontSize = 12;
    } else {
      // 单个长词，直接截断
      displayText = text.length > 30 ? text.substring(0, 30) + '...' : text;
      fontSize = 12;
    }
  } else if (text.length > 20) {
    fontSize = 12;
  }
  
  // 根据颜色亮度决定文字颜色（深色用白色，浅色用深色）
  // 简单判断：如果是浅色（前两种），用深色文字；如果是深色（后两种），用白色文字
  const lightColors = [WATER_COLORS[0], WATER_COLORS[1]];
  const isLightColor = lightColors.includes(color);
  const textColor = isLightColor ? '#424242' : '#FFFFFF';
  const textShadow = isLightColor 
    ? '0 1px 2px rgba(255,255,255,0.5)' 
    : '0 1px 2px rgba(0,0,0,0.3)';
  
  // 如果是多行，生成多行文本
  if (lines.length > 1) {
    const lineHeight = fontSize + 4;
    const totalHeight = lines.length * lineHeight;
    const startY = (height - totalHeight) / 2 + fontSize;
    
    const textElements = lines.map((line, index) => {
      const y = startY + index * lineHeight;
      return `<text 
        x="50%" 
        y="${y}" 
        text-anchor="middle" 
        dominant-baseline="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="500"
        fill="${textColor}"
        style="text-shadow: ${textShadow};"
      >
        ${line.length > 25 ? line.substring(0, 25) + '...' : line}
      </text>`;
    }).join('');
    
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="${color}"/>
        ${textElements}
      </svg>
    `)}`;
  }
  
  // 单行文本
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${color}"/>
      <text 
        x="50%" 
        y="50%" 
        text-anchor="middle" 
        dominant-baseline="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="500"
        fill="${textColor}"
        style="text-shadow: ${textShadow};"
      >
        ${displayText}
      </text>
    </svg>
  `)}`;
};

/**
 * 生成首字母 + 渐变背景的占位符（方案2：更简洁美观）
 */
export const generateInitialsPlaceholder = (og, width = 200, height = 150) => {
  const color = getColorFromUrl(og.url || 'default');
  const initials = getInitials(og);
  
  // 根据颜色亮度决定文字颜色
  const lightColors = [WATER_COLORS[0], WATER_COLORS[1]];
  const textColor = lightColors.includes(color) ? '#424242' : '#FFFFFF';
  const textShadow = lightColors.includes(color) 
    ? '0 1px 2px rgba(255,255,255,0.5)' 
    : '0 2px 4px rgba(0,0,0,0.3)';
  
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${color}"/>
      <text 
        x="50%" 
        y="50%" 
        text-anchor="middle" 
        dominant-baseline="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        font-size="48"
        font-weight="600"
        fill="${textColor}"
        opacity="0.9"
        style="text-shadow: ${textShadow};"
      >
        ${initials}
      </text>
    </svg>
  `)}`;
};

/**
 * 获取占位符图片（统一入口）
 * 优先级：screenshot > favicon > 纯色占位符
 * 
 * @param {Object} og - OpenGraph 数据对象
 * @param {string} style - 占位符样式：'text'（标题）或 'initials'（首字母），默认 'text'
 * @param {number} width - 占位符宽度，默认 200
 * @param {number} height - 占位符高度，默认 150
 * @returns {string} 占位符图片 URL（data URI 或普通 URL）
 */
export const getPlaceholderImage = (og, style = 'text', width = 200, height = 150) => {
  // 1. 尝试使用截图
  if (og.screenshot) {
    return og.screenshot;
  }
  
  // 2. 尝试使用 favicon（如果数据中有）
  if (og.favicon) {
    return og.favicon;
  }
  
  // 3. 尝试从 URL 生成 favicon
  if (og.url) {
    try {
      const urlObj = new URL(og.url);
      const faviconUrl = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
      // 注意：这里不直接返回，因为 favicon 也可能加载失败
      // 让前端通过 onError 处理
      // return faviconUrl;
    } catch (e) {
      // URL 解析失败，继续下一步
    }
  }
  
  // 4. 使用纯色占位符（根据 style 参数选择样式）
  if (style === 'initials') {
    return generateInitialsPlaceholder(og, width, height);
  } else {
    return generateTextPlaceholder(og, width, height);
  }
};

/**
 * 处理图片加载错误
 * @param {Event} e - 图片错误事件
 * @param {Object} og - OpenGraph 数据对象
 * @param {string} style - 占位符样式
 */
export const handleImageError = (e, og, style = 'text') => {
  const img = e.target;
  const placeholder = getPlaceholderImage(og, style);
  
  // 避免无限循环：如果已经是占位符，就不再替换
  if (img.src !== placeholder && !img.src.startsWith('data:image/svg+xml')) {
    img.src = placeholder;
  }
};

