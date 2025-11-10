// assets/background.js

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
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              if (window.__TAB_CLEANER_PET && typeof window.__TAB_CLEANER_PET.toggle === 'function') {
                console.log("[Tab Cleaner Pet] Toggling pet in page context");
                window.__TAB_CLEANER_PET.toggle();
              } else {
                console.log("[Tab Cleaner Pet] Module not ready, waiting for load event...");
                // 监听加载完成事件
                const handleLoaded = (e) => {
                  if (window.__TAB_CLEANER_PET && window.__TAB_CLEANER_PET.toggle) {
                    console.log("[Tab Cleaner Pet] Module loaded, toggling...");
                    window.__TAB_CLEANER_PET.toggle();
                  }
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
        }, 200);
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
        const validTabs = tabs.filter(tab => {
          const url = tab.url || '';
          return !url.startsWith('chrome://') && 
                 !url.startsWith('chrome-extension://') && 
                 !url.startsWith('about:') &&
                 !url.startsWith('edge://');
        });

        console.log(`[Tab Cleaner Background] Found ${validTabs.length} valid tabs`);

        // 先截图文档类标签页（只对实际存在的标签页）
        // 注意：如果标签页不存在，前端无法截图，需要等待后端截图
        console.log(`[Tab Cleaner Background] Capturing screenshots for doc-like tabs...`);
        const screenshotResults = await captureDocTabScreenshots(validTabs);
        console.log(`[Tab Cleaner Background] Captured ${screenshotResults.length} screenshots`);
        
        // 前端截图完成后，只关闭成功截图的标签页
        // 如果前端截图失败（标签页不存在），等待后端截图完成后再关闭
        const successfullyScreenshotTabIds = screenshotResults
          .filter(result => result.screenshot && result.tabId)
          .map(result => result.tabId);
        
        if (successfullyScreenshotTabIds.length > 0) {
          console.log(`[Tab Cleaner Background] Closing ${successfullyScreenshotTabIds.length} doc-like tabs after frontend screenshots...`);
          for (const tabId of successfullyScreenshotTabIds) {
            try {
              await chrome.tabs.remove(tabId);
            } catch (error) {
              console.warn(`[Tab Cleaner Background] Tab ${tabId} already closed or invalid:`, error.message);
            }
          }
        }
        
        // 记录哪些文档类标签页前端截图失败（需要等待后端截图）
        const failedScreenshotUrls = screenshotResults
          .filter(result => !result.screenshot && isDocLikeUrl(result.url))
          .map(result => result.url);
        
        if (failedScreenshotUrls.length > 0) {
          console.log(`[Tab Cleaner Background] ${failedScreenshotUrls.length} doc-like tabs failed frontend screenshot, will wait for backend screenshot:`, failedScreenshotUrls);
        }

        // 调用后端 API 抓取 OpenGraph
        // 对于文档类网页，后端会先用 OpenGraph/文档卡片兜底，然后异步尝试后端截图
        let response;
        let opengraphData;
        
        // 创建超时控制器（兼容性更好的方式）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        try {
          response = await fetch('http://localhost:8000/api/v1/tabs/opengraph', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tabs: validTabs.map(tab => ({
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
            throw new Error('无法连接到后端服务器（http://localhost:8000）。请确保：\n1. 后端服务已启动\n2. 后端服务运行在 http://localhost:8000\n3. 没有防火墙阻止连接');
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

        // 合并截图数据到 OpenGraph 数据中
        const opengraphItems = opengraphData.data || (Array.isArray(opengraphData) ? opengraphData : []);
        const mergedData = mergeScreenshotsIntoOpenGraph(opengraphItems, screenshotResults);
        console.log(`[Tab Cleaner Background] Merged ${screenshotResults.length} screenshots into OpenGraph data`);

        // 保存到 storage，供个人空间使用
        // 确保数据结构一致：{ok: true, data: [...]}
        await chrome.storage.local.set({ 
          opengraphData: {
            ok: opengraphData.ok || true,
            data: mergedData
          },
          lastCleanTime: Date.now()
        });

        // 关闭剩余的 tabs
        // 1. 文档类标签页：前端截图成功的已经关闭，前端截图失败的等待后端截图
        // 2. 其他标签页：直接关闭
        const remainingTabIds = validTabs
          .filter(tab => {
            // 排除已经关闭的文档类标签页（前端截图成功的）
            if (isDocLikeUrl(tab.url) && successfullyScreenshotTabIds.includes(tab.id)) {
              return false; // 已关闭
            }
            return true; // 需要关闭
          })
          .map(tab => tab.id)
          .filter(id => id !== undefined);
        
        if (remainingTabIds.length > 0) {
          console.log(`[Tab Cleaner Background] Closing ${remainingTabIds.length} remaining tabs...`);
          // 逐个关闭，避免一个失败导致全部失败
          for (const tabId of remainingTabIds) {
            try {
              await chrome.tabs.remove(tabId);
            } catch (error) {
              // Tab 可能已经被关闭，忽略错误
              console.warn(`[Tab Cleaner Background] Tab ${tabId} already closed or invalid:`, error.message);
            }
          }
        }
        
        // 如果前端截图失败的文档类标签页，等待后端截图完成后再关闭
        // 注意：这里不等待，因为后端截图是异步的，标签页会在后端截图完成后自动关闭
        // 或者用户可以在个人空间看到文档卡片，标签页可以稍后关闭

        // 打开个人空间
        chrome.tabs.create({
          url: chrome.runtime.getURL("personalspace.html")
        });

        sendResponse({ ok: true, data: opengraphData });
      } catch (error) {
        console.error('[Tab Cleaner Background] Failed to fetch OpenGraph:', error);
        
        // 提供更详细的错误信息
        let errorMessage = error.message || '未知错误';
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          errorMessage = '无法连接到后端服务器。请确保：\n1. 后端服务已启动（运行在 http://localhost:8000）\n2. 后端服务正常运行\n3. 没有防火墙阻止连接';
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
  
  // 处理其他消息类型
  return false;
});

