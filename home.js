
"use strict";

/*
 * Mindspace Plus-Plus
 * home.js v4
 *
 * 保留：
 * 1. 首頁背景
 * 2. 黃色／紫色積木拖曳
 * 3. 中央插槽判定
 * 4. 磁吸與閃光動畫
 * 5. 自由創作模式
 * 6. 神秘題目背景與 10 個關卡
 * 7. 小屋返回首頁
 * 8. 星星顯示與對外 API
 * 9. 關卡主題事件
 *
 * 新增：
 * 1. 小小迷宮設計師 60 星星解鎖
 * 2. 解鎖確認視窗
 * 3. 點數不足提示
 * 4. 鎖頭震動、封印碎裂、星光特效
 * 5. localStorage 保存星星與解鎖狀態
 * 6. 防止連續點擊重複扣款
 *
 * 不修改 OpenAI / GAS / 拍照 / 去背 /
 * 手動修整 / p5.js / 語音互動。
 */

(function () {
  if (window.MindspaceHome) return;

  // ==========================================
  // 01. 圖片路徑
  // ==========================================

  const ASSETS = {
    background: "./assets/home-background.png",
    free: "./assets/free-block.png",
    mystery: "./assets/mystery-block.png",

    mysteryBackground: "./assets/mystery-background.png",

    ocean: "./assets/level-ocean.png",
    zoo: "./assets/level-zoo.png",
    food: "./assets/level-food.png",
    traffic: "./assets/level-traffic.png",
    maze: "./assets/level-maze.png",

    locked: "./assets/level-locked.png",

    starBar: "./assets/star-bar.png",
    homeButton: "./assets/home-button.png"
  };

  // ==========================================
  // 02. 設定
  // ==========================================

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
    enterDelay: 780,

    mazeUnlockCost: 60,
    initialStars: 24
  };

  const STORAGE = {
    stars: "mindspace-v4-stars",
    maze: "mindspace-v4-maze-unlocked"
  };

  // ==========================================
  // 03. 關卡資料
  // ==========================================

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
      unlockCost: CONFIG.mazeUnlockCost,
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

  // ==========================================
  // 04. 安全讀寫儲存資料
  // ==========================================

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn(
        "[Mindspace] 無法讀取儲存資料",
        error
      );
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(
        key,
        String(value)
      );
      return true;
    } catch (error) {
      console.warn(
        "[Mindspace] 無法儲存資料",
        error
      );
      return false;
    }
  }

  function readInitialStars() {
    const saved = readStorage(STORAGE.stars);

    if (saved === null) {
      return CONFIG.initialStars;
    }

    const value = Number(saved);

    if (!Number.isFinite(value)) {
      return CONFIG.initialStars;
    }

    return Math.max(0, Math.floor(value));
  }

  // ==========================================
  // 05. 全域狀態
  // ==========================================

  let currentMode = "home";
  let selectedTheme = null;

  let dragging = null;
  let switching = false;

  let home = null;
  let stage = null;
  let slot = null;
  let flash = null;

  let mysteryPage = null;
  let mysteryStage = null;

  let starNumber = null;
  let notice = null;
  let noticeTimer = null;

  let unlockModal = null;
  let unlockBalance = null;
  let unlockConfirmButton = null;

  let stars = readInitialStars();

  let mazeUnlocked =
    readStorage(STORAGE.maze) === "true";

  let unlockingMaze = false;

  const levelButtons = new Map();

  // ==========================================
  // 06. CSS
  // ==========================================

  function createStyles() {
    if (
      document.getElementById(
        "msImageHomeStyles"
      )
    ) {
      return;
    }

    const style = document.createElement("style");

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

      .ms-image-choice:focus-visible,
      .ms-level:focus-visible,
      .ms-mystery-home:focus-visible {
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
          translate(-50%, -50%) scale(1.07);

        filter:
          drop-shadow(
            0 0 15px rgba(255,235,135,.9)
          );
      }

      .ms-level.unlocked:active {
        transform:
          translate(-50%, -50%) scale(.96);
      }

      .ms-level.locked:hover {
        filter:
          drop-shadow(
            0 0 12px rgba(185,135,255,.75)
          );
      }

      /* ===== 小小迷宮設計師封印 ===== */

      .ms-maze-seal {
        position: absolute;
        inset: 5% 7% 8%;
        z-index: 2;
        pointer-events: none;

        border-radius: 25%;
        background:
          linear-gradient(
            135deg,
            rgba(83,35,170,.38),
            rgba(37,15,95,.60)
          );

        border:
          2px solid rgba(255,220,255,.65);

        box-shadow:
          inset 0 0 25px rgba(155,91,255,.4),
          0 0 15px rgba(175,113,255,.3);

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6%;
      }

      .ms-maze-lock {
        font-size: clamp(26px,4.5vw,76px);

        filter:
          drop-shadow(
            0 4px 8px rgba(0,0,0,.55)
          );
      }

      .ms-maze-cost {
        color: white;
        font-size: clamp(12px,1.55vw,27px);
        font-weight: 900;

        padding: 5px 13px;
        border-radius: 100px;

        background: rgba(35,20,53,.94);
        border: 2px solid #ffd36b;

        box-shadow:
          0 0 12px rgba(255,197,70,.5);

        white-space: nowrap;
      }

      .ms-level.ms-maze-shaking {
        animation:
          msMazeShake 450ms ease-in-out;
      }

      @keyframes msMazeShake {
        0%, 100% {
          transform: translate(-50%,-50%);
        }
        15% {
          transform:
            translate(calc(-50% - 5px),-50%)
            rotate(-2deg);
        }
        30% {
          transform:
            translate(calc(-50% + 5px),-50%)
            rotate(2deg);
        }
        45% {
          transform:
            translate(calc(-50% - 7px),-50%)
            rotate(-3deg);
        }
        65% {
          transform:
            translate(calc(-50% + 6px),-50%)
            rotate(2deg);
        }
        85% {
          transform:
            translate(calc(-50% - 2px),-50%);
        }
      }

      .ms-maze-seal.breaking {
        animation:
          msSealBreak 500ms ease-out forwards;
      }

      @keyframes msSealBreak {
        0% {
          opacity: 1;
          transform: scale(1);
          filter: brightness(1);
        }
        35% {
          opacity: 1;
          transform: scale(1.12);
          filter: brightness(2.2);
        }
        100% {
          opacity: 0;
          transform: scale(1.45);
          filter: brightness(3);
        }
      }

      /* ===== 碎片與星光 ===== */

      .ms-unlock-particle {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 260;
        pointer-events: none;
        will-change: transform, opacity;

        animation:
          msParticleFly
          var(--duration,900ms)
          cubic-bezier(.12,.65,.25,1)
          forwards;
      }

      .ms-unlock-particle.shard {
        width: var(--size,15px);
        height: var(--size,15px);

        background:
          linear-gradient(
            135deg,
            #f5d9ff,
            #b46aff 50%,
            #6b36d7
          );

        border: 1px solid #fff6ed;
        box-shadow:
          0 0 12px #dca3ff;

        clip-path:
          polygon(
            50% 0%,
            100% 28%,
            72% 100%,
            0% 72%,
            18% 22%
          );
      }

      .ms-unlock-particle.spark {
        color: #ffda45;
        font-size: var(--size,22px);
        text-shadow:
          0 0 8px #fff3a0,
          0 0 16px #ffc62c;
      }

      @keyframes msParticleFly {
        0% {
          opacity: 1;
          transform:
            translate(-50%,-50%)
            rotate(0deg)
            scale(.6);
        }
        30% {
          opacity: 1;
        }
        100% {
          opacity: 0;
          transform:
            translate(
              calc(-50% + var(--dx)),
              calc(-50% + var(--dy))
            )
            rotate(var(--rotate))
            scale(.2);
        }
      }

      .ms-unlock-burst {
        position: fixed;
        z-index: 259;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        pointer-events: none;

        background:
          radial-gradient(
            circle,
            rgba(255,255,255,1) 0%,
            rgba(255,226,101,.9) 25%,
            rgba(188,101,255,.5) 55%,
            transparent 75%
          );

        transform: translate(-50%,-50%);
        animation:
          msUnlockBurst 650ms ease-out forwards;
      }

      @keyframes msUnlockBurst {
        0% {
          opacity: 0;
          scale: .1;
        }
        25% {
          opacity: 1;
        }
        100% {
          opacity: 0;
          scale: 9;
        }
      }

      .ms-level.maze-revealed {
        animation:
          msMazeReveal 700ms ease-out;
      }

      @keyframes msMazeReveal {
        0% {
          transform:
            translate(-50%,-50%) scale(.75);
          filter: brightness(3);
        }
        55% {
          transform:
            translate(-50%,-50%) scale(1.14);
          filter:
            drop-shadow(0 0 30px gold);
        }
        100% {
          transform:
            translate(-50%,-50%) scale(1);
          filter: brightness(1);
        }
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
        transform: translate(-50%,-50%);

        color: white;
        font-weight: 900;
        font-size: clamp(14px,2.5vw,44px);

        text-shadow:
          0 3px 4px #000,
          0 0 8px #0009;

        pointer-events: none;
      }

      /* ===== 提示 ===== */

      .ms-mystery-notice {
        position: absolute;
        left: 50%;
        bottom: 4%;
        transform: translateX(-50%);
        z-index: 30;

        max-width: 85%;
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

      /* ===== 解鎖確認視窗 ===== */

      .ms-unlock-modal {
        position: fixed;
        inset: 0;
        z-index: 250;

        display: none;
        align-items: center;
        justify-content: center;

        background: rgba(21,12,45,.78);
        backdrop-filter: blur(8px);

        padding: 20px;
      }

      .ms-unlock-modal.visible {
        display: flex;
      }

      .ms-unlock-card {
        position: relative;
        width: min(90vw,440px);
        box-sizing: border-box;

        padding: 30px 25px;
        border-radius: 30px;

        background:
          linear-gradient(
            150deg,
            #fff8e9,
            #f6d8ff
          );

        border: 5px solid #ffca4b;

        box-shadow:
          0 0 35px rgba(255,196,65,.7),
          0 18px 50px #0007;

        text-align: center;
        color: #32155e;

        animation:
          msModalPop 250ms ease-out;
      }

      @keyframes msModalPop {
        from {
          opacity: 0;
          transform: scale(.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .ms-unlock-icon {
        font-size: 60px;
        margin-bottom: 8px;
      }

      .ms-unlock-title {
        font-size: clamp(22px,3vw,30px);
        font-weight: 900;
        margin-bottom: 12px;
      }

      .ms-unlock-description {
        font-size: 17px;
        font-weight: 700;
        line-height: 1.8;
      }

      .ms-unlock-price {
        display: inline-block;
        margin: 16px auto;

        padding: 8px 25px;
        border-radius: 100px;

        color: white;
        background: #42215e;

        font-size: 29px;
        font-weight: 900;

        border: 3px solid #ffd34e;
      }

      .ms-unlock-balance {
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 20px;
      }

      .ms-unlock-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .ms-unlock-actions button {
        flex: 1;
        min-height: 48px;

        border-radius: 18px;
        border: 0;

        font-size: 16px;
        font-weight: 900;

        cursor: pointer;
      }

      .ms-unlock-cancel {
        background: #ded6e7;
        color: #49325d;
      }

      .ms-unlock-confirm {
        background:
          linear-gradient(
            180deg,
            #ffe779,
            #ffb92c
          );

        color: #44260b;
        box-shadow: 0 4px 0 #c78513;
      }

      .ms-unlock-confirm:disabled {
        opacity: .5;
        cursor: not-allowed;
        box-shadow: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .ms-image-choice.snapping,
        .ms-level,
        .ms-mystery-notice {
          transition-duration: 0ms;
        }

        .ms-home-flash.active,
        .ms-level.ms-maze-shaking,
        .ms-level.maze-revealed,
        .ms-maze-seal.breaking {
          animation: none;
        }
      }

    `;

    document.head.appendChild(style);
  }

  // ==========================================
  // 07. 建立首頁積木
  // ==========================================

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

  function setChoicePosition(button, mode) {
    const position = CONFIG[mode];

    button.style.left =
      position.x * 100 + "%";

    button.style.top =
      position.y * 100 + "%";
  }

  // ==========================================
  // 08. 建立首頁
  // ==========================================

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

  // ==========================================
  // 09. 建立神秘題目頁
  // ==========================================

  function createMysteryPage() {
    mysteryPage = document.createElement("div");
    mysteryPage.id = "msMysteryPage";

    mysteryStage = document.createElement("div");
    mysteryStage.id = "msMysteryStage";

    // 小屋返回首頁

    const backButton =
      document.createElement("button");

    backButton.type = "button";
    backButton.className = "ms-mystery-home";

    backButton.setAttribute(
      "aria-label",
      "返回首頁"
    );

    const backImage = document.createElement("img");

    backImage.src = ASSETS.homeButton;
    backImage.alt = "返回首頁";

    backButton.appendChild(backImage);

    backButton.addEventListener(
      "click",
      showHome
    );

    mysteryStage.appendChild(backButton);

    // 星星點數欄

    const starBar = document.createElement("div");
    starBar.className = "ms-star-bar";

    const starImage = document.createElement("img");

    starImage.src = ASSETS.starBar;
    starImage.alt = "星星點數";

    starNumber = document.createElement("span");
    starNumber.className = "ms-star-number";

    starBar.appendChild(starImage);
    starBar.appendChild(starNumber);

    mysteryStage.appendChild(starBar);

    // 十個關卡

    LEVELS.forEach(level => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "ms-level";

      button.style.left = level.x + "%";
      button.style.top = level.y + "%";

      button.dataset.level = level.id;

      const img = document.createElement("img");

      img.src = level.image;
      img.alt = level.name;
      img.draggable = false;

      button.appendChild(img);

      if (level.id === "maze") {
        const seal = document.createElement("div");

        seal.className = "ms-maze-seal";

        const lock = document.createElement("div");

        lock.className = "ms-maze-lock";
        lock.textContent = "🔒";

        const cost = document.createElement("div");

        cost.className = "ms-maze-cost";
        cost.textContent =
          "⭐ " + CONFIG.mazeUnlockCost;

        seal.appendChild(lock);
        seal.appendChild(cost);

        button.appendChild(seal);
      }

      button.addEventListener(
        "click",
        () => selectLevel(level)
      );

      levelButtons.set(level.id, button);

      mysteryStage.appendChild(button);
    });

    // 底部提示

    notice = document.createElement("div");

    notice.className = "ms-mystery-notice";
    notice.setAttribute("role", "status");

    mysteryStage.appendChild(notice);

    mysteryPage.appendChild(mysteryStage);

    document.body.appendChild(mysteryPage);

    updateAllLevelStates();
    updateStarDisplay();
  }

  // ==========================================
  // 10. 星星系統
  // ==========================================

  function updateStarDisplay() {
    if (starNumber) {
      starNumber.textContent = String(stars);
    }

    if (unlockBalance) {
      unlockBalance.textContent =
        "目前擁有：" + stars + " 顆星星";
    }

    if (unlockConfirmButton) {
      unlockConfirmButton.disabled =
        stars < CONFIG.mazeUnlockCost ||
        unlockingMaze;
    }
  }

  function emitStarsChange() {
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
  }

  function setStars(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return stars;
    }

    // 解鎖動畫中不允許其他操作改動點數
    if (unlockingMaze) {
      return stars;
    }

    const next = Math.max(
      0,
      Math.floor(number)
    );

    if (!writeStorage(STORAGE.stars, next)) {
      showNotice("暫時無法儲存星星點數");
      return stars;
    }

    stars = next;

    updateStarDisplay();
    emitStarsChange();

    return stars;
  }

  function addStars(amount) {
    const number = Number(amount);

    if (!Number.isFinite(number)) {
      return stars;
    }

    return setStars(stars + number);
  }

  // ==========================================
  // 11. 更新關卡鎖定狀態
  // ==========================================

  function isLevelUnlocked(level) {
    if (level.id === "maze") {
      return mazeUnlocked;
    }

    return level.unlocked === true;
  }

  function updateAllLevelStates() {
    LEVELS.forEach(level => {
      const button = levelButtons.get(level.id);

      if (!button) return;

      const unlocked = isLevelUnlocked(level);

      button.classList.toggle(
        "unlocked",
        unlocked
      );

      button.classList.toggle(
        "locked",
        !unlocked
      );

      button.setAttribute(
        "aria-label",
        level.name +
          (unlocked
            ? "，進入關卡"
            : level.id === "maze"
              ? "，需要 60 顆星星解鎖"
              : "，尚未解鎖")
      );

      if (level.id === "maze") {
        const seal =
          button.querySelector(".ms-maze-seal");

        if (seal) {
          seal.style.display =
            unlocked ? "none" : "flex";
        }
      }
    });
  }

  // ==========================================
  // 12. 提示訊息
  // ==========================================

  function showNotice(message) {
    if (!notice) return;

    notice.textContent = message;
    notice.classList.add("visible");

    if (noticeTimer) {
      clearTimeout(noticeTimer);
    }

    noticeTimer = setTimeout(() => {
      notice.classList.remove("visible");
    }, 2800);
  }

  // ==========================================
  // 13. 建立解鎖確認視窗
  // ==========================================

  function createUnlockModal() {
    unlockModal = document.createElement("div");

    unlockModal.className = "ms-unlock-modal";

    unlockModal.setAttribute(
      "role",
      "dialog"
    );

    unlockModal.setAttribute(
      "aria-modal",
      "true"
    );

    unlockModal.setAttribute(
      "aria-label",
      "解鎖小小迷宮設計師"
    );

    const card = document.createElement("div");
    card.className = "ms-unlock-card";

    const icon = document.createElement("div");
    icon.className = "ms-unlock-icon";
    icon.textContent = "🔐";

    const title = document.createElement("div");
    title.className = "ms-unlock-title";
    title.textContent = "小小迷宮設計師";

    const description =
      document.createElement("div");

    description.className =
      "ms-unlock-description";

    description.textContent =
      "想要打開這個神秘關卡嗎？";

    const price = document.createElement("div");

    price.className = "ms-unlock-price";

    price.textContent =
      "⭐ " + CONFIG.mazeUnlockCost;

    unlockBalance =
      document.createElement("div");

    unlockBalance.className =
      "ms-unlock-balance";

    const actions =
      document.createElement("div");

    actions.className = "ms-unlock-actions";

    const cancel = document.createElement("button");

    cancel.type = "button";
    cancel.className = "ms-unlock-cancel";
    cancel.textContent = "再想想";

    cancel.addEventListener(
      "click",
      closeUnlockModal
    );

    unlockConfirmButton =
      document.createElement("button");

    unlockConfirmButton.type = "button";

    unlockConfirmButton.className =
      "ms-unlock-confirm";

    unlockConfirmButton.textContent =
      "解鎖！";

    unlockConfirmButton.addEventListener(
      "click",
      confirmMazeUnlock
    );

    actions.appendChild(cancel);
    actions.appendChild(unlockConfirmButton);

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(price);
    card.appendChild(unlockBalance);
    card.appendChild(actions);

    unlockModal.appendChild(card);

    unlockModal.addEventListener(
      "click",
      event => {
        if (event.target === unlockModal) {
          closeUnlockModal();
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape" &&
          unlockModal.classList.contains("visible")
        ) {
          closeUnlockModal();
        }
      }
    );

    document.body.appendChild(unlockModal);
  }

  function openUnlockModal() {
    if (mazeUnlocked || unlockingMaze) {
      return;
    }

    updateStarDisplay();

    unlockModal.classList.add("visible");

    unlockConfirmButton.focus();
  }

  function closeUnlockModal() {
    if (unlockingMaze) return;

    unlockModal.classList.remove("visible");
  }

  // ==========================================
  // 14. 確認扣點與永久解鎖
  // ==========================================

  function confirmMazeUnlock() {
    if (mazeUnlocked || unlockingMaze) {
      return;
    }

    const cost = CONFIG.mazeUnlockCost;

    if (stars < cost) {
      closeUnlockModal();

      showNotice(
        "⭐ 還差 " +
        (cost - stars) +
        " 顆星星才能解鎖！"
      );

      return;
    }

    unlockingMaze = true;
    unlockConfirmButton.disabled = true;

    const oldStars = stars;
    const nextStars = oldStars - cost;

    /*
     * 先儲存解鎖狀態，
     * 再儲存扣除後的點數。
     *
     * 若點數儲存失敗，
     * 嘗試回復原本的鎖定狀態。
     */

    const savedUnlock =
      writeStorage(STORAGE.maze, "true");

    if (!savedUnlock) {
      unlockingMaze = false;
      updateStarDisplay();

      showNotice(
        "無法儲存解鎖狀態，請稍後再試"
      );

      return;
    }

    const savedStars =
      writeStorage(STORAGE.stars, nextStars);

    if (!savedStars) {
      writeStorage(STORAGE.maze, "false");

      unlockingMaze = false;
      updateStarDisplay();

      showNotice(
        "無法儲存星星點數，請稍後再試"
      );

      return;
    }

    // 儲存成功後才更新畫面

    stars = nextStars;
    mazeUnlocked = true;

    updateStarDisplay();
    emitStarsChange();

    unlockModal.classList.remove("visible");

    window.dispatchEvent(
      new CustomEvent(
        "mindspace:level-unlocked",
        {
          detail: {
            id: "maze",
            name: "小小迷宮設計師",
            cost: cost,
            stars: stars
          }
        }
      )
    );

    // 播放碎裂特效

    playMazeUnlockAnimation();
  }

  // ==========================================
  // 15. 碎裂特效
  // ==========================================

  function playMazeUnlockAnimation() {
    const button = levelButtons.get("maze");

    if (!button) {
      unlockingMaze = false;
      updateAllLevelStates();
      return;
    }

    const seal =
      button.querySelector(".ms-maze-seal");

    const reduceMotion =
      window.matchMedia &&
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (reduceMotion) {
      updateAllLevelStates();
      unlockingMaze = false;
      showNotice("🎉 小小迷宮設計師解鎖成功！");
      return;
    }

    // 第一階段：鎖頭震動

    button.classList.add("ms-maze-shaking");

    showNotice("🔓 正在打開神秘封印……");

    setTimeout(() => {
      if (seal) {
        seal.classList.add("breaking");
      }

      createUnlockBurst(button);
      createUnlockParticles(button);

    }, 450);

    // 第二階段：封印消失，露出積木

    setTimeout(() => {
      button.classList.remove(
        "ms-maze-shaking"
      );

      updateAllLevelStates();

      button.classList.add("maze-revealed");

      showNotice(
        "🎉 解鎖成功！小小迷宮設計師開放了！"
      );

    }, 1000);

    // 第三階段：動畫結束

    setTimeout(() => {
      button.classList.remove("maze-revealed");

      if (seal) {
        seal.classList.remove("breaking");
      }

      unlockingMaze = false;

      updateStarDisplay();

    }, 1600);
  }

  // ==========================================
  // 16. 中央金色爆光
  // ==========================================

  function createUnlockBurst(button) {
    const rect = button.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const burst = document.createElement("div");

    burst.className = "ms-unlock-burst";

    burst.style.left = centerX + "px";
    burst.style.top = centerY + "px";

    document.body.appendChild(burst);

    setTimeout(() => {
      burst.remove();
    }, 750);
  }

  // ==========================================
  // 17. 積木碎片與星星
  // ==========================================

  function createUnlockParticles(button) {
    const rect = button.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const count = 38;

    for (let i = 0; i < count; i++) {
      const particle =
        document.createElement("div");

      const isStar = i % 3 === 0;

      particle.className =
        "ms-unlock-particle " +
        (isStar ? "spark" : "shard");

      if (isStar) {
        particle.textContent =
          i % 2 === 0 ? "✦" : "★";
      }

      const angle =
        (Math.PI * 2 * i / count) +
        (Math.random() - .5) * .4;

      const distance =
        60 + Math.random() * 190;

      const dx =
        Math.cos(angle) * distance;

      const dy =
        Math.sin(angle) * distance;

      const rotation =
        -360 + Math.random() * 720;

      const duration =
        650 + Math.random() * 500;

      const size =
        9 + Math.random() * 18;

      particle.style.left =
        centerX + "px";

      particle.style.top =
        centerY + "px";

      particle.style.setProperty(
        "--dx",
        dx + "px"
      );

      particle.style.setProperty(
        "--dy",
        dy + "px"
      );

      particle.style.setProperty(
        "--rotate",
        rotation + "deg"
      );

      particle.style.setProperty(
        "--duration",
        duration + "ms"
      );

      particle.style.setProperty(
        "--size",
        size + "px"
      );

      document.body.appendChild(particle);

      setTimeout(() => {
        particle.remove();
      }, duration + 100);
    }
  }

  // ==========================================
  // 18. 關卡選擇
  // ==========================================

  function selectLevel(level) {
    if (unlockingMaze) return;

    if (level.id === "maze" && !mazeUnlocked) {
      openUnlockModal();
      return;
    }

    if (!isLevelUnlocked(level)) {
      showNotice(
        "🔒 " +
        level.name +
        " 尚未解鎖！"
      );

      return;
    }

    selectedTheme = level.id;

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

    // 保留原本的進入創作世界方式
    enterMode("free", level.id);
  }

  // ==========================================
  // 19. 座標換算
  // ==========================================

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
        rect.width * CONFIG.slot.radiusX,

      radiusY:
        rect.height * CONFIG.slot.radiusY
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
      (x - center.x) / center.radiusX;

    const dy =
      (y - center.y) / center.radiusY;

    return dx * dx + dy * dy <= 1;
  }

  // ==========================================
  // 20. 開始拖曳
  // ==========================================

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

    element.setPointerCapture(event.pointerId);

    event.preventDefault();
  }

  // ==========================================
  // 21. 拖曳移動
  // ==========================================

  function moveDrag(event) {
    if (!dragging) return;

    if (
      event.pointerId !== dragging.pointerId
    ) {
      return;
    }

    const d = dragging;

    const deltaX =
      event.clientX - d.startPointerX;

    const deltaY =
      event.clientY - d.startPointerY;

    const stageRect = getStageRect();

    const newX =
      d.startCenterX + deltaX;

    const newY =
      d.startCenterY + deltaY;

    d.element.style.left =
      (newX / stageRect.width * 100) + "%";

    d.element.style.top =
      (newY / stageRect.height * 100) + "%";

    const center =
      getElementCenter(d.element);

    slot.classList.toggle(
      "ms-near",
      isInsideSlot(center.x, center.y)
    );
  }

  // ==========================================
  // 22. 還原積木
  // ==========================================

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
      event.pointerId !== dragging.pointerId
    ) {
      return;
    }

    restoreChoice();
  }

  // ==========================================
  // 23. 放開積木
  // ==========================================

  function endDrag(event) {
    if (!dragging) return;

    if (
      event.pointerId !== dragging.pointerId
    ) {
      return;
    }

    moveDrag(event);

    const element = dragging.element;
    const mode = element.dataset.mode;

    const center =
      getElementCenter(element);

    if (!isInsideSlot(center.x, center.y)) {
      restoreChoice();
      return;
    }

    switching = true;

    element.classList.remove("dragging");
    element.classList.add("snapping");

    element.style.left =
      CONFIG.slot.x * 100 + "%";

    element.style.top =
      CONFIG.slot.y * 100 + "%";

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

  // ==========================================
  // 24. 模式切換
  // ==========================================

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
      selectedTheme = theme || null;
    }

    home.classList.add("ms-hidden");

    mysteryPage.classList.remove("active");

    currentMode = mode;

    if (mode === "free") {
      // 保留既有 p5.js 世界
      // 不清空角色與環境

      window.dispatchEvent(
        new Event("resize")
      );
    }

    if (mode === "mystery") {
      updateAllLevelStates();
      updateStarDisplay();

      mysteryPage.classList.add("active");
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

  // ==========================================
  // 25. 返回首頁
  // ==========================================

  function showHome() {
    if (unlockingMaze) return;

    if (dragging) {
      restoreChoice();
    }

    closeUnlockModal();

    switching = false;
    currentMode = "home";
    selectedTheme = null;

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

  // ==========================================
  // 26. 初始化
  // ==========================================

  function initialize() {
    if (
      document.getElementById("msHome")
    ) {
      return;
    }

    createStyles();
    createHome();
    createMysteryPage();
    createUnlockModal();

    updateStarDisplay();
    updateAllLevelStates();

    console.info(
      "[Mindspace Home] v4 星星解鎖系統已載入",
      {
        stars: stars,
        mazeUnlocked: mazeUnlocked,
        mazeCost: CONFIG.mazeUnlockCost
      }
    );
  }

  // ==========================================
  // 27. 對外控制介面
  // ==========================================

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
        unlocked: isLevelUnlocked(level),
        unlockCost: level.unlockCost || null
      })),

    getStars: () => stars,

    setStars: setStars,

    addStars: addStars,

    isMazeUnlocked:
      () => mazeUnlocked
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
