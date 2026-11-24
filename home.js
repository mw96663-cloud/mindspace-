
"use strict";

/*
 * Mindspace Plus-Plus | home.js v5
 *
 * 首頁：
 * - 圖片背景
 * - 黃色／紫色積木拖曳
 * - 中央插槽磁吸
 *
 * 神秘題目：
 * - 10 個關卡
 * - 4 個開放主題
 * - 小小迷宮設計師 60 星星解鎖
 * - 5 個問號關卡
 * - 星星點數顯示
 * - 返回首頁
 * - 解鎖碎裂特效
 * - 本機保存點數及解鎖狀態
 *
 * v5 新增：
 * - 長按星星欄 3 秒
 * - 隱藏測試重置選單
 * - 單獨重設鎖定／星星／全部
 *
 * 不修改 OpenAI、GAS、拍照、去背、
 * p5.js、語音或既有創作世界。
 */

(function () {
  if (window.MindspaceHome) return;

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

  const CONFIG = {
    slot: {
      x: 0.50,
      y: 0.395,
      radiusX: 0.115,
      radiusY: 0.17
    },
    free: { x: 0.30, y: 0.79 },
    mystery: { x: 0.70, y: 0.79 },
    snapDuration: 350,
    enterDelay: 780,
    foodUnlockCost: 60,
    initialStars: 24,
    adminHoldMs: 3000
  };

 const STORAGE = {
  stars: "mindspace-v4-stars",
  food: "mindspace-v5-food-unlocked"
};

 
const LEVELS = [
  {
    id: "maze",
    name: "小小迷宮設計師",
    image: ASSETS.maze,
    unlocked: true,
    x: 14,
    y: 39
  },
  {
    id: "ocean",
    name: "海底世界",
    image: ASSETS.ocean,
    unlocked: true,
    x: 32,
    y: 39
  },
  {
    id: "zoo",
    name: "動物園",
    image: ASSETS.zoo,
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
    id: "food",
    name: "食物王國",
    image: ASSETS.food,
    unlocked: false,
    unlockCost: 60,
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


  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn("[Mindspace] 讀取失敗", error);
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (error) {
      console.warn("[Mindspace] 儲存失敗", error);
      return false;
    }
  }

  function readInitialStars() {
    const saved = readStorage(STORAGE.stars);
    if (saved === null) return CONFIG.initialStars;
    const value = Number(saved);
    return Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : CONFIG.initialStars;
  }

  let currentMode = "home";
  let selectedTheme = null;
  let dragging = null;
  let switching = false;

  let home;
  let stage;
  let slot;
  let flash;
  let mysteryPage;
  let mysteryStage;
  let starNumber;
  let notice;
  let unlockModal;
  let unlockBalance;
  let unlockConfirmButton;
  let adminModal;

  let stars = readInitialStars();
  let foodUnlocked =
    readStorage(STORAGE.food) === "true";

  let unlockingFood = false;
  let noticeTimer = null;
  let adminHoldTimer = null;
  let adminPointerId = null;
  let adminStartX = 0;
  let adminStartY = 0;

  const levelButtons = new Map();

  // =====================================
  // 01. 樣式
  // =====================================

  function createStyles() {
    if (document.getElementById("msImageHomeStyles")) {
      return;
    }

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

      #msHome.ms-hidden { display: none; }

      #msStage {
        position: relative;
        width: 100vw;
        height: 100dvh;
        overflow: hidden;
        flex-shrink: 0;
        background-image: url("./assets/home-background.png");
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
        box-shadow: 0 0 35px 15px rgba(255,255,255,.4);
      }

      .ms-image-choice {
        position: absolute;
        width: 25.5%;
        height: 34%;
        padding: 0;
        margin: 0;
        border: 0;
        background: transparent;
        cursor: grab;
        touch-action: none;
        z-index: 10;
        transform: translate(-50%, -50%);
        -webkit-tap-highlight-color: transparent;
      }

      .ms-image-choice img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        pointer-events: none;
        -webkit-user-drag: none;
      }

      .ms-image-choice.dragging {
        cursor: grabbing;
        z-index: 30;
        filter: drop-shadow(0 12px 15px rgba(0,0,0,.35));
      }

      .ms-image-choice.snapping {
        transition:
          left 350ms cubic-bezier(.2,.8,.2,1),
          top 350ms cubic-bezier(.2,.8,.2,1),
          transform 350ms ease;
        z-index: 40;
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
        animation: msImageFlash 650ms ease forwards;
      }

      @keyframes msImageFlash {
        0% { opacity: 0; }
        45% { opacity: .9; }
        100% { opacity: 0; }
      }

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

      #msMysteryPage.active { display: block; }

      #msMysteryStage {
        position: absolute;
        inset: 0;
        overflow: hidden;
        background-image: url("./assets/mystery-background.png");
        background-size: 100% 100%;
        background-position: center;
        background-repeat: no-repeat;
      }

      .ms-level {
        position: absolute;
        width: 18%;
        height: 31%;
        padding: 0;
        margin: 0;
        border: 0;
        background: transparent;
        transform: translate(-50%, -50%);
        cursor: pointer;
        touch-action: manipulation;
        transition: transform 180ms ease, filter 180ms ease;
      }

      .ms-level img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        pointer-events: none;
      }

      .ms-level.unlocked:hover {
        transform: translate(-50%, -50%) scale(1.07);
        filter: drop-shadow(0 0 15px rgba(255,235,135,.9));
      }

      .ms-level.unlocked:active {
        transform: translate(-50%, -50%) scale(.96);
      }

      .ms-level.locked:hover {
        filter: drop-shadow(0 0 12px rgba(185,135,255,.75));
      }

      .ms-image-choice:focus-visible,
      .ms-level:focus-visible,
      .ms-mystery-home:focus-visible {
        outline: 3px solid white;
        outline-offset: 4px;
      }

      .ms-maze-seal {
        position: absolute;
        inset: 5% 7% 8%;
        z-index: 2;
        pointer-events: none;
        border-radius: 25%;
        background: linear-gradient(
          135deg,
          rgba(83,35,170,.38),
          rgba(37,15,95,.60)
        );
        border: 2px solid rgba(255,220,255,.65);
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
        filter: drop-shadow(0 4px 8px rgba(0,0,0,.55));
      }

      .ms-maze-cost {
        color: white;
        font-size: clamp(12px,1.55vw,27px);
        font-weight: 900;
        padding: 5px 13px;
        border-radius: 100px;
        background: rgba(35,20,53,.94);
        border: 2px solid #ffd36b;
        box-shadow: 0 0 12px rgba(255,197,70,.5);
        white-space: nowrap;
      }

      .ms-level.ms-maze-shaking {
        animation: msMazeShake 450ms ease-in-out;
      }

      @keyframes msMazeShake {
        0%,100% { transform: translate(-50%,-50%); }
        15% {
          transform: translate(calc(-50% - 5px),-50%)
          rotate(-2deg);
        }
        30% {
          transform: translate(calc(-50% + 5px),-50%)
          rotate(2deg);
        }
        45% {
          transform: translate(calc(-50% - 7px),-50%)
          rotate(-3deg);
        }
        65% {
          transform: translate(calc(-50% + 6px),-50%)
          rotate(2deg);
        }
      }

      .ms-maze-seal.breaking {
        animation: msSealBreak 500ms ease-out forwards;
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
        background: linear-gradient(
          135deg,#f5d9ff,#b46aff 50%,#6b36d7
        );
        border: 1px solid #fff6ed;
        box-shadow: 0 0 12px #dca3ff;
        clip-path: polygon(
          50% 0%,100% 28%,72% 100%,0% 72%,18% 22%
        );
      }

      .ms-unlock-particle.spark {
        color: #ffda45;
        font-size: var(--size,22px);
        text-shadow: 0 0 8px #fff3a0,0 0 16px #ffc62c;
      }

      @keyframes msParticleFly {
        0% {
          opacity: 1;
          transform:
            translate(-50%,-50%) rotate(0deg) scale(.6);
        }
        30% { opacity: 1; }
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
        background: radial-gradient(
          circle,
          rgba(255,255,255,1) 0%,
          rgba(255,226,101,.9) 25%,
          rgba(188,101,255,.5) 55%,
          transparent 75%
        );
        transform: translate(-50%,-50%);
        animation: msUnlockBurst 650ms ease-out forwards;
      }

      @keyframes msUnlockBurst {
        0% { opacity: 0; scale: .1; }
        25% { opacity: 1; }
        100% { opacity: 0; scale: 9; }
      }

      .ms-level.maze-revealed {
        animation: msMazeReveal 700ms ease-out;
      }

      @keyframes msMazeReveal {
        0% {
          transform: translate(-50%,-50%) scale(.75);
          filter: brightness(3);
        }
        55% {
          transform: translate(-50%,-50%) scale(1.14);
          filter: drop-shadow(0 0 30px gold);
        }
        100% {
          transform: translate(-50%,-50%) scale(1);
          filter: brightness(1);
        }
      }

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
        filter: drop-shadow(0 0 12px rgba(255,255,255,.9));
      }

      .ms-star-bar {
        position: absolute;
        top: 3%;
        right: 2%;
        width: 17%;
        height: 12%;
        z-index: 10;
        touch-action: none;
        cursor: default;
        -webkit-user-select: none;
        user-select: none;
      }

      .ms-star-bar img {
        width: 100%;
        height: 100%;
        object-fit: fill;
        display: block;
        pointer-events: none;
        -webkit-user-drag: none;
      }

      .ms-star-number {
        position: absolute;
        left: 64%;
        top: 50%;
        transform: translate(-50%,-50%);
        color: white;
        font-weight: 900;
        font-size: clamp(14px,2.5vw,44px);
        text-shadow: 0 3px 4px #000,0 0 8px #0009;
        pointer-events: none;
      }

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

      .ms-mystery-notice.visible { opacity: 1; }

      /* 解鎖視窗與測試選單共用樣式 */

      .ms-unlock-modal,
      .ms-admin-modal {
        position: fixed;
        inset: 0;
        z-index: 250;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(21,12,45,.78);
        backdrop-filter: blur(8px);
        padding: 20px;
        font-family: Arial,"Noto Sans TC",sans-serif;
      }

      .ms-unlock-modal.visible,
      .ms-admin-modal.visible {
        display: flex;
      }

      .ms-unlock-card,
      .ms-admin-card {
        position: relative;
        width: min(90vw,440px);
        box-sizing: border-box;
        padding: 30px 25px;
        border-radius: 30px;
        background: linear-gradient(150deg,#fff8e9,#f6d8ff);
        border: 5px solid #ffca4b;
        box-shadow:
          0 0 35px rgba(255,196,65,.7),
          0 18px 50px #0007;
        text-align: center;
        color: #32155e;
        animation: msModalPop 250ms ease-out;
      }

      @keyframes msModalPop {
        from { opacity: 0; transform: scale(.8); }
        to { opacity: 1; transform: scale(1); }
      }

      .ms-unlock-icon {
        font-size: 60px;
        margin-bottom: 8px;
      }

      .ms-unlock-title,
      .ms-admin-title {
        font-size: clamp(22px,3vw,30px);
        font-weight: 900;
        margin-bottom: 12px;
      }

      .ms-unlock-description,
      .ms-admin-description {
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

      .ms-unlock-actions button,
      .ms-admin-card button {
        min-height: 48px;
        border-radius: 18px;
        border: 0;
        font-size: 16px;
        font-weight: 900;
        cursor: pointer;
      }

      .ms-unlock-actions button { flex: 1; }

      .ms-unlock-cancel {
        background: #ded6e7;
        color: #49325d;
      }

      .ms-unlock-confirm {
        background: linear-gradient(180deg,#ffe779,#ffb92c);
        color: #44260b;
        box-shadow: 0 4px 0 #c78513;
      }

      .ms-unlock-confirm:disabled {
        opacity: .5;
        cursor: not-allowed;
        box-shadow: none;
      }

      /* v5：隱藏測試選單 */

      .ms-admin-modal { z-index: 280; }

      .ms-admin-card {
        border-color: #b68cff;
        background: linear-gradient(150deg,#fff8e9,#e9dcff);
      }

      .ms-admin-description {
        margin-bottom: 20px;
        font-size: 15px;
      }

      .ms-admin-actions {
        display: flex;
        flex-direction: column;
        gap: 11px;
      }

      .ms-admin-actions button {
        width: 100%;
        padding: 10px 15px;
        background: #ffffff;
        color: #45266c;
        border: 2px solid #c9a6f2;
        box-shadow: 0 3px 0 #ad8ad5;
      }

      .ms-admin-actions button:active {
        transform: translateY(2px);
        box-shadow: 0 1px 0 #ad8ad5;
      }

      .ms-admin-actions .ms-admin-reset-all {
        background: #ffe5a8;
        border-color: #e4ad4e;
        color: #603900;
      }

      .ms-admin-actions .ms-admin-close {
        background: #ded6e7;
        border-color: transparent;
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

  // =====================================
  // 02. 首頁
  // =====================================

  function setChoicePosition(button, mode) {
    const position = CONFIG[mode];
    button.style.left = position.x * 100 + "%";
    button.style.top = position.y * 100 + "%";
  }

  function createChoice(mode, imagePath, label) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "ms-image-choice";
    button.dataset.mode = mode;
    button.setAttribute("aria-label", "拖曳進入" + label);

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

    button.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!switching) enterMode(mode);
      }
    });

    setChoicePosition(button, mode);
    return button;
  }

  function createHome() {
    home = document.createElement("div");
    home.id = "msHome";

    stage = document.createElement("div");
    stage.id = "msStage";

    slot = document.createElement("div");
    slot.id = "msHole";
    slot.className = "ms-slot-hitbox";

    stage.appendChild(slot);

    stage.appendChild(
      createChoice("free", ASSETS.free, "自由創作")
    );

    stage.appendChild(
      createChoice("mystery", ASSETS.mystery, "神秘題目")
    );

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

  // =====================================
  // 03. 神秘題目選單
  // =====================================

  function createMysteryPage() {
    mysteryPage = document.createElement("div");
    mysteryPage.id = "msMysteryPage";

    mysteryStage = document.createElement("div");
    mysteryStage.id = "msMysteryStage";

    // 小屋

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "ms-mystery-home";
    backButton.setAttribute("aria-label", "返回首頁");

    const backImage = document.createElement("img");
    backImage.src = ASSETS.homeButton;
    backImage.alt = "返回首頁";

    backButton.appendChild(backImage);
    backButton.addEventListener("click", showHome);

    mysteryStage.appendChild(backButton);

    // 星星點數欄：長按 3 秒開啟測試選單

    const starBar = document.createElement("div");
    starBar.className = "ms-star-bar";
    starBar.title = "星星點數";

    const starImage = document.createElement("img");
    starImage.src = ASSETS.starBar;
    starImage.alt = "星星點數";

    starNumber = document.createElement("span");
    starNumber.className = "ms-star-number";

    starBar.appendChild(starImage);
    starBar.appendChild(starNumber);

    setupAdminLongPress(starBar);

    mysteryStage.appendChild(starBar);

    // 關卡

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

      if (level.id === "food") {
        const seal = document.createElement("div");
        seal.className = "ms-maze-seal";

        const lock = document.createElement("div");
        lock.className = "ms-maze-lock";
        lock.textContent = "🔒";

        const cost = document.createElement("div");
        cost.className = "ms-maze-cost";
        cost.textContent = "⭐ " + CONFIG.foodUnlockCost;

        seal.appendChild(lock);
        seal.appendChild(cost);
        button.appendChild(seal);
      }

      button.addEventListener("click", () => {
        selectLevel(level);
      });

      levelButtons.set(level.id, button);
      mysteryStage.appendChild(button);
    });

    notice = document.createElement("div");
    notice.className = "ms-mystery-notice";
    notice.setAttribute("role", "status");

    mysteryStage.appendChild(notice);
    mysteryPage.appendChild(mysteryStage);
    document.body.appendChild(mysteryPage);

    updateAllLevelStates();
    updateStarDisplay();
  }

  // =====================================
  // 04. 星星點數
  // =====================================

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
        stars < CONFIG.foodUnlockCost ||
        unlockingFood;
    }
  }

  function emitStarsChange() {
    window.dispatchEvent(
      new CustomEvent("mindspace:stars-change", {
        detail: { stars }
      })
    );
  }

  function setStars(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || unlockingFood) {
      return stars;
    }

    const next = Math.max(0, Math.floor(number));

    if (!writeStorage(STORAGE.stars, next)) {
      showNotice("無法儲存星星點數");
      return stars;
    }

    stars = next;
    updateStarDisplay();
    emitStarsChange();

    return stars;
  }

  function addStars(amount) {
    const number = Number(amount);
    if (!Number.isFinite(number)) return stars;
    return setStars(stars + number);
  }

  // =====================================
  // 05. 關卡狀態
  // =====================================

