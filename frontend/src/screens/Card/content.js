(function () {
    if (window.__TAB_CLEANER_CONTENT_INSTALLED) return;
    window.__TAB_CLEANER_CONTENT_INSTALLED = true;
  
    let cardContainer = null;
    let isVisible = false;
  
    // 加载 CSS（把 url(static/img/...) 改为扩展路径）
    async function loadCss(relPath) {
      try {
        const url = chrome.runtime.getURL(relPath);
        let cssText = await (await fetch(url)).text();
        cssText = cssText.replace(
          /url\((["']?)(?:\.\.\/)*(?:\.\/)?static\/img\/([^"')]+)\1\)/g,
          (_m, _q, name) => `url("${chrome.runtime.getURL("static/img/" + name)}")`
        );
  
        return cssText;
      } catch (err) {
        console.error("Failed to load CSS:", relPath, err);
        return "";
      }
    }
  
    // ✅ 改成 async；把原来顶层的 await 放进来
    async function createCard() {
      if (cardContainer) return;
  
      cardContainer = document.createElement("div");
      cardContainer.id = "tab-cleaner-card-container";
      Object.assign(cardContainer.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: String(2147483647),
        width: "320px",
        height: "485px",
        background: "transparent", // 关键：透明背景
      });
  
      const shadow = cardContainer.attachShadow({ mode: "open" });
  
      const guideCss = await loadCss("assets/styleguide.css"); // 原来顶层 await 移到这里
      const mainCss = await loadCss("assets/style.css");
  
      const html = `
        <style>
          :host { all: initial; display:block; }
          *, *::before, *::after { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
          ${guideCss}
          ${mainCss}
  
          .card { opacity:0; transform:translateY(-8px) scale(.985);
                  transition:transform .24s cubic-bezier(.2,.8,.2,1), opacity .2s; }
          .card.visible { opacity:1; transform:translateY(0) scale(1); }
          .home-button, .clean-button, .details-button, .draggable { cursor: pointer; }
      .card .div { 
        display: block !important; 
        position: relative; 
        width: 100%; 
        height: 100%; 
      }
  
  /* 1) 关掉外层那张“透明卡”：不再让 .card 自己画底色/阴影/伪元素 */
  .card {
    background: transparent !important;
    box-shadow: none !important;
  }
  .card::before,
  .card::after { content: none !important; }
  
  /* 2) 把真正的面板放在里层：统一圆角、裁切底图 */
  :host { --tc-radius: 28px; }            /* ← 想要的圆角在这改 */
  .card, .card .div {
    border-radius: var(--tc-radius) !important;
    overflow: hidden;                     /* 裁掉底图四角 */
  }
        
          </style>
  
        <div class="card" id="tc-card">
          <div class="div">
            <img class="draggable" alt="Draggable" src="${chrome.runtime.getURL('static/img/draggable-2.svg')}" />
            <div class="window-button">
              <div class="image">
                <div class="window">
                  <div class="group"><div class="group-wrapper"><div class="group-2"></div></div></div>
                  <img class="vector" alt="Vector" src="${chrome.runtime.getURL('static/img/vector-6.svg')}" />
                  <div class="clip-path-group"></div>
                </div>
                <div class="ellipse"></div>
              </div>
            </div>
          </div>
          <div class="buttons">
            <img class="home-button" id="homeBtn" alt="Home" src="${chrome.runtime.getURL('static/img/home-button-2.png')}"/>
            <img class="clean-button" id="cleanBtn" alt="Clean" src="${chrome.runtime.getURL('static/img/clean-button.png')}"/>
            <img class="details-button" id="detailsBtn" alt="Details" src="${chrome.runtime.getURL('static/img/details-button.svg')}"/>
          </div>
        </div>
  
        <button id="tc-close"
          style="position:absolute;top:10px;right:10px;width:30px;height:30px;border:none;border-radius:50%;
                 background:rgba(255,255,255,.95);color:#333;font-size:18px;display:flex;align-items:center;
                 justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12);cursor:pointer;z-index:10;">×</button>
      `;
      shadow.innerHTML = html;
      const g = shadow.querySelector('.group');
      const g2 = shadow.querySelector('.group-2');
      const divShell = shadow.querySelector('.card > .div'); // 背景外壳
  
      if (g) g.style.backgroundImage = `url("${chrome.runtime.getURL('static/img/vector-7.svg')}")`;
      if (g2) g2.style.backgroundImage = `url("${chrome.runtime.getURL('static/img/vector-8.svg')}")`;
      if (divShell) divShell.style.backgroundImage = `url("${chrome.runtime.getURL('static/img/background-2.png')}")`;
  
  
      // —— 调试：打印最终的图片 URL（看是否真的替换成功 & 加载到位）
      const dbg = (el, name) => {
        if (!el) return console.warn(name, 'missing');
        const cs = getComputedStyle(el);
        console.log(
          `[dbg] ${name}`,
          'bg=', cs.backgroundImage,
          'size=', cs.backgroundSize,
          'pos=', cs.backgroundPosition
        );
      };
      dbg(g, 'group');
      dbg(g2, 'group-2');
      dbg(divShell, 'card>.div');
  
      // 保险：强制背景完整三件套（有的 CSS 里没写的话）
      if (g && !getComputedStyle(g).backgroundImage.includes('chrome-extension://')) {
        g.style.background = `url("${chrome.runtime.getURL('static/img/vector-7.svg')}") center / cover no-repeat`;
      }
      if (g2 && !getComputedStyle(g2).backgroundImage.includes('chrome-extension://')) {
        g2.style.background = `url("${chrome.runtime.getURL('static/img/vector-8.svg')}") center / cover no-repeat`;
      }
      if (divShell && !getComputedStyle(divShell).backgroundImage.includes('chrome-extension://')) {
        divShell.style.background = `url("${chrome.runtime.getURL('static/img/background-2.png')}") center / cover no-repeat`;
      }
  
      // <img> 资源也做个 onerror 提示
      const dragImg = shadow.querySelector('img.draggable');
      [dragImg, shadow.getElementById('homeBtn'), shadow.getElementById('cleanBtn'), shadow.getElementById('detailsBtn')]
        .filter(Boolean).forEach(img => {
          img.onerror = () => console.warn('[dbg] image failed:', img.src);
          img.onload = () => console.log('[dbg] image ok:', img.src);
        });
  
      const card = shadow.getElementById('tc-card');
      const closeBtn = shadow.getElementById('tc-close');
      const homeBtn = shadow.getElementById('homeBtn');
      const cleanBtn = shadow.getElementById('cleanBtn');
      const detailsBtn = shadow.getElementById('detailsBtn');
  
      closeBtn.addEventListener("click", hideCard);
      homeBtn.addEventListener("click", () => chrome.runtime.sendMessage({ action: "home" }));
      cleanBtn.addEventListener("click", () => chrome.runtime.sendMessage({ action: "clean" }));
      detailsBtn.addEventListener("click", () => chrome.runtime.sendMessage({ action: "details" }));
  
      document.body.appendChild(cardContainer);
      requestAnimationFrame(() => card.classList.add("visible"));
    }
  
    async function showCard() {
      if (!cardContainer) await createCard();        // ✅ 等待异步创建完成
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
  