// assets/background.js

// 导入 API 配置
importScripts('api_config.js');

/**
 * 判断 URL 是否为文档类网页（应使用截图）
 */
function isDocLikeUrl(url) {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  const docKeywords = [
    "github.com", "gitlab.com", "readthedocs.io", "stackoverflow.com", "stackexchange.com",
    "/docs/", "developer.", "dev.", "documentation", "wiki",
    "notion.so", "notion.site", "feishu.cn", "feishuapp.com", "larkoffice.com",
    "docs.google.com", "docs.googleusercontent.com", "confluence", "jira", "atlassian.net",
    "docs.xiaohongshu.com", "xiaohongshu.com/doc/", "mp.weixin.qq.com",
    "zhihu.com", "juejin.cn", "segmentfault.com", "csdn.net",
    "medium.com", "dev.to", "hashnode.com", "reddit.com/r/",
  ];
  return docKeywords.some(keyword => urlLower.includes(keyword));
}

/**
 * 为文档类标签页截图（在关闭之前）
 */
async function captureDocTabScreenshots(tabs) {
  const screenshotResults = [];
  
  // 获取当前窗口
  const currentWindow = await chrome.windows.getCurrent();
  
  for (const tab of tabs) {
    // 只对文档类 URL 截图
    if (!isDocLikeUrl(tab.url)) {
      continue;
    }
    
    try {
      console.log(`[Tab Screenshot] Capturing screenshot for: ${tab.url}`);
      
      // 切换到该标签页
      await chrome.tabs.update(tab.id, { active: true });
      
      // 等待标签页激活
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 使用 content script 准备页面（滚动到顶部，等待加载）
      // 这样可以确保从页面开头截图，并且内容已完全加载
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // 滚动到页面顶部，确保从开头截图
            window.scrollTo(0, 0);
            
            // 等待页面加载完成
            return new Promise((resolve) => {
              if (document.readyState === 'complete') {
                // 页面已加载完成，再等待一下确保动态内容加载（特别是文档类页面）
                setTimeout(resolve, 1500);
              } else {
                // 等待页面加载完成
                window.addEventListener('load', () => {
                  setTimeout(resolve, 1500);
                }, { once: true });
              }
            });
          }
        });
      } catch (scriptError) {
        // 如果注入脚本失败（可能是特殊页面，如 chrome://），继续尝试截图
        console.warn(`[Tab Screenshot] Failed to inject script for tab ${tab.id}, continuing anyway:`, scriptError);
        // 等待固定时间
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // 截图（captureVisibleTab 截取当前活动标签页的可见区域）
      // 注意：只能捕获可见区域，不能自动滚动捕获全页
      // 对于我们的用例（文档类网站可视化），首屏截图已经足够
      const dataUrl = await chrome.tabs.captureVisibleTab(currentWindow.id, {
        format: 'jpeg',
        quality: 85,
      });
      
      screenshotResults.push({
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
        screenshot: dataUrl, // 完整的 data:image/jpeg;base64,xxx 格式
        isScreenshot: true,
      });
      
      console.log(`[Tab Screenshot] Successfully captured screenshot for tab ${tab.id}`);
    } catch (error) {
      console.error(`[Tab Screenshot] Failed to capture tab ${tab.id}:`, error);
      screenshotResults.push({
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
        screenshot: null,
        isScreenshot: false,
        error: error.message,
      });
    }
    
    // 每个标签页之间稍作延迟
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  return screenshotResults;
}

/**
 * 将截图数据合并到 OpenGraph 数据中
 * 前端截图优先（更可靠），后端数据作为补充
 */