function isLevelUnlocked(level) {
  if (level.id === "food") {
    return foodUnlocked;
  }

  return level.unlocked === true;
}

 
function updateAllLevelStates() {
  LEVELS.forEach(level => {
    const button = levelButtons.get(level.id);
    if (!button) return;

    const unlocked = isLevelUnlocked(level);

    button.classList.toggle("unlocked", unlocked);
    button.classList.toggle("locked", !unlocked);

    button.setAttribute(
      "aria-label",
      level.name +
        (unlocked
          ? "，進入關卡"
          : level.id === "food"
            ? "，需要 60 顆星星解鎖"
            : "，尚未解鎖")
    );

    if (level.id === "food") {
      const seal =
        button.querySelector(".ms-maze-seal");

      if (seal) {
        seal.style.display =
          unlocked ? "none" : "flex";
      }
    }
  });
}

  function showNotice(message) {
    if (!notice) return;

    notice.textContent = message;
    notice.classList.add("visible");

    clearTimeout(noticeTimer);

    noticeTimer = setTimeout(() => {
      notice.classList.remove("visible");
    }, 2800);
  }

  // =====================================
  // 06. 解鎖確認視窗
  // =====================================

  function createUnlockModal() {
    unlockModal = document.createElement("div");
    unlockModal.className = "ms-unlock-modal";
    unlockModal.setAttribute("role", "dialog");
    unlockModal.setAttribute("aria-modal", "true");
    unlockModal.setAttribute(
      "aria-label",
      "解鎖食物王國"
    );

    const card = document.createElement("div");
    card.className = "ms-unlock-card";

    const icon = document.createElement("div");
    icon.className = "ms-unlock-icon";
    icon.textContent = "🔐";

    const title = document.createElement("div");
    title.className = "ms-unlock-title";
    title.textContent = "食物王國";

    const description = document.createElement("div");
    description.className = "ms-unlock-description";
    description.textContent =
      "想要打開這個神秘關卡嗎？";

    const price = document.createElement("div");
    price.className = "ms-unlock-price";
    price.textContent = "⭐ " + CONFIG.foodUnlockCost;

    unlockBalance = document.createElement("div");
    unlockBalance.className = "ms-unlock-balance";

    const actions = document.createElement("div");
    actions.className = "ms-unlock-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "ms-unlock-cancel";
    cancel.textContent = "再想想";
    cancel.addEventListener("click", closeUnlockModal);

    unlockConfirmButton =
      document.createElement("button");

    unlockConfirmButton.type = "button";
    unlockConfirmButton.className = "ms-unlock-confirm";
    unlockConfirmButton.textContent = "解鎖！";

    unlockConfirmButton.addEventListener(
      "click",
      confirmFoodUnlock
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

    unlockModal.addEventListener("click", event => {
      if (event.target === unlockModal) {
        closeUnlockModal();
      }
    });

    document.body.appendChild(unlockModal);
  }

  function openUnlockModal() {
    if (foodUnlocked|| unlockingFood) return;

    updateStarDisplay();
    unlockModal.classList.add("visible");
    unlockConfirmButton.focus();
  }

  function closeUnlockModal() {
    if (unlockingFood) return;
    unlockModal.classList.remove("visible");
  }

  // =====================================
  // 07. 扣除星星並解鎖
  // =====================================

  function confirmFoodUnlock() {
    if (foodUnlocked || unlockingFood) return;

    const cost = CONFIG.foodUnlockCost;

    if (stars < cost) {
      closeUnlockModal();
      showNotice(
        "⭐ 還差 " + (cost - stars) + " 顆星星！"
      );
      return;
    }

    unlockingFood = true;
    unlockConfirmButton.disabled = true;

    const nextStars = stars - cost;

    if (!writeStorage(STORAGE.food, "true")) {
      unlockingFood = false;
      updateStarDisplay();
      showNotice("無法儲存解鎖狀態");
      return;
    }

    if (!writeStorage(STORAGE.stars, nextStars)) {
      writeStorage(STORAGE.food, "false");
      unlockingFood = false;
      updateStarDisplay();
      showNotice("無法儲存星星點數");
      return;
    }

    stars = nextStars;
    foodUnlocked = true;

    updateStarDisplay();
    emitStarsChange();

    unlockModal.classList.remove("visible");

    window.dispatchEvent(
  new CustomEvent("mindspace:level-unlocked", {
    detail: {
      id: "food",
      name: "食物王國",
      cost,
      stars
    }
  })
);

    playFoodUnlockAnimation();
  }

  // =====================================
  // 08. 碎裂特效
  // =====================================

  function playFoodUnlockAnimation() {
  const button = levelButtons.get("food");

    if (!button) {
      unlockingFood = false;
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
      unlockingFood = false;
      updateAllLevelStates();
      showNotice("🎉 食物王國解鎖成功！");
      return;
    }

    button.classList.add("ms-maze-shaking");
    showNotice("🔓 正在打開神秘封印……");

    setTimeout(() => {
      if (seal) seal.classList.add("breaking");
      createUnlockBurst(button);
      createUnlockParticles(button);
    }, 450);

    setTimeout(() => {
      button.classList.remove("ms-maze-shaking");
      updateAllLevelStates();
      button.classList.add("maze-revealed");

      showNotice(
        "🎉 解鎖成功！食物王國開放了！"
      );
    }, 1000);

    setTimeout(() => {
      button.classList.remove("maze-revealed");
      if (seal) seal.classList.remove("breaking");
      unlockingFood = false;
      updateStarDisplay();
    }, 1600);
  }

  function createUnlockBurst(button) {
    const rect = button.getBoundingClientRect();
    const burst = document.createElement("div");

    burst.className = "ms-unlock-burst";
    burst.style.left =
      rect.left + rect.width / 2 + "px";
    burst.style.top =
      rect.top + rect.height / 2 + "px";

    document.body.appendChild(burst);

    setTimeout(() => burst.remove(), 750);
  }

  function createUnlockParticles(button) {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const count = 38;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      const isStar = i % 3 === 0;

      particle.className =
        "ms-unlock-particle " +
        (isStar ? "spark" : "shard");

      if (isStar) {
        particle.textContent =
          i % 2 === 0 ? "✦" : "★";
      }

      const angle =
        Math.PI * 2 * i / count +
        (Math.random() - .5) * .4;

      const distance =
        60 + Math.random() * 190;

      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      const rotation =
        -360 + Math.random() * 720;

      const duration =
        650 + Math.random() * 500;

      const size = 9 + Math.random() * 18;

      particle.style.left = centerX + "px";
      particle.style.top = centerY + "px";

      particle.style.setProperty("--dx", dx + "px");
      particle.style.setProperty("--dy", dy + "px");

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

      setTimeout(
        () => particle.remove(),
        duration + 100
      );
    }
  }

  // =====================================
  // 09. v5：長按星星欄 3 秒
  // =====================================

  function clearAdminHold() {
    if (adminHoldTimer !== null) {
      clearTimeout(adminHoldTimer);
      adminHoldTimer = null;
    }
    adminPointerId = null;
  }

  function setupAdminLongPress(element) {
    element.addEventListener("pointerdown", event => {
      if (unlockingFood || adminPointerId !== null) {
        return;
      }

      if (
        event.pointerType === "mouse" &&
        event.button !== 0
      ) {
        return;
      }

      clearAdminHold();

      adminPointerId = event.pointerId;
      adminStartX = event.clientX;
      adminStartY = event.clientY;

      adminHoldTimer = setTimeout(() => {
        adminHoldTimer = null;
        adminPointerId = null;

        openAdminModal();
      }, CONFIG.adminHoldMs);

      event.preventDefault();
    });

    element.addEventListener("pointermove", event => {
      if (event.pointerId !== adminPointerId) return;

      const dx = event.clientX - adminStartX;
      const dy = event.clientY - adminStartY;

      // 手指滑動超過 15px，就取消長按
      if (Math.hypot(dx, dy) > 15) {
        clearAdminHold();
      }
    });

    element.addEventListener("pointerup", clearAdminHold);
    element.addEventListener("pointercancel", clearAdminHold);
    element.addEventListener("pointerleave", clearAdminHold);

    element.addEventListener("contextmenu", event => {
      event.preventDefault();
    });

    // 避免瀏覽器切換分頁後仍觸發
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearAdminHold();
    });
  }

  // =====================================
  // 10. v5：建立隱藏測試選單
  // =====================================

  function createAdminModal() {
    adminModal = document.createElement("div");
    adminModal.className = "ms-admin-modal";

    adminModal.setAttribute("role", "dialog");
    adminModal.setAttribute("aria-modal", "true");
    adminModal.setAttribute(
      "aria-label",
      "Mindspace 測試重置選單"
    );

    const card = document.createElement("div");
    card.className = "ms-admin-card";

    const title = document.createElement("div");
    title.className = "ms-admin-title";
    title.textContent = "🛠️ 測試重置選單";

    const description = document.createElement("div");
    description.className = "ms-admin-description";
    description.textContent =
      "此功能僅供開發與展示測試使用。";

    const actions = document.createElement("div");
    actions.className = "ms-admin-actions";

    function makeButton(text, className, callback) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = className;
      button.textContent = text;
      button.addEventListener("click", callback);

      actions.appendChild(button);
      return button;
    }

    makeButton(
      "🔒 重新上鎖（保留星星）",
      "ms-admin-reset-lock",
      resetFoodLock
    );

    makeButton(
      "⭐ 恢復 24 顆星星",
      "ms-admin-reset-stars",
      resetStarsOnly
    );

    makeButton(
      "🔄 全部重置",
      "ms-admin-reset-all",
      resetAllTestData
    );

    makeButton(
      "取消",
      "ms-admin-close",
      closeAdminModal
    );

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(actions);

    adminModal.appendChild(card);

    adminModal.addEventListener("click", event => {
      if (event.target === adminModal) {
        closeAdminModal();
      }
    });

    document.body.appendChild(adminModal);
  }

  function openAdminModal() {
    if (unlockingFood || currentMode !== "mystery") {
      return;
    }

    if (unlockModal.classList.contains("visible")) {
      return;
    }

    adminModal.classList.add("visible");

    const firstButton =
      adminModal.querySelector("button");

    if (firstButton) firstButton.focus();
  }

  function closeAdminModal() {
    if (!adminModal) return;
    adminModal.classList.remove("visible");
  }

  // =====================================
  // 11. v5：重新上鎖
  // =====================================

 function resetFoodLock() {
    if (unlockingFood) return;

    const success =
      writeStorage(STORAGE.food, "false");

    if (!success) {
      showNotice("無法儲存重置狀態");
      return;
    }

    foodUnlocked = false;
    updateAllLevelStates();
    closeAdminModal();

    showNotice(
      "🔒 食物王國已重新上鎖！"
    );

    window.dispatchEvent(
      new CustomEvent("mindspace:level-reset", {
        detail: {
          id: "food",
          unlocked: false
        }
      })
    );
  }

  // =====================================
  // 12. v5：重設星星
  // =====================================

  function resetStarsOnly() {
    if (unlockingFood) return;

    if (!writeStorage(
      STORAGE.stars,
      CONFIG.initialStars
    )) {
      showNotice("無法儲存重置點數");
      return;
    }

    stars = CONFIG.initialStars;
    updateStarDisplay();
    emitStarsChange();

    closeAdminModal();

    showNotice("⭐ 星星已恢復為 24 顆！");
  }

  // =====================================
  // 13. v5：全部重置
  // =====================================

  function resetAllTestData() {
    if (unlockingFood) return;

    const oldStars = stars;
    const oldfoodUnlocked = foodUnlocked;

    // 先寫入星星
    if (!writeStorage(
      STORAGE.stars,
      CONFIG.initialStars
    )) {
      showNotice("重置失敗，請稍後再試");
      return;
    }

    // 再寫入鎖定狀態
    if (!writeStorage(STORAGE.food, "false")) {
      // 嘗試還原星星
      writeStorage(STORAGE.stars, oldStars);

      stars = oldStars;
      foodUnlocked = oldfoodUnlocked;

      updateStarDisplay();
      updateAllLevelStates();

      showNotice("重置失敗，請稍後再試");
      return;
    }

    stars = CONFIG.initialStars;
    foodUnlocked = false;

    updateStarDisplay();
    updateAllLevelStates();
    emitStarsChange();

    closeAdminModal();

    showNotice(
      "🔄 已恢復 24 顆星星，食物王國重新上鎖！"
    );

    window.dispatchEvent(
      new CustomEvent("mindspace:level-reset", {
        detail: {
        id: "food",
        unlocked: false
        }
      })
    );
  }

  // =====================================
  // 14. 選擇關卡
  // =====================================

 

