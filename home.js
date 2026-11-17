
"use strict";

/*
 * Mindspace Plus-Plus
 * 圖片拖曳首頁 v3 + 神秘題目關卡選單
 *
 * 保留：
 * - 首頁背景
 * - 黃色／紫色積木拖曳
 * - 中央插槽判定
 * - 磁吸與閃光動畫
 * - 自由創作模式
 *
 * 新增：
 * - 神秘題目圖片選單
 * - 10 個獨立關卡位置
 * - 4 個可選關卡、6 個鎖定關卡
 * - 星星數字顯示
 * - 小屋返回首頁
 * - 關卡主題事件
 *
 * 不修改：
 * OpenAI、GAS Bridge、拍照、去背、
 * 手動修整、p5.js、語音互動
 */

(function () {
  if (window.MindspaceHome) return;

  // =====================================
  // 01. 圖片路徑
  // =====================================

  const ASSETS = {
    background: "./assets/home-background.png",
    free: "./assets/free-block.png",
    mystery: "./assets/mystery-block.png",

    mysteryBackground:
      "./assets/mystery-background.png",

    ocean: "./assets/level-ocean.png",
    zoo: "./assets/level-zoo.png",
    food: "./assets/level-food.png",
    traffic: "./assets/level-traffic.png",
    maze: "./assets/level-maze.png",

    locked: "./assets/level-locked.png",

    starBar: "./assets/star-bar.png",
    homeButton: "./assets/home-button.png"
  };

  // =====================================
  // 02. 首頁設定
  // =====================================

  const CONFIG = {
    slot: {
      x: 0.50,
      y: 0.395,
      radiusX: 0.115,
      radiusY: 0.17
    },

    free: {
      x: 0.30,
      y: 0.79
    },

    mystery: {
      x: 0.70,
      y: 0.79
    },

    snapDuration: 350,
    enterDelay: 780
  };

  // =====================================
  // 03. 關卡設定
  // =====================================

  /*
   * 位置使用百分比。
   * x、y 是圖片中心位置。
   *
   * unlocked:
   * true  = 可進入
   * false = 鎖定
   */

  const LEVELS = [
    {
      id: "ocean",
      name: "海底世界",
      image: ASSETS.ocean,
      unlocked: true,
      x: 14,
      y: 39
    },
    {
      id: "zoo",
      name: "動物園",
      image: ASSETS.zoo,
      unlocked: true,
      x: 32,
      y: 39
    },
    {
      id: "food",
      name: "食物王國",
      image: ASSETS.food,
      unlocked: true,
      x: 50,
      y: 39
    },
    {
      id: "traffic",
      name: "交通工具",
      image: ASSETS.traffic,
      unlocked: true,
      x: 68,
      y: 39
    },
    {
      id: "maze",
      name: "小小迷宮設計師",
      image: ASSETS.maze,
      unlocked: false,
      x: 86,
      y: 39
    },

    {
      id: "mystery-6",
      name: "神秘關卡 6",
      image: ASSETS.locked,
      unlocked: false,
      x: 14,
      y: 70
    },
    {
      id: "mystery-7",
      name: "神秘關卡 7",
      image: ASSETS.locked,
      unlocked: false,
      x: 32,
      y: 70
    },
    {
      id: "mystery-8",
      name: "神秘關卡 8",
      image: ASSETS.locked,
      unlocked: false,
      x: 50,
      y: 70
    },
    {
      id: "mystery-9",
      name: "神秘關卡 9",
      image: ASSETS.locked,
      unlocked: false,
      x: 68,
      y: 70
    },
    {
      id: "mystery-10",
      name: "神秘關卡 10",
      image: ASSETS.locked,
      unlocked: false,
      x: 86,
      y: 70
    }
  ];

  // =====================================
  // 04. 狀態
  // =====================================

  let currentMode = "home";
  let selectedTheme = null;

  let dragging = null;
  let switching = false;

  let home = null;
  let stage = null;
  let slot = null;
  let flash = null;
  let mysteryPage = null;
  let starNumber = null;
  let notice = null;

  let stars = 24;

  // =====================================
  // 05. CSS
  // =====================================

  function createStyles() {
    if (
      document.getElementById(
        "msImageHomeStyles"
      )
    ) return;

    const style =
      document.createElement("style");

    style.id = "msImageHomeStyles";

    style.textContent = `

      /* ===== 首頁 ===== */

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
          0 0 35px 15px rgba(255,255,255,.4);
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
        filter:
          drop-shadow(
            0 12px 15px rgba(0,0,0,.35)
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

        color: white;
        background: rgba(38,24,69,.78);
        border: 2px solid rgba(255,255,255,.65);
        border-radius: 40px;

        padding: 10px 22px;
        font-size: clamp(12px,1.45vw,20px);
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
        animation:
          msImageFlash 650ms ease forwards;
      }

      @keyframes msImageFlash {
        0% { opacity: 0; }
        45% { opacity: .9; }
        100% { opacity: 0; }
      }

      /* ===== 神秘題目頁 ===== */

      #msMysteryPage {
        position: fixed;
        inset: 0;
        z-index: 190;
        display: none;
        overflow: hidden;

        background: #8b614d;
        font-family: Arial, "Noto Sans TC", sans-serif;
        user-select: none;
        -webkit-user-select: none;
      }

      #msMysteryPage.active {
        display: block;
      }

      #msMysteryStage {
        position: absolute;
        inset: 0;
        overflow: hidden;

        background-image:
          url("./assets/mystery-background.png");

        background-size: 100% 100%;
        background-position: center;
        background-repeat: no-repeat;
      }

      /* ===== 關卡積木 ===== */

      .ms-level {
        position: absolute;
        width: 18%;
        height: 31%;

        padding: 0;
        margin: 0;
        border: none;
        background: transparent;

        transform: translate(-50%, -50%);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;

        transition:
          transform 180ms ease,
          filter 180ms ease;
      }

      .ms-level img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        pointer-events: none;
      }

      .ms-level.unlocked:hover {
        transform:
          translate(-50%, -50%)
          scale(1.07);

        filter:
          drop-shadow(
            0 0 15px rgba(255,235,135,.9)
          );
      }

      .ms-level.unlocked:active {
        transform:
          translate(-50%, -50%)
          scale(.96);
      }

      .ms-level.locked {
        cursor: pointer;
      }

      .ms-level.locked:hover {
        filter:
          drop-shadow(
            0 0 12px rgba(185,135,255,.75)
          );
      }

      .ms-level:focus-visible {
        outline: 3px solid white;
        outline-offset: 5px;
        border-radius: 20px;
      }

      /* ===== 小屋按鍵 ===== */

      .ms-mystery-home {
        position: absolute;
        left: 2%;
        top: 2%;
        width: 10%;
        height: 16%;
        border: 0;
        padding: 0;
        background: transparent;
        cursor: pointer;
        z-index: 10;
      }

      .ms-mystery-home img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .ms-mystery-home:hover {
        filter:
          drop-shadow(
            0 0 12px rgba(255,255,255,.9)
          );
      }

      /* ===== 星星計分條 ===== */

      .ms-star-bar {
        position: absolute;
        top: 3%;
        right: 2%;
        width: 17%;
        height: 12%;
        z-index: 10;
      }

      .ms-star-bar img {
        width: 100%;
        height: 100%;
        object-fit: fill;
        display: block;
      }

      .ms-star-number {
        position: absolute;
        left: 64%;
        top: 50%;
        transform: translate(-50%, -50%);

        color: white;
        font-weight: 900;
        font-size: clamp(14px,2.5vw,44px);

        text-shadow:
          0 3px 4px #000,
          0 0 8px #0009;

        pointer-events: none;
      }

      /* ===== 提示訊息 ===== */

      .ms-mystery-notice {
        position: absolute;
        left: 50%;
        bottom: 4%;
        transform: translateX(-50%);
        z-index: 30;

        padding: 12px 25px;
        border-radius: 30px;
        background: rgba(43,25,65,.93);
        border: 2px solid #ffe5a5;

        color: white;
        font-size: clamp(13px,1.5vw,22px);
        font-weight: 800;
        text-align: center;

        opacity: 0;
        pointer-events: none;

        transition: opacity 200ms ease;
      }

      .ms-mystery-notice.visible {
        opacity: 1;
      }

      @media (prefers-reduced-motion: reduce) {
        .ms-image-choice.snapping,
        .ms-level,
        .ms-mystery-notice {
          transition-duration: 0ms;
        }

        .ms-home-flash.active {
          animation: none;
        }
      }

    `;

    document.head.appendChild(style);
  }

  // =====================================
  // 06. 建立首頁積木
  // =====================================

  function createChoice(
    mode,
    imagePath,
    label
  ) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "ms-image-choice";
    button.dataset.mode = mode;

    button.setAttribute(
      "aria-label",
      "拖曳進入" + label
    );

    const img =
      document.createElement("img");

    img.src = imagePath;
    img.alt = label;
    img.draggable = false;

    button.appendChild(img);

    button.addEventListener(
      "pointerdown",
      startDrag
    );

    button.addEventListener(
      "pointermove",
      moveDrag
    );

    button.addEventListener(
      "pointerup",
      endDrag
    );

    button.addEventListener(
      "pointercancel",
      cancelDrag
    );

    button.addEventListener(
      "lostpointercapture",
      event => {
        if (
          dragging &&
          event.pointerId === dragging.pointerId &&
          !switching
        ) {
          restoreChoice();
        }
      }
    );

    button.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();

          if (!switching) {
            enterMode(mode);
          }
        }
      }
    );

    setChoicePosition(button, mode);

    return button;
  }

  function setChoicePosition(
    button,
    mode
  ) {
    const position = CONFIG[mode];

    button.style.left =
      (position.x * 100) + "%";

    button.style.top =
      (position.y * 100) + "%";
  }

  // =====================================
  // 07. 建立首頁
  // =====================================

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

    const instruction =
      document.createElement("div");

    instruction.className =
      "ms-home-instruction";

    instruction.textContent =
      "拖曳喜歡的積木，放進中央發光缺口！";

    stage.appendChild(instruction);

    flash = document.createElement("div");
    flash.className = "ms-home-flash";

    stage.appendChild(flash);

    home.appendChild(stage);
    document.body.appendChild(home);
  }

  // =====================================
  // 08. 建立神秘題目選單
  // =====================================

  function createMysteryPage() {
    mysteryPage =
      document.createElement("div");

    mysteryPage.id = "msMysteryPage";

    const mysteryStage =
      document.createElement("div");

    mysteryStage.id = "msMysteryStage";

    // 返回首頁小屋

    const backButton =
      document.createElement("button");

    backButton.type = "button";
    backButton.className =
      "ms-mystery-home";

    backButton.setAttribute(
      "aria-label",
      "返回首頁"
    );

    const backImage =
      document.createElement("img");

    backImage.src = ASSETS.homeButton;
    backImage.alt = "返回首頁";

    backButton.appendChild(backImage);

    backButton.addEventListener(
      "click",
      showHome
    );

    mysteryStage.appendChild(backButton);

    // 星星計分條

    const starBar =
      document.createElement("div");

    starBar.className = "ms-star-bar";

    const starImage =
      document.createElement("img");

    starImage.src = ASSETS.starBar;
    starImage.alt = "星星點數";

    starNumber =
      document.createElement("span");

    starNumber.className =
      "ms-star-number";

    starBar.appendChild(starImage);
    starBar.appendChild(starNumber);

    mysteryStage.appendChild(starBar);

    // 十個關卡積木

    LEVELS.forEach(level => {
      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "ms-level " +
        (level.unlocked
          ? "unlocked"
          : "locked");

      button.style.left = level.x + "%";
      button.style.top = level.y + "%";

      button.dataset.level = level.id;

      button.setAttribute(
        "aria-label",
        level.name +
        (level.unlocked
          ? "，進入關卡"
          : "，尚未解鎖")
      );

      const img =
        document.createElement("img");

      img.src = level.image;
      img.alt = level.name;
      img.draggable = false;

      button.appendChild(img);

      button.addEventListener(
        "click",
        () => selectLevel(level)
      );

      mysteryStage.appendChild(button);
    });

    // 底部提示

    notice =
      document.createElement("div");

    notice.className =
      "ms-mystery-notice";

    notice.setAttribute(
      "role",
      "status"
    );

    mysteryStage.appendChild(notice);

    mysteryPage.appendChild(mysteryStage);
    document.body.appendChild(mysteryPage);

    updateStarDisplay();
  }

  // =====================================
  // 09. 星星系統
  // =====================================

  function updateStarDisplay() {
    if (starNumber) {
      starNumber.textContent =
        String(stars);
    }
  }

  function setStars(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return stars;
    }

    stars = Math.max(
      0,
      Math.floor(number)
    );

    updateStarDisplay();

    window.dispatchEvent(
      new CustomEvent(
        "mindspace:stars-change",
        {
          detail: {
            stars: stars
          }
        }
      )
    );

    return stars;
  }

  function addStars(amount) {
    const number = Number(amount);

    if (!Number.isFinite(number)) {
      return stars;
    }

    return setStars(stars + number);
  }

  // =====================================
  // 10. 關卡選擇
  // =====================================

  let noticeTimer = null;

  function showNotice(message) {
    if (!notice) return;

    notice.textContent = message;
    notice.classList.add("visible");

    if (noticeTimer) {
      clearTimeout(noticeTimer);
    }

    noticeTimer = setTimeout(() => {
      notice.classList.remove("visible");
    }, 2300);
  }

  function selectLevel(level) {
    if (!level.unlocked) {
      showNotice(
        "🔒 " +
        level.name +
        " 尚未解鎖！"
      );

      return;
    }

    selectedTheme = level.id;

    // 通知其他程式目前選擇的主題
    window.dispatchEvent(
      new CustomEvent(
        "mindspace:theme-selected",
        {
          detail: {
            id: level.id,
            name: level.name,
            theme: level.id
          }
        }
      )
    );

    console.info(
      "[Mindspace] 選擇關卡：",
      level.name
    );

    // 進入原本的創作世界
    enterMode("free", level.id);
  }

  // =====================================
  // 11. 座標換算
  // =====================================

  function getStageRect() {
    return stage.getBoundingClientRect();
  }

  function getSlotCenter() {
    const rect = getStageRect();

    return {
      x:
        rect.left +
        rect.width * CONFIG.slot.x,

      y:
        rect.top +
        rect.height * CONFIG.slot.y,

      radiusX:
        rect.width *
        CONFIG.slot.radiusX,

      radiusY:
        rect.height *
        CONFIG.slot.radiusY
    };
  }

  function getElementCenter(element) {
    const rect =
      element.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function isInsideSlot(x, y) {
    const center = getSlotCenter();

    const dx =
      (x - center.x) /
      center.radiusX;

    const dy =
      (y - center.y) /
      center.radiusY;

    return dx * dx + dy * dy <= 1;
  }

  // =====================================
  // 12. 開始拖曳
  // =====================================

  function startDrag(event) {
    if (switching || dragging) return;

    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    const element =
      event.currentTarget;

    const stageRect = getStageRect();

    const rect =
      element.getBoundingClientRect();

    dragging = {
      element: element,
      pointerId: event.pointerId,

      startPointerX: event.clientX,
      startPointerY: event.clientY,

      startCenterX:
        rect.left +
        rect.width / 2 -
        stageRect.left,

      startCenterY:
        rect.top +
        rect.height / 2 -
        stageRect.top
    };

    element.classList.remove("snapping");
    element.classList.add("dragging");

    element.setPointerCapture(
      event.pointerId
    );

    event.preventDefault();
  }

  // =====================================
  // 13. 拖曳移動
  // =====================================

  function moveDrag(event) {
    if (!dragging) return;

    if (
      event.pointerId !==
      dragging.pointerId
    ) {
      return;
    }

    const d = dragging;

    const deltaX =
      event.clientX -
      d.startPointerX;

    const deltaY =
      event.clientY -
      d.startPointerY;

    const stageRect = getStageRect();

    const newX =
      d.startCenterX + deltaX;

    const newY =
      d.startCenterY + deltaY;

    d.element.style.left =
      (
        newX /
        stageRect.width *
        100
      ) + "%";

    d.element.style.top =
      (
        newY /
        stageRect.height *
        100
      ) + "%";

    const center =
      getElementCenter(d.element);

    slot.classList.toggle(
      "ms-near",
      isInsideSlot(
        center.x,
        center.y
      )
    );
  }

  // =====================================
  // 14. 還原積木
  // =====================================

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

    if (
      event.pointerId !==
      dragging.pointerId
    ) {
      return;
    }

    restoreChoice();
  }

  // =====================================
  // 15. 放開積木
  // =====================================

  function endDrag(event) {
    if (!dragging) return;

    if (
      event.pointerId !==
      dragging.pointerId
    ) {
      return;
    }

    moveDrag(event);

    const element = dragging.element;
    const mode = element.dataset.mode;

    const center =
      getElementCenter(element);

    if (
      !isInsideSlot(
        center.x,
        center.y
      )
    ) {
      restoreChoice();
      return;
    }

    switching = true;

    element.classList.remove("dragging");
    element.classList.add("snapping");

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

  // =====================================
  // 16. 模式切換
  // =====================================

  function enterMode(mode, theme) {
    if (
      mode !== "free" &&
      mode !== "mystery"
    ) {
      return;
    }

    if (dragging) {
      restoreChoice();
    }

    if (mode === "mystery") {
      selectedTheme = null;
    }

    if (mode === "free") {
      // 直接從首頁進入自由創作時，
      // 不沿用上一個神秘關卡主題。
      selectedTheme =
        theme || null;
    }

    home.classList.add("ms-hidden");

    mysteryPage.classList.remove(
      "active"
    );

    currentMode = mode;

    if (mode === "free") {
      // 保留原本的 p5.js 世界
      // 不清空角色及環境

      window.dispatchEvent(
        new Event("resize")
      );
    }

    if (mode === "mystery") {
      mysteryPage.classList.add(
        "active"
      );
    }

    window.dispatchEvent(
      new CustomEvent(
        "mindspace:mode-change",
        {
          detail: {
            mode: currentMode,
            theme: selectedTheme
          }
        }
      )
    );
  }

  // =====================================
  // 17. 返回首頁
  // =====================================

  function showHome() {
    if (dragging) {
      restoreChoice();
    }

    switching = false;
    currentMode = "home";
    selectedTheme = null;

    mysteryPage.classList.remove(
      "active"
    );

    home.classList.remove(
      "ms-hidden"
    );

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
      element.style.transition = "";

      setChoicePosition(
        element,
        element.dataset.mode
      );
    });

    window.dispatchEvent(
      new CustomEvent(
        "mindspace:mode-change",
        {
          detail: {
            mode: "home",
            theme: null
          }
        }
      )
    );
  }

  // =====================================
  // 18. 初始化
  // =====================================

  function initialize() {
    if (
      document.getElementById("msHome")
    ) {
      return;
    }

    createStyles();
    createHome();
    createMysteryPage();

    console.info(
      "[Mindspace Home] v3 關卡選單已載入"
    );
  }

  // =====================================
  // 19. 對外控制介面
  // =====================================

  window.MindspaceHome = {
    show: showHome,

    enterMode: enterMode,

    getMode: () => currentMode,

    getSelectedTheme:
      () => selectedTheme,

    getLevels:
      () => LEVELS.map(level => ({
        id: level.id,
        name: level.name,
        unlocked: level.unlocked
      })),

    getStars: () => stars,

    setStars: setStars,

    addStars: addStars
  };

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