function mergeScreenshotsIntoOpenGraph(opengraphItems, screenshotResults) {
  // 创建截图映射（按 URL 匹配）
  const screenshotMap = new Map();
  screenshotResults.forEach(result => {
    if (result.screenshot && result.url) {
      screenshotMap.set(result.url, result.screenshot);
    }
  });
  
  // 合并数据
  return opengraphItems.map(item => {
    const url = item.url;
    const frontendScreenshot = screenshotMap.get(url);
    
    if (frontendScreenshot) {
      // 前端截图优先（更可靠，绕过安全拦截）
      return {
        ...item,
        image: frontendScreenshot, // 完整的 data:image/jpeg;base64,xxx 格式
        is_screenshot: true,
        is_doc_card: false, // 前端截图成功，不再是文档卡片
        pending_screenshot: false, // 截图完成
      };
    }
    
    // 如果没有前端截图，使用后端数据
    // 对于文档类网页，后端会生成文档卡片（包含标题+类型）作为视觉锚点
    // 如果后端截图完成，会替换文档卡片；如果失败，保持文档卡片
    return item;
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Cleaner installed");
});

chrome.action.onClicked.addListener(async (tab) => {
  const url = tab?.url ?? "";
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
    console.log("Cannot run on:", url);
    return;
  }

  // 先试通信（如果已经注入过会成功）
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "toggle" });
    return;
  } catch (_) {
    console.warn("No listener; injecting content script…");
  }

  // 兜底：注入 content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["assets/content.js"],
    });
    // 注入完成再显示
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { action: "show" }).catch(err => {
        console.error("sendMessage after inject failed:", err);
      });
    }, 150);
  } catch (err) {
    console.error("executeScript failed:", err);
  }
});

