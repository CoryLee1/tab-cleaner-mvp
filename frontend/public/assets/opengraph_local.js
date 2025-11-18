/**
 * 本地 OpenGraph 抓取工具
 * 在 content script 中运行，利用用户已登录的会话来抓取 OpenGraph 数据
 * 这对于需要登录的网站（如小红书）特别有用
 */

/**
 * 从当前页面抓取 OpenGraph 数据
 * @returns {Object} OpenGraph 数据对象
 */
function fetchLocalOpenGraph() {
  const result = {
    url: window.location.href,
    title: '',
    description: '',
    image: '',
    site_name: '',
    success: false,
  };

  try {
    // 1. 获取 og:title 或 document.title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    result.title = ogTitle ? ogTitle.getAttribute('content') : document.title || '';

    // 2. 获取 og:description
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      result.description = ogDescription.getAttribute('content') || '';
    } else {
      // 如果没有 og:description，尝试使用 meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      result.description = metaDesc ? metaDesc.getAttribute('content') || '' : '';
    }

    // 3. 获取 og:image（优先）
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
      let imageUrl = ogImage.getAttribute('content') || '';
      // 处理相对 URL
      if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        if (imageUrl.startsWith('//')) {
          imageUrl = window.location.protocol + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = window.location.origin + imageUrl;
        } else {
          imageUrl = new URL(imageUrl, window.location.href).href;
        }
      }
      result.image = imageUrl;
    } else {
      // 如果没有 og:image，尝试查找页面中的第一张图片
      const firstImage = document.querySelector('img[src]');
      if (firstImage) {
        let imageUrl = firstImage.getAttribute('src') || '';
        // 处理相对 URL
        if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          if (imageUrl.startsWith('//')) {
            imageUrl = window.location.protocol + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            imageUrl = window.location.origin + imageUrl;
          } else {
            imageUrl = new URL(imageUrl, window.location.href).href;
          }
        }
        result.image = imageUrl;
      }
    }

    // 4. 获取 og:site_name
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName) {
      result.site_name = ogSiteName.getAttribute('content') || '';
    } else {
      // 如果没有 og:site_name，使用域名
      result.site_name = window.location.hostname.replace('www.', '');
    }

    // 5. 判断是否成功（至少要有 title 或 image）
    result.success = !!(result.title || result.image);

    // 6. 尝试获取图片尺寸（如果图片已加载）
    if (result.image) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = result.image;
        // 注意：这里不等待图片加载，因为可能跨域或需要登录
        // 图片尺寸会在后端或前端加载时获取
      } catch (e) {
        // 忽略错误
      }
    }

    return result;
  } catch (error) {
    console.error('[Local OpenGraph] Error fetching OpenGraph:', error);
    result.success = false;
    result.error = error.message;
    return result;
  }
}

/**
 * 批量抓取多个标签页的 OpenGraph（通过消息传递）
 * 这个函数在 background script 中调用，通过消息传递到各个 content script
 */
async function fetchLocalOpenGraphForTabs(tabIds) {
  const results = [];
  
  for (const tabId of tabIds) {
    try {
      // 向 content script 发送消息，请求抓取 OpenGraph
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'fetch-opengraph'
      });
      
      if (response && response.success) {
        results.push({
          ...response,
          tab_id: tabId,
        });
      } else {
        results.push({
          url: '', // 需要从 tab 信息中获取
          success: false,
          error: response?.error || 'Failed to fetch OpenGraph',
          tab_id: tabId,
        });
      }
    } catch (error) {
      console.warn(`[Local OpenGraph] Failed to fetch from tab ${tabId}:`, error);
      results.push({
        url: '', // 需要从 tab 信息中获取
        success: false,
        error: error.message,
        tab_id: tabId,
      });
    }
  }
  
  return results;
}

// 如果在 content script 环境中，导出函数供消息监听器使用
if (typeof window !== 'undefined') {
  window.__TAB_CLEANER_FETCH_OPENGRAPH = fetchLocalOpenGraph;
}

// 注意：消息监听器应该在 content script 中设置（content.js 中已处理）
// 这里只导出函数供 content script 使用

