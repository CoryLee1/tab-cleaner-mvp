(function () {
  if (window.__TAB_CLEANER_CONTENT_INSTALLED) return;
  window.__TAB_CLEANER_CONTENT_INSTALLED = true;

  let cardContainer = null;
  let isVisible = false;

  // 确保 asset() 可用（将相对路径转为扩展 URL）
  if (typeof asset !== 'function') {
    var asset = function (path) {
      return chrome.runtime.getURL(path);
    };
  }

  // 加载 CSS（把 url(static/img/...) 改为扩展路径）
  async function loadCss(relPath) {
    try {
      const url = asset(relPath);
      let cssText = await (await fetch(url)).text();
      cssText = cssText.replace(
        /url\((["']?)(?:\.\.\/)*(?:\.\/)?static\/img\/([^"')]+)\1\)/g,
        (_m, _q, name) => `url("${asset("static/img/" + name)}")`
      );
      return cssText;
    } catch (err) {
      console.error("Failed to load CSS:", relPath, err);
      return "";
    }
  }

  async function loadCardHTMLFromTemplate() {
    try {
      const url = asset("assets/card.html");
      let html = await (await fetch(url)).text();
      const map = {
        DRAGGABLE: asset('static/img/draggable-2.svg'),
        VECTOR6: asset('static/img/vector-6.svg'),
        WINDOW: asset('static/img/window.png'),
        HOME: asset('static/img/home-button-2.png'),
        CLEAN: asset('static/img/clean-button.png'),
        DETAILS: asset('static/img/details-button.svg'),
      };
      html = html.replace(/\{\{(DRAGGABLE|VECTOR6|WINDOW|HOME|CLEAN|DETAILS)\}\}/g, (_m, k) => map[k] || "");
      return html;
    } catch (e) {
      console.error("Failed to load card.html template:", e);
      return "";
    }
  }

  function buildInlineOverrides(guideCss, mainCss, backgroundUrl) {
    return `
      <style>
        :host { all: initial; display:block; --tc-radius: 28px; background: transparent !important; }
        *, *::before, *::after { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        ${guideCss}
        ${mainCss}
        /* 恢复背景图片 */
        .card .div { 
          display: block !important; 
          position: relative !important; 
          width: 100% !important; 
          height: 100% !important;
          background-image: url("${backgroundUrl}") !important;
          background-size: 100% 100% !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
        }
        /* 其他层保持透明 */
        .card, .window, .image { background: transparent !important; backdrop-filter: none !important; filter: none !important; }
        .card, .card .div { border-radius: var(--tc-radius) !important; overflow: hidden; clip-path: inset(0 round var(--tc-radius)); }
        .card { box-shadow: none !important; pointer-events: auto !important; }
        .card::before, .card::after { content: none !important; box-shadow:none !important; filter:none !important; }
        .window-img { position:absolute; left:0; top:0; width:100%; height:100%; object-fit:contain; z-index:2; pointer-events:none; }
        .window-button { pointer-events: auto !important; }
        /* 确保按钮可点击，但不改变定位 */
        #tc-card, .buttons, .home-button, .clean-button, .details-button { 
          pointer-events: auto !important; 
        }
        /* 关闭按钮确保在右上角 */
        #tc-close {
          position: absolute !important;
          top: 10px !important;
          right: 10px !important;
          z-index: 10000 !important;
          pointer-events: auto !important;
        }
      </style>
    `;
  }

  async function createCard() {
    if (cardContainer) return;

    cardContainer = document.createElement("div");
    cardContainer.id = "tab-cleaner-card-container";
    
    // 计算位置：右上角，插件图标下方（通常图标在工具栏右侧，距离顶部约10px，距离右侧约20px）
    const topOffset = 60; // 插件图标下方约60px
    const rightOffset = 20; // 距离右侧20px
    
    Object.assign(cardContainer.style, {
      position: "fixed",
      top: `${topOffset}px`,
      right: `${rightOffset}px`,
      left: "auto",
      bottom: "auto",
      zIndex: String(2147483647),
      width: "320px",
      height: "485px",
      background: "transparent",
      pointerEvents: "auto", // 改为 auto，确保可交互
      boxShadow: "none",
      filter: "none",
      backdropFilter: "none",
    });

    const shadow = cardContainer.attachShadow({ mode: "open" });

    const guideCss = await loadCss("assets/styleguide.css");
    const mainCss = await loadCss("assets/style.css");
    const backgroundUrl = asset('static/img/background-2.png');

    const tpl = await loadCardHTMLFromTemplate();
    shadow.innerHTML = `${buildInlineOverrides(guideCss, mainCss, backgroundUrl)}${tpl}`;

    const card = shadow.getElementById('tc-card');
    const closeBtn = shadow.getElementById('tc-close');
    const homeBtn = shadow.getElementById('homeBtn');
    const cleanBtn = shadow.getElementById('cleanBtn');
    const detailsBtn = shadow.getElementById('detailsBtn');
    const dragHandle = shadow.querySelector('.draggable') || card;

    // 确保所有交互元素可点击，但不改变其原有定位
    [card, homeBtn, cleanBtn, detailsBtn].forEach(el => {
      if (el) {
        el.style.pointerEvents = 'auto';
      }
    });
    
    // 关闭按钮确保在右上角且可点击
    if (closeBtn) {
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '10px';
      closeBtn.style.right = '10px';
      closeBtn.style.zIndex = '10000';
      closeBtn.style.pointerEvents = 'auto';
    }

    // 确保拖动函数存在
    if (typeof enableDrag !== 'function') {
      var enableDrag = function (handle, container) {
        if (!handle || !container) return;
        let startX = 0, startY = 0, origLeft = 0, origTop = 0, dragging = false;
        const parsePx = (v, fallback) => {
          const n = parseFloat(v);
          return Number.isFinite(n) ? n : fallback;
        };
        const onDown = (e) => {
          const pt = e.touches ? e.touches[0] : e;
          dragging = true;
          document.body.style.userSelect = 'none';
          container.style.right = 'auto';
          container.style.bottom = 'auto';
          origLeft = parsePx(container.style.left, container.getBoundingClientRect().left + window.scrollX);
          origTop  = parsePx(container.style.top,  container.getBoundingClientRect().top + window.scrollY);
          startX = pt.clientX; startY = pt.clientY;
          e.preventDefault(); e.stopPropagation();
          window.addEventListener('mousemove', onMove, { passive:false });
          window.addEventListener('touchmove', onMove, { passive:false });
          window.addEventListener('mouseup', onUp, { passive:true });
          window.addEventListener('touchend', onUp, { passive:true });
        };
        const onMove = (e) => {
          if (!dragging) return;
          const pt = e.touches ? e.touches[0] : e;
          const dx = pt.clientX - startX; const dy = pt.clientY - startY;
          container.style.left = `${origLeft + dx}px`;
          container.style.top  = `${origTop + dy}px`;
          e.preventDefault();
        };
        const onUp = () => {
          dragging = false;
          document.body.style.userSelect = '';
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('mouseup', onUp);
          window.removeEventListener('touchend', onUp);
        };
        handle.addEventListener('mousedown', onDown, { passive:false });
        handle.addEventListener('touchstart', onDown, { passive:false });
      };
    }
    enableDrag(dragHandle, cardContainer);

    closeBtn.addEventListener("click", hideCard);
    homeBtn.addEventListener("click", () => chrome.runtime.sendMessage({ action: "home" }));
    cleanBtn.addEventListener("click", () => chrome.runtime.sendMessage({ action: "clean" }));
    detailsBtn.addEventListener("click", () => chrome.runtime.sendMessage({ action: "details" }));

    document.body.appendChild(cardContainer);
    requestAnimationFrame(() => card.classList.add("visible"));
  }

  async function showCard() {
    if (!cardContainer) await createCard();
    cardContainer.style.display = "block";
    const card = cardContainer.shadowRoot.getElementById("tc-card");
    card && card.classList.add("visible");
    isVisible = true;
  }

  function hideCard() {
    if (!cardContainer) return;
    const card = cardContainer.shadowRoot.getElementById("tc-card");
    card && card.classList.remove("visible");
    setTimeout(() => { if (cardContainer) cardContainer.style.display = "none"; }, 240);
    isVisible = false;
  }

  function toggleCard() { isVisible ? hideCard() : showCard(); }

  chrome.runtime.onMessage.addListener((req, _s, send) => {
    if (!req || !req.action) return false;
    if (req.action === "toggle" || req.action === "toggleCard") { toggleCard(); send?.({ ok: true }); return true; }
    if (req.action === "show") { showCard(); send?.({ ok: true }); return true; }
    if (req.action === "hide") { hideCard(); send?.({ ok: true }); return true; }
    return false;
  });

  console.log("Tab Cleaner content (classic) loaded.");
})();