// ✅ 处理来自 content script 的 "toggle-pet" 消息
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "toggle-pet") {
    console.log("[Tab Cleaner Background] Received toggle-pet request from tab:", sender.tab?.id);
    
    if (!sender.tab || !sender.tab.id) {
      console.error("[Tab Cleaner Background] No tab ID available");
      sendResponse({ ok: false, error: "No tab ID" });
      return true;
    }

    const tabId = sender.tab.id;
    
    // 获取当前扩展的 ID（在 background script 中可用）
    const extensionId = chrome.runtime.id;
    console.log("[Tab Cleaner Background] Extension ID:", extensionId);

    // 步骤 1: 先设置扩展 ID 和事件监听器（在页面上下文中）
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (extensionId) => {
        // 直接使用从 background script 传入的扩展 ID
        window.__TAB_CLEANER_EXTENSION_ID = extensionId;
        console.log("[Tab Cleaner Pet] Extension ID set from background:", window.__TAB_CLEANER_EXTENSION_ID);
        
        // 如果还是没有，尝试从脚本 URL 推断（备用）
        if (!window.__TAB_CLEANER_EXTENSION_ID) {
          const scripts = document.querySelectorAll('script[src*="pet.js"]');
          if (scripts.length > 0) {
            const scriptSrc = scripts[scripts.length - 1].src || '';
            const match = scriptSrc.match(/chrome-extension:\/\/([^/]+)/);
            if (match) {
              window.__TAB_CLEANER_EXTENSION_ID = match[1];
              console.log("[Tab Cleaner Pet] Extension ID from script URL:", window.__TAB_CLEANER_EXTENSION_ID);
            }
          }
        }
        
        if (!window.__TAB_CLEANER_PET_LISTENER_SETUP) {
          window.addEventListener('__TAB_CLEANER_PET_LOADED', function(e) {
            if (window.__TAB_CLEANER_PET && window.__TAB_CLEANER_PET.toggle) {
              console.log("[Tab Cleaner Pet] Auto-toggle after load");
              window.__TAB_CLEANER_PET.toggle();
            }
          });
          window.__TAB_CLEANER_PET_LISTENER_SETUP = true;
          console.log("[Tab Cleaner Pet] Event listeners set up in page context");
        }
      },
      args: [chrome.runtime.id] // 传递扩展 ID 作为参数
    }).then(() => {
      // 步骤 2: 加载 pet.js（在页面上下文中）
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["assets/pet.js"]
      }).then(() => {
        console.log("[Tab Cleaner Background] Pet.js loaded, waiting for initialization...");
        
        // 步骤 3: 等待模块加载后调用 toggle
        // 增加延迟，确保 pet.js 完全加载并初始化
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              // 检查模块是否已加载
              if (window.__TAB_CLEANER_PET && typeof window.__TAB_CLEANER_PET.toggle === 'function') {
                console.log("[Tab Cleaner Pet] Module ready, toggling pet...");
                // 使用 setTimeout 确保在下一个事件循环中执行，避免与模块初始化冲突
                setTimeout(() => {
                  if (window.__TAB_CLEANER_PET && typeof window.__TAB_CLEANER_PET.toggle === 'function') {
                    window.__TAB_CLEANER_PET.toggle();
                  }
                }, 50);
              } else {
                console.log("[Tab Cleaner Pet] Module not ready, waiting for load event...");
                // 监听加载完成事件
                const handleLoaded = (e) => {
                  console.log("[Tab Cleaner Pet] Load event received, toggling...");
                  setTimeout(() => {
                    if (window.__TAB_CLEANER_PET && typeof window.__TAB_CLEANER_PET.toggle === 'function') {
                      window.__TAB_CLEANER_PET.toggle();
                    }
                  }, 50);
                  window.removeEventListener('__TAB_CLEANER_PET_LOADED', handleLoaded);
                };
                window.addEventListener('__TAB_CLEANER_PET_LOADED', handleLoaded);
              }
            }
          }).then(() => {
            sendResponse({ ok: true, message: "Pet toggled" });
          }).catch(err => {
            console.error("[Tab Cleaner Background] Failed to trigger toggle:", err);
            sendResponse({ ok: false, error: err.message });
          });
        }, 300); // 增加延迟到 300ms，确保模块完全初始化
      }).catch(err => {
        console.error("[Tab Cleaner Background] Failed to load pet.js:", err);
        sendResponse({ ok: false, error: "Failed to load pet.js: " + err.message });
      });
    }).catch(err => {
      console.error("[Tab Cleaner Background] Failed to setup listener:", err);
      sendResponse({ ok: false, error: "Failed to setup listener: " + err.message });
    });

    // 返回 true 表示异步响应
    return true;
  }
  
  // 处理打开个人空间消息
  if (req.action === "open-personalspace") {
    console.log("[Tab Cleaner Background] Opening personal space...");
    try {
      chrome.tabs.create({
        url: chrome.runtime.getURL("personalspace.html")
      }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error("[Tab Cleaner Background] Failed to create tab:", chrome.runtime.lastError);
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, tabId: tab?.id });
        }
      });
    } catch (error) {
      console.error("[Tab Cleaner Background] Error opening personal space:", error);
      sendResponse({ ok: false, error: error.message });
    }
    return true; // 异步响应
  }

  // 处理 Clean Button：抓取所有 tab 的 OpenGraph
  if (req.action === "clean") {
    console.log("[Tab Cleaner Background] Clean button clicked, fetching OpenGraph for all tabs...");
    
    // 获取所有打开的 tabs
    chrome.tabs.query({}, async (tabs) => {
      try {
        // 过滤掉 chrome://, chrome-extension://, about: 等特殊页面
        // 同时过滤掉 Chrome Web Store 等不需要收录的页面
        const validTabs = tabs.filter(tab => {
          const url = tab.url || '';
          const lowerUrl = url.toLowerCase();
          
          // 过滤特殊协议
          if (url.startsWith('chrome://') || 
              url.startsWith('chrome-extension://') || 
              url.startsWith('about:') ||
              url.startsWith('edge://')) {
            return false;
          }
          
          // 过滤 Chrome Web Store 等不需要收录的页面
          if (lowerUrl.includes('chrome.google.com/webstore') ||
              lowerUrl.includes('chrome.google.com/extensions') ||
              lowerUrl.includes('webstore.google.com')) {
            return false;
          }
          
          return true;
        });

        // 去重：相同 URL 只保留一个（保留第一个）
        const seenUrls = new Set();
        const uniqueTabs = validTabs.filter(tab => {
          const url = tab.url || '';
          if (seenUrls.has(url)) {
            return false;
          }
          seenUrls.add(url);
          return true;
        });

        console.log(`[Tab Cleaner Background] Found ${validTabs.length} valid tabs, ${uniqueTabs.length} unique tabs after deduplication`);

        // 优先调用后端 API 抓取 OpenGraph（所有网页都先尝试 OpenGraph）
        // 只有 OpenGraph 失败或没有图片，且是文档类时，后端才会使用截图/文档卡片
        let response;
        let opengraphData;
        
        // 创建超时控制器（兼容性更好的方式）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        // 获取 API 地址
        const apiUrl = API_CONFIG.getBaseUrlSync();
        const opengraphUrl = `${apiUrl}/api/v1/tabs/opengraph`;
        
        try {
          response = await fetch(opengraphUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tabs: uniqueTabs.map(tab => ({
                url: tab.url,
                title: tab.title,
                id: tab.id,
              }))
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId); // 请求成功，清除超时
        } catch (fetchError) {
          clearTimeout(timeoutId); // 确保清除超时
          
          // 处理网络错误（连接失败、超时等）
          if (fetchError.name === 'AbortError') {
            throw new Error('请求超时：后端服务器响应时间过长（超过30秒），请检查服务器状态');
          } else if (fetchError.message && (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError'))) {
            throw new Error(`无法连接到后端服务器（${apiUrl}）。请确保：\n1. 后端服务已启动\n2. 后端服务运行在 ${apiUrl}\n3. 没有防火墙阻止连接`);
          } else {
            throw new Error(`网络请求失败：${fetchError.message || fetchError.toString()}`);
          }
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '未知错误');
          throw new Error(`HTTP 错误 (${response.status})：${errorText}`);
        }

        try {
          opengraphData = await response.json();
          console.log('[Tab Cleaner Background] OpenGraph data received:', opengraphData);
        } catch (jsonError) {
          throw new Error(`响应解析失败：${jsonError.message}`);
        }

        // 处理 OpenGraph 数据
        // 后端已经优先使用 OpenGraph，只有文档类且 OpenGraph 失败时才使用截图/文档卡片
        const opengraphItems = opengraphData.data || (Array.isArray(opengraphData) ? opengraphData : []);
        let mergedData = opengraphItems; // 不再需要前端截图合并，后端已处理
        console.log(`[Tab Cleaner Background] Processed ${mergedData.length} OpenGraph items`);

        // 🔄 本地兜底：对于需要登录的网站（如小红书），如果后端抓取失败或没有图片，尝试本地抓取
        const needsLocalFallback = (item) => {
          // 判断是否需要本地抓取兜底
          const urlLower = (item.url || '').toLowerCase();
          const needsLoginSites = ['xiaohongshu.com', 'weibo.com', 'zhihu.com', 'douban.com'];
          const isNeedsLoginSite = needsLoginSites.some(site => urlLower.includes(site));
          
          // 如果是需要登录的网站，且后端抓取失败或没有图片，使用本地抓取
          return isNeedsLoginSite && (!item.success || !item.image);
        };

        // 对需要本地兜底的 item 进行本地抓取
        const itemsNeedingLocalFallback = mergedData.filter(needsLocalFallback);
        if (itemsNeedingLocalFallback.length > 0) {
          console.log(`[Tab Cleaner Background] Attempting local OpenGraph fetch for ${itemsNeedingLocalFallback.length} items...`);
          
          const localFetchPromises = itemsNeedingLocalFallback.map(async (item) => {
            const tabId = uniqueTabs.find(t => t.url === item.url)?.id;
            if (!tabId) return item;
            
            try {
              // 确保 content script 已注入
              try {
                await chrome.scripting.executeScript({
                  target: { tabId },
                  files: ['assets/content.js']
                });
                // 等待 content script 加载完成
                await new Promise(resolve => setTimeout(resolve, 300));
              } catch (e) {
                console.warn(`[Tab Cleaner Background] Failed to inject content script for tab ${tabId}:`, e);
              }
              
              // 发送消息请求本地抓取 OpenGraph
              const localResult = await chrome.tabs.sendMessage(tabId, { action: 'fetch-opengraph' });
              
              if (localResult && localResult.success) {
                console.log(`[Tab Cleaner Background] ✓ Local OpenGraph fetch succeeded for ${item.url.substring(0, 60)}...`);
                // 合并本地抓取的数据（优先使用本地数据，特别是图片）
                return {
                  ...item,
                  title: localResult.title || item.title,
                  description: localResult.description || item.description,
                  image: localResult.image || item.image, // 本地图片优先
                  site_name: localResult.site_name || item.site_name,
                  success: true,
                  is_local_fetch: true, // 标记为本地抓取
                };
              }
            } catch (error) {
              console.warn(`[Tab Cleaner Background] Local OpenGraph fetch failed for ${item.url.substring(0, 60)}...:`, error.message);
            }
            
            return item; // 如果本地抓取失败，返回原始数据
          });
          
          const localFetchedItems = await Promise.all(localFetchPromises);
          
          // 更新 mergedData，用本地抓取的结果替换原始数据
          mergedData = mergedData.map(item => {
            const localFetched = localFetchedItems.find(local => local.url === item.url);
            return localFetched || item;
          });
          
          console.log(`[Tab Cleaner Background] ✓ Local OpenGraph fallback completed`);
        }

        // 后端已经在 OpenGraph 解析时预取了 embedding，但可能还在异步处理中
        // 检查哪些 item 还没有 embedding，补充请求（作为兜底）
        console.log('[Tab Cleaner Background] Checking and supplementing embeddings for OpenGraph items...');
        const itemsWithEmbeddings = await Promise.all(mergedData.map(async (item, index) => {
          // 如果已经有 embedding，直接返回
          if (item.text_embedding && item.image_embedding) {
            console.log(`[Tab Cleaner Background] ✓ Embeddings already present for ${item.url.substring(0, 60)}...`);
            return item;
          }
          
          // 如果 item 成功但还没有 embedding，补充请求（后端可能还在异步处理）
          if (item.success && (!item.text_embedding || !item.image_embedding)) {
            // 避免频繁请求，添加小延迟
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, 50)); // 50ms 延迟
            }
            
            try {
              const embeddingUrl = `${apiUrl}/api/v1/search/embedding`;
              const response = await fetch(embeddingUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  opengraph_items: [{
                    url: item.url,
                    title: item.title,
                    description: item.description,
                    image: item.image,
                    site_name: item.site_name,
                    is_screenshot: item.is_screenshot,
                    is_doc_card: item.is_doc_card,
                  }]
                }),
              });
              
              if (response.ok) {
                const embeddingData = await response.json();
                if (embeddingData.data && embeddingData.data.length > 0) {
                  const embeddingItem = embeddingData.data[0];
                  if (embeddingItem.text_embedding && embeddingItem.image_embedding) {
                    console.log(`[Tab Cleaner Background] ✓ Supplemented embeddings for ${item.url.substring(0, 60)}...`);
                    return {
                      ...item,
                      text_embedding: embeddingItem.text_embedding,
                      image_embedding: embeddingItem.image_embedding,
                    };
                  }
                }
              }
            } catch (error) {
              console.warn(`[Tab Cleaner Background] Failed to supplement embeddings for ${item.url.substring(0, 60)}... Error:`, error);
            }
          }
          return item; // 返回原始 item 或已有的 item
        }));
        console.log('[Tab Cleaner Background] Embedding check completed.');

        // 创建新 session
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 获取现有 sessions
        const storageResult = await chrome.storage.local.get(['sessions']);
        const existingSessions = storageResult.sessions || [];
        
        // 生成 session 名称（洗衣筐1, 洗衣筐2, ...）
        const existingNames = existingSessions.map(s => s.name);
        let counter = 1;
        let sessionName = `洗衣筐${counter}`;
        while (existingNames.includes(sessionName)) {
          counter++;
          sessionName = `洗衣筐${counter}`;
        }
        
        const newSession = {
          id: sessionId,
          name: sessionName,
          createdAt: Date.now(),
          opengraphData: itemsWithEmbeddings,
          tabCount: itemsWithEmbeddings.length,
        };
        
        // 新 session 添加到顶部（最新的在前）
        const updatedSessions = [newSession, ...existingSessions];
        
        // 保存到 storage
        // 同时保存 sessions 和 opengraphData（向后兼容）
        await chrome.storage.local.set({ 
          sessions: updatedSessions,
          opengraphData: {
            ok: opengraphData.ok || true,
            data: itemsWithEmbeddings
          },
          lastCleanTime: Date.now(),
          currentSessionId: sessionId, // 设置当前 session
        });

        console.log(`[Tab Cleaner Background] ✓ All OpenGraph data fetched and saved (${itemsWithEmbeddings.length} items)`);

        // 关闭所有标签页（OpenGraph 已获取完成，可以关闭了）
        // 对于文档类且 OpenGraph 失败的，后端会使用截图/文档卡片，不需要保持标签页打开
        const allTabIds = uniqueTabs
          .map(tab => tab.id)
          .filter(id => id !== undefined);
        
        if (allTabIds.length > 0) {
          console.log(`[Tab Cleaner Background] Closing ${allTabIds.length} tabs...`);
          // 逐个关闭，避免一个失败导致全部失败
          for (const tabId of allTabIds) {
            try {
              await chrome.tabs.remove(tabId);
            } catch (error) {
              // Tab 可能已经被关闭，忽略错误
              console.warn(`[Tab Cleaner Background] Tab ${tabId} already closed or invalid:`, error.message);
            }
          }
          console.log(`[Tab Cleaner Background] ✓ All tabs closed`);
        }

        // 最后打开个人空间展示结果
        console.log(`[Tab Cleaner Background] Opening personal space...`);
        await chrome.tabs.create({
          url: chrome.runtime.getURL("personalspace.html")
        });
        console.log(`[Tab Cleaner Background] ✓ Personal space opened`);

        sendResponse({ ok: true, data: opengraphData });
      } catch (error) {
        console.error('[Tab Cleaner Background] Failed to fetch OpenGraph:', error);
        
        // 提供更详细的错误信息
        let errorMessage = error.message || '未知错误';
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          const apiUrl = API_CONFIG.getBaseUrlSync();
          errorMessage = `无法连接到后端服务器。请确保：\n1. 后端服务已启动（运行在 ${apiUrl}）\n2. 后端服务正常运行\n3. 没有防火墙阻止连接`;
        }
        
        // 即使失败，也尝试打开个人空间（使用之前保存的数据）
        try {
          chrome.tabs.create({
            url: chrome.runtime.getURL("personalspace.html")
          });
        } catch (tabError) {
          console.warn('[Tab Cleaner Background] Failed to open personal space:', tabError);
        }
        
        sendResponse({ 
          ok: false, 
          error: errorMessage,
          details: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        });
      }
    });

    return true; // 异步响应
  }

  // 处理桌宠设置（跳转到个人空间）
  if (req.action === "pet-setting") {
    console.log("[Tab Cleaner Background] Pet setting clicked, opening personal space...");
    try {
      chrome.tabs.create({
        url: chrome.runtime.getURL("personalspace.html")
      }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error("[Tab Cleaner Background] Failed to create tab:", chrome.runtime.lastError);
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, tabId: tab?.id });
        }
      });
    } catch (error) {
      console.error("[Tab Cleaner Background] Error opening personal space:", error);
      sendResponse({ ok: false, error: error.message });
    }
    return true; // 异步响应
  }

  // 处理清理当前页 Tab（归档到上一个旧session）
  if (req.action === "clean-current-tab") {
    console.log("[Tab Cleaner Background] Clean current tab clicked...");
    
    if (!sender.tab || !sender.tab.id) {
      sendResponse({ ok: false, error: "No tab ID available" });
      return true;
    }

    const currentTab = sender.tab;
    
    // 获取当前 tab 的 OpenGraph 数据
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        const tab = tabs[0];
        if (!tab || !tab.url) {
          sendResponse({ ok: false, error: "No active tab found" });
          return;
        }

        const url = tab.url;
        const title = tab.title;

        // 过滤掉特殊页面和 Chrome Web Store
        const lowerUrl = url.toLowerCase();
        if (url.startsWith('chrome://') || 
            url.startsWith('chrome-extension://') || 
            url.startsWith('about:') ||
            url.startsWith('edge://') ||
            lowerUrl.includes('chrome.google.com/webstore') ||
            lowerUrl.includes('chrome.google.com/extensions') ||
            lowerUrl.includes('webstore.google.com')) {
          sendResponse({ ok: false, error: "Cannot clean special pages" });
          return;
        }

        // 调用后端 API 获取 OpenGraph 数据
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        // 获取 API 地址
        const apiUrl = API_CONFIG.getBaseUrlSync();
        const opengraphUrl = `${apiUrl}/api/v1/tabs/opengraph`;

        let response;
        try {
          response = await fetch(opengraphUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tabs: [{ url, title, id: tab.id }]
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error('[Tab Cleaner Background] Failed to fetch OpenGraph:', fetchError);
          sendResponse({ ok: false, error: fetchError.message });
          return;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '未知错误');
          sendResponse({ ok: false, error: `HTTP ${response.status}: ${errorText}` });
          return;
        }

        const opengraphData = await response.json();
        const items = opengraphData.data || (Array.isArray(opengraphData) ? opengraphData : []);
        
        if (items.length === 0) {
          sendResponse({ ok: false, error: "No OpenGraph data received" });
          return;
        }

        const item = items[0];

        // 获取现有 sessions
        const storageResult = await chrome.storage.local.get(['sessions']);
        const existingSessions = storageResult.sessions || [];

        if (existingSessions.length === 0) {
          // 如果没有 sessions，创建一个新的
          const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const newSession = {
            id: sessionId,
            name: '洗衣筐1',
            createdAt: Date.now(),
            opengraphData: [item],
            tabCount: 1,
          };
          await chrome.storage.local.set({ 
            sessions: [newSession],
            currentSessionId: sessionId,
          });
        } else {
          // 归档到最新的 session（第一个，因为按时间倒序）
          const latestSession = existingSessions[0];
          const updatedData = [...(latestSession.opengraphData || []), item];
          const updatedSession = {
            ...latestSession,
            opengraphData: updatedData,
            tabCount: updatedData.length,
          };
          
          const updatedSessions = [updatedSession, ...existingSessions.slice(1)];
          await chrome.storage.local.set({ sessions: updatedSessions });
        }

        // 关闭当前 tab
        try {
          await chrome.tabs.remove(currentTab.id);
        } catch (error) {
          console.warn('[Tab Cleaner Background] Failed to close tab:', error);
        }

        sendResponse({ ok: true, message: "Current tab cleaned and archived" });
      } catch (error) {
        console.error('[Tab Cleaner Background] Failed to clean current tab:', error);
        sendResponse({ ok: false, error: error.message });
      }
    });

    return true; // 异步响应
  }

  // 处理一键清理（创建新session并清理所有tab）
  if (req.action === "clean-all") {
    // 复用 "clean" 的逻辑（已经会创建新 session）
    console.log("[Tab Cleaner Background] Clean all (from pet) clicked, fetching OpenGraph for all tabs...");
    
    // 获取所有打开的 tabs
    chrome.tabs.query({}, async (tabs) => {
      try {
        // 过滤掉 chrome://, chrome-extension://, about: 等特殊页面
        // 同时过滤掉 Chrome Web Store 等不需要收录的页面
        const validTabs = tabs.filter(tab => {
          const url = tab.url || '';
          const lowerUrl = url.toLowerCase();
          
          // 过滤特殊协议
          if (url.startsWith('chrome://') || 
              url.startsWith('chrome-extension://') || 
              url.startsWith('about:') ||
              url.startsWith('edge://')) {
            return false;
          }
          
          // 过滤 Chrome Web Store 等不需要收录的页面
          if (lowerUrl.includes('chrome.google.com/webstore') ||
              lowerUrl.includes('chrome.google.com/extensions') ||
              lowerUrl.includes('webstore.google.com')) {
            return false;
          }
          
          return true;
        });

        // 去重：相同 URL 只保留一个（保留第一个）
        const seenUrls = new Set();
        const uniqueTabs = validTabs.filter(tab => {
          const url = tab.url || '';
          if (seenUrls.has(url)) {
            return false;
          }
          seenUrls.add(url);
          return true;
        });

        console.log(`[Tab Cleaner Background] Found ${validTabs.length} valid tabs, ${uniqueTabs.length} unique tabs after deduplication`);

        // 调用后端 API 抓取 OpenGraph
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        // 获取 API 地址
        const apiUrl = API_CONFIG.getBaseUrlSync();
        const opengraphUrl = `${apiUrl}/api/v1/tabs/opengraph`;
        
        let response;
        try {
          response = await fetch(opengraphUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tabs: uniqueTabs.map(tab => ({
                url: tab.url,
                title: tab.title,
                id: tab.id,
              }))
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '未知错误');
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const opengraphData = await response.json();
        const opengraphItems = opengraphData.data || (Array.isArray(opengraphData) ? opengraphData : []);

        // 补充 embedding（如果需要）
        const itemsWithEmbeddings = await Promise.all(opengraphItems.map(async (item, index) => {
          if (item.text_embedding && item.image_embedding) {
            return item;
          }
          if (item.success && (!item.text_embedding || !item.image_embedding)) {
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            try {
              const embeddingUrl = `${apiUrl}/api/v1/search/embedding`;
              const embedResponse = await fetch(embeddingUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  opengraph_items: [{
                    url: item.url,
                    title: item.title,
                    description: item.description,
                    image: item.image,
                    site_name: item.site_name,
                    is_screenshot: item.is_screenshot,
                    is_doc_card: item.is_doc_card,
                  }]
                }),
              });
              if (embedResponse.ok) {
                const embedData = await embedResponse.json();
                if (embedData.data && embedData.data.length > 0) {
                  const embedItem = embedData.data[0];
                  if (embedItem.text_embedding && embedItem.image_embedding) {
                    return {
                      ...item,
                      text_embedding: embedItem.text_embedding,
                      image_embedding: embedItem.image_embedding,
                    };
                  }
                }
              }
            } catch (error) {
              console.warn(`[Tab Cleaner Background] Failed to supplement embeddings:`, error);
            }
          }
          return item;
        }));

        // 创建新 session
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const storageResult = await chrome.storage.local.get(['sessions']);
        const existingSessions = storageResult.sessions || [];
        
        const existingNames = existingSessions.map(s => s.name);
        let counter = 1;
        let sessionName = `洗衣筐${counter}`;
        while (existingNames.includes(sessionName)) {
          counter++;
          sessionName = `洗衣筐${counter}`;
        }
        
        const newSession = {
          id: sessionId,
          name: sessionName,
          createdAt: Date.now(),
          opengraphData: itemsWithEmbeddings,
          tabCount: itemsWithEmbeddings.length,
        };
        
        const updatedSessions = [newSession, ...existingSessions];
        
        await chrome.storage.local.set({ 
          sessions: updatedSessions,
          opengraphData: {
            ok: opengraphData.ok || true,
            data: itemsWithEmbeddings
          },
          lastCleanTime: Date.now(),
          currentSessionId: sessionId,
        });

        console.log(`[Tab Cleaner Background] ✓ All OpenGraph data fetched and saved (${itemsWithEmbeddings.length} items)`);

        // 关闭所有标签页（OpenGraph 已获取完成，可以关闭了）
        const allTabIds = uniqueTabs.map(tab => tab.id).filter(id => id !== undefined);
        if (allTabIds.length > 0) {
          console.log(`[Tab Cleaner Background] Closing ${allTabIds.length} tabs...`);
          for (const tabId of allTabIds) {
            try {
              await chrome.tabs.remove(tabId);
            } catch (error) {
              console.warn(`[Tab Cleaner Background] Tab ${tabId} already closed:`, error.message);
            }
          }
          console.log(`[Tab Cleaner Background] ✓ All tabs closed`);
        }

        // 最后打开个人空间展示结果
        console.log(`[Tab Cleaner Background] Opening personal space...`);
        await chrome.tabs.create({
          url: chrome.runtime.getURL("personalspace.html")
        });
        console.log(`[Tab Cleaner Background] ✓ Personal space opened`);

        sendResponse({ ok: true, data: opengraphData });
      } catch (error) {
        console.error('[Tab Cleaner Background] Failed to clean all tabs:', error);
        sendResponse({ ok: false, error: error.message });
      }
    });

    return true; // 异步响应
  }
  
  // 处理其他消息类型
  return false;
});