function selectLevel(level) {

  if (unlockingFood) return;

  // 食物王國：需要星星解鎖
  if (level.id === "food" && !foodUnlocked) {

    openUnlockModal();

    return;
  }

  // 其他尚未開放的關卡
  if (!isLevelUnlocked(level)) {

    showNotice(
      "🔒 " + level.name + " 尚未解鎖！"
    );

    return;
  }

  selectedTheme = level.id;

  // =====================================
  // 動物世界：獨立互動地圖
  // 不進入自由創作
  // =====================================

  if (level.id === "zoo") {

    if (
      window.MindspaceAnimalWorld &&
      typeof window.MindspaceAnimalWorld.open
        === "function"
    ) {

      window.MindspaceAnimalWorld.open();

    } else {

      console.error(
        "[Mindspace] 動物世界尚未載入"
      );

      showNotice(
        "動物世界載入失敗，請重新整理！"
      );
    }

    return;
  }

  // 原本的主題選擇事件
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

  // 小小迷宮設計師：維持原本獨立入口
  if (level.id === "maze") {

    window.location.href =
      "./maze-test.html";

    return;
  }

  // 其他關卡：維持原本的創作世界
  enterMode("free", level.id);
}


  // =====================================
  // 15. 首頁拖曳座標
  // =====================================

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

  function moveDrag(event) {
    if (!dragging) return;
    if (event.pointerId !== dragging.pointerId) return;

    const d = dragging;

    const deltaX = event.clientX - d.startPointerX;
    const deltaY = event.clientY - d.startPointerY;
    const stageRect = getStageRect();

    const newX = d.startCenterX + deltaX;
    const newY = d.startCenterY + deltaY;

    d.element.style.left =
      newX / stageRect.width * 100 + "%";

    d.element.style.top =
      newY / stageRect.height * 100 + "%";

    const center = getElementCenter(d.element);

    slot.classList.toggle(
      "ms-near",
      isInsideSlot(center.x, center.y)
    );
  }

  function restoreChoice() {
    if (!dragging) return;

    const element = dragging.element;
    const mode = element.dataset.mode;

    element.classList.remove("dragging", "snapping");
    element.style.transform = "";
    element.style.transition = "";

    setChoicePosition(element, mode);
    slot.classList.remove("ms-near");

    dragging = null;
  }

  function cancelDrag(event) {
    if (!dragging) return;
    if (event.pointerId !== dragging.pointerId) return;
    restoreChoice();
  }

  function endDrag(event) {
    if (!dragging) return;
    if (event.pointerId !== dragging.pointerId) return;

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

    element.style.left = CONFIG.slot.x * 100 + "%";
    element.style.top = CONFIG.slot.y * 100 + "%";
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
    if (mode !== "free" && mode !== "mystery") {
      return;
    }

    if (dragging) restoreChoice();

    closeAdminModal();

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
      window.dispatchEvent(new Event("resize"));
    }

    if (mode === "mystery") {
      updateAllLevelStates();
      updateStarDisplay();
      mysteryPage.classList.add("active");
    }

    window.dispatchEvent(
      new CustomEvent("mindspace:mode-change", {
        detail: {
          mode: currentMode,
          theme: selectedTheme
        }
      })
    );
  }

  function showHome() {
    if (unlockingFood) return;

    if (dragging) restoreChoice();

    closeUnlockModal();
    closeAdminModal();
    clearAdminHold();

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
      element.classList.remove("dragging", "snapping");
      element.style.transform = "";
      element.style.transition = "";

      setChoicePosition(
        element,
        element.dataset.mode
      );
    });

    window.dispatchEvent(
      new CustomEvent("mindspace:mode-change", {
        detail: {
          mode: "home",
          theme: null
        }
      })
    );
  }

  // =====================================
  // 17. 初始化
  // =====================================

  function initialize() {
    if (document.getElementById("msHome")) return;

    createStyles();
    createHome();
    createMysteryPage();
    createUnlockModal();
    createAdminModal();

    updateStarDisplay();
    updateAllLevelStates();

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;

      if (
        adminModal &&
        adminModal.classList.contains("visible")
      ) {
        closeAdminModal();
      } else if (
        unlockModal &&
        unlockModal.classList.contains("visible")
      ) {
        closeUnlockModal();
      }
    });

   console.info(
  "[Mindspace Home] v5 已載入",
  {
    stars,
    foodUnlocked,
    foodCost: CONFIG.foodUnlockCost,
    adminHoldMs: CONFIG.adminHoldMs
  }
);

} // 結束 initialize()

// =====================================
// 18. 對外 API
// =====================================

  // =====================================
  // 18. 對外 API
  // =====================================

  window.MindspaceHome = {
    show: showHome,
    enterMode,
    getMode: () => currentMode,
    getSelectedTheme: () => selectedTheme,

    getLevels: () => LEVELS.map(level => ({
      id: level.id,
      name: level.name,
      unlocked: isLevelUnlocked(level),
      unlockCost: level.unlockCost || null
    })),

    getStars: () => stars,
    setStars,
    addStars,

   isFoodUnlocked: () => foodUnlocked
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
