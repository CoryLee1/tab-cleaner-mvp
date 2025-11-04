/**
 * 获取扩展资源 URL
 * 在 Chrome 扩展中，资源需要通过 chrome.runtime.getURL 获取
 */
export function getAssetUrl(path) {
  // 在扩展页面中，可以直接使用 chrome.runtime.getURL
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    try {
      return chrome.runtime.getURL(path);
    } catch (e) {
      console.warn("[Tab Cleaner] Failed to get asset URL:", e);
    }
  }
  // 降级方案：如果不在扩展环境中，返回相对路径
  // 在开发环境中，路径可能需要调整
  if (path.startsWith('static/')) {
    return `/${path}`;
  }
  return path;
}

/**
 * 获取图片资源 URL
 * 简化调用，自动添加 static/img/ 前缀
 */
export function getImageUrl(imageName) {
  return getAssetUrl(`static/img/${imageName}`);
}

