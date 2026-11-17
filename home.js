
"use strict";

/*
 * Mindspace Plus-Plus
 * 圖片版拖曳首頁 v2
 *
 * 只負責：
 * 1. 顯示自訂背景圖片
 * 2. 黃色、紫色 PNG 自由拖曳
 * 3. 中央插槽位置判定
 * 4. 磁吸動畫
 * 5. 切換自由創作／神祕題目
 *
 * 不修改：
 * OpenAI、GAS Bridge、拍照、去背、
 * 手動修整、p5.js 世界、語音互動
 */

(function () {
  if (window.MindspaceHome) return;

  // ================================
  // 01. 圖片路徑
  // ================================

  const ASSETS = {
    background: "./assets/home-background.png",
    free: "./assets/free-block.png",
    mystery: "./assets/mystery-block.png"
  };

  // 背景圖片原始尺寸
  const BG_WIDTH = 1670;
  const BG_HEIGHT = 941;

  // ================================
  // 02. 座標設定
  // 全部採用背景比例座標 0～1
  // ================================

  const CONFIG = {
    // 背景中央發光插槽
    slot: {
      x: 0.50,
      y: 0.395,

      // 放置成功判定範圍
      radiusX: 0.115,
      radiusY: 0.17
    },

    // 黃色積木初始位置
    free: {
      x: 0.30,
      y: 0.79
    },

    // 紫色積木初始位置
    mystery: {
      x: 0.70,
      y: 0.79
    },

    // 積木顯示寬度占背景的比例
    blockWidth: 0.255,

    // 積木可活動的高度
    blockHeight: 0.34,

    // 磁吸時間
    snapDuration: 350,

    // 切換延遲
    enterDelay: 780
  };

  let currentMode = "home";
  let dragging = null;
  let switching = false;

  let home = null;
  let stage = null;
  let slot = null;
  let flash = null;
  let mysteryPage = null;

  // ================================
  // 03. CSS
  // ================================

  function createStyles() {
    const style = document.createElement("style");

    style.id = "msImageHomeStyles";

    style.textContent = `
      #msHome {
        position: fixed;
        inset: 0;
        z-index: 200;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: #251b42;
        font-family: Arial, "Noto Sans TC", sans-serif;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }

      #msHome.ms-hidden {
        display: none;
      }

    #msStage {
  position: relative;
  width: 100vw;
  height: 100dvh;
        flex-shrink: 0;
        overflow: hidden;
        background-image:
          url("./assets/home-background.png");
        background-size: 100% 100%;
        background-position: center;
        background-repeat: no-repeat;
      }

      .ms-slot-hitbox {
        position: absolute;
        left: 50%;
        top: 39.5%;
        width: 23%;
        height: 34%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 2;
        border-radius: 20%;
      }

      .ms-slot-hitbox.ms-near {
        box-shadow:
          0 0 35px 15px rgba(255, 255, 255, .4);
      }

      .ms-image-choice {
        position: absolute;
        width: 25.5%;
        height: 34%;
        padding: 0;
        border: 0;
        margin: 0;
        background: transparent;
        cursor: grab;
        touch-action: none;
        z-index: 10;
        transform: translate(-50%, -50%);
        -webkit-tap-highlight-color: transparent;
      }

      .ms-image-choice img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        user-select: none;
        -webkit-user-drag: none;
      }

      .ms-image-choice.dragging {
        cursor: grabbing;
        z-index: 30;
        filter: drop-shadow(
          0 12px 15px rgba(0, 0, 0, .35)
        );
      }

      .ms-image-choice.snapping {
        transition:
          left 350ms cubic-bezier(.2,.8,.2,1),
          top 350ms cubic-bezier(.2,.8,.2,1),
          transform 350ms ease;
        z-index: 40;
      }

      .ms-image-choice:focus-visible {
        outline: 3px solid white;
        outline-offset: 4px;
      }

      .ms-home-instruction {
        position: absolute;
        left: 50%;
        bottom: 3%;
        transform: translateX(-50%);
        z-index: 5;
        color: #ffffff;
        background: rgba(38, 24, 69, .78);
        border: 2px solid rgba(255,255,255,.65);
        border-radius: 40px;
        padding: 10px 22px;
        font-size: clamp(12px, 1.45vw, 20px);
        font-weight: 800;
        text-align: center;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 5px 18px #0003;
      }

      .ms-home-flash {
        position: absolute;
        inset: 0;
        z-index: 80;
        background: white;
        opacity: 0;
        pointer-events: none;
      }

      .ms-home-flash.active {
        animation: msImageFlash 650ms ease forwards;
      }

      @keyframes msImageFlash {
        0% { opacity: 0; }
        45% { opacity: .9; }
        100% { opacity: 0; }
      }

      #msMysteryPlaceholder {
        position: fixed;
        inset: 0;
        z-index: 190;
        display: none;
        place-items: center;
        background:
          radial-gradient(
            circle at center,
            #fff1d5,
            #b89bdb
          );
        font-family: Arial, "Noto Sans TC", sans-serif;
      }

      #msMysteryPlaceholder.active {
        display: grid;
      }

      .ms-placeholder-card {
        max-width: 90vw;
        padding: 35px;
        text-align: center;
        border-radius: 25px;
        background: #ffffffed;
        box-shadow: 0 15px 40px #0002;
      }

      .ms-placeholder-card h1 {
        color: #593087;
      }

      .ms-placeholder-card p {
        color: #655271;
        line-height: 1.8;
      }

      .ms-back-button {
        border: none;
        border-radius: 15px;
        background: #7644bd;
        color: white;
        padding: 14px 25px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
      }

      @media (prefers-reduced-motion: reduce) {
        .ms-image-choice.snapping {
          transition-duration: 0ms;
        }

        .ms-home-flash.active {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ================================
  // 04. 建立圖片積木
  // ================================

  function createChoice(mode, imagePath, label) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "ms-image-choice";
    button.dataset.mode = mode;

    button.setAttribute(
      "aria-label",
      "拖曳進入" + label
    );

    const img = document.createElement("img");

    img.src = imagePath;
    img.alt = label;
    img.draggable = false;

    button.appendChild(img);

    button.addEventListener("pointerdown", startDrag);
    button.addEventListener("pointermove", moveDrag);
    button.addEventListener("pointerup", endDrag);
    button.addEventListener("pointercancel", cancelDrag);
    button.addEventListener("lostpointercapture", event => {
      if (
        dragging &&
        event.pointerId === dragging.pointerId &&
        !switching
      ) {
        restoreChoice();
      }
    });

    // 保留鍵盤操作
    button.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!switching) enterMode(mode);
      }
    });

    setChoicePosition(button, mode);

    return button;
  }

  function setChoicePosition(button, mode) {
    const position = CONFIG[mode];

    button.style.left = (position.x * 100) + "%";
    button.style.top = (position.y * 100) + "%";
  }

  // ================================
  // 05. 建立首頁
  // ================================

  function createHome() {
    home = document.createElement("div");
    home.id = "msHome";

    stage = document.createElement("div");
    stage.id = "msStage";

    slot = document.createElement("div");
    slot.className = "ms-slot-hitbox";
    slot.id = "msHole";

    stage.appendChild(slot);

    const free = createChoice(
      "free",
      ASSETS.free,
      "自由創作"
    );

    const mystery = createChoice(
      "mystery",
      ASSETS.mystery,
      "神秘題目"
    );

    stage.appendChild(free);
    stage.appendChild(mystery);

    const instruction = document.createElement("div");
    instruction.className = "ms-home-instruction";
    instruction.textContent =
      "拖曳喜歡的積木，放進中央發光缺口！";

    stage.appendChild(instruction);

    flash = document.createElement("div");
    flash.className = "ms-home-flash";

    stage.appendChild(flash);

    home.appendChild(stage);
    document.body.appendChild(home);
  }

  // ================================
  // 06. 神祕題目頁
  // 先保留原本的佔位頁面
  // ================================

  function createMysteryPlaceholder() {
    mysteryPage = document.createElement("div");
    mysteryPage.id = "msMysteryPlaceholder";

    mysteryPage.innerHTML = `
      <div class="ms-placeholder-card">
        <h1>🎁 神祕題目</h1>
        <p>
          已成功進入神祕題目模式！<br>
          下一階段將加入 Plus-Plus 關卡選擇頁。
        </p>
        <button
          class="ms-back-button"
          id="msBackHome"
          type="button"
        >
          返回首頁
        </button>
      </div>
    `;

    document.body.appendChild(mysteryPage);

    document
      .getElementById("msBackHome")
      .addEventListener("click", showHome);
  }

  // ================================
  // 07. 座標換算
  // ================================

  function getStageRect() {
    return stage.getBoundingClientRect();
  }

  function getSlotCenter() {
    const rect = getStageRect();

    return {
      x: rect.left + rect.width * CONFIG.slot.x,
      y: rect.top + rect.height * CONFIG.slot.y,
      radiusX: rect.width * CONFIG.slot.radiusX,
      radiusY: rect.height * CONFIG.slot.radiusY
    };
  }

  function getElementCenter(element) {
    const rect = element.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function isInsideSlot(x, y) {
    const center = getSlotCenter();

    const dx = (x - center.x) / center.radiusX;
    const dy = (y - center.y) / center.radiusY;

    return dx * dx + dy * dy <= 1;
  }

  // ================================
  // 08. 開始拖曳
  // ================================

  function startDrag(event) {
    if (switching || dragging) return;

    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    const element = event.currentTarget;
    const stageRect = getStageRect();
    const rect = element.getBoundingClientRect();

    dragging = {
      element,
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startCenterX:
        rect.left + rect.width / 2 - stageRect.left,
      startCenterY:
        rect.top + rect.height / 2 - stageRect.top
    };

    element.classList.remove("snapping");
    element.classList.add("dragging");

    element.setPointerCapture(event.pointerId);

    event.preventDefault();
  }

  // ================================
  // 09. 拖曳移動
  // ================================

  function moveDrag(event) {
    if (!dragging) return;

    if (event.pointerId !== dragging.pointerId) {
      return;
    }

    const d = dragging;

    const deltaX = event.clientX - d.startPointerX;
    const deltaY = event.clientY - d.startPointerY;

    const stageRect = getStageRect();

    const newX = d.startCenterX + deltaX;
    const newY = d.startCenterY + deltaY;

    d.element.style.left =
      (newX / stageRect.width * 100) + "%";

    d.element.style.top =
      (newY / stageRect.height * 100) + "%";

    const center = getElementCenter(d.element);

    slot.classList.toggle(
      "ms-near",
      isInsideSlot(center.x, center.y)
    );
  }

  // ================================
  // 10. 還原積木
  // ================================

  function restoreChoice() {
    if (!dragging) return;

    const element = dragging.element;
    const mode = element.dataset.mode;

    element.classList.remove(
      "dragging",
      "snapping"
    );

    element.style.transform = "";
    element.style.transition = "";

    setChoicePosition(element, mode);

    slot.classList.remove("ms-near");

    dragging = null;
  }

  function cancelDrag(event) {
    if (!dragging) return;

    if (event.pointerId !== dragging.pointerId) {
      return;
    }

    restoreChoice();
  }

  // ================================
  // 11. 放開積木
  // ================================

  function endDrag(event) {
    if (!dragging) return;

    if (event.pointerId !== dragging.pointerId) {
      return;
    }

    // 先更新最後一次指標位置
    moveDrag(event);

    const element = dragging.element;
    const mode = element.dataset.mode;

    const center = getElementCenter(element);

    if (!isInsideSlot(center.x, center.y)) {
      restoreChoice();
      return;
    }

    switching = true;

    element.classList.remove("dragging");
    element.classList.add("snapping");

    // 自動吸附到背景的中央插槽
    element.style.left =
      (CONFIG.slot.x * 100) + "%";

    element.style.top =
      (CONFIG.slot.y * 100) + "%";

    element.style.transform =
      "translate(-50%, -50%) scale(.95)";

    slot.classList.add("ms-near");

    window.setTimeout(() => {
      flash.classList.add("active");
    }, CONFIG.snapDuration);

    window.setTimeout(() => {
      restoreChoice();
      flash.classList.remove("active");
      switching = false;
      enterMode(mode);
    }, CONFIG.enterDelay);
  }

  // ================================
  // 12. 切換模式
  // ================================

  function enterMode(mode) {
    if (mode !== "free" && mode !== "mystery") {
      return;
    }

    if (dragging) restoreChoice();

    home.classList.add("ms-hidden");
    mysteryPage.classList.remove("active");

    currentMode = mode;

    if (mode === "free") {
      // 保留原本的 p5.js 創作世界
      // 不刪除角色、不清空環境
      window.dispatchEvent(new Event("resize"));
    }

    if (mode === "mystery") {
      mysteryPage.classList.add("active");
    }

    window.dispatchEvent(
      new CustomEvent("mindspace:mode-change", {
        detail: { mode: currentMode }
      })
    );
  }

  // ================================
  // 13. 返回首頁
  // ================================

  function showHome() {
    if (dragging) restoreChoice();

    switching = false;
    currentMode = "home";

    mysteryPage.classList.remove("active");
    home.classList.remove("ms-hidden");

    flash.classList.remove("active");
    slot.classList.remove("ms-near");

    document.querySelectorAll(
      ".ms-image-choice"
    ).forEach(element => {
      element.classList.remove(
        "dragging",
        "snapping"
      );

      element.style.transform = "";

      setChoicePosition(
        element,
        element.dataset.mode
      );
    });

    window.dispatchEvent(
      new CustomEvent("mindspace:mode-change", {
        detail: { mode: "home" }
      })
    );
  }

  // ================================
  // 14. 初始化
  // ================================

  function initialize() {
    if (document.getElementById("msHome")) {
      return;
    }

    createStyles();
    createHome();
    createMysteryPlaceholder();

    console.info(
      "[Mindspace Home] 圖片版首頁 v2 已載入"
    );
  }

  // 保留外部控制介面
  window.MindspaceHome = {
    show: showHome,
    enterMode,
    getMode: () => currentMode
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
