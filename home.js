
"use strict";

/*
 * Mindspace Plus-Plus｜拖曳積木首頁 v1
 *
 * 不修改原本的：
 * - OpenAI / GAS Bridge
 * - 兩種去背模式
 * - 拍照與手動修整
 * - p5.js 世界與角色
 * - 語音魔法與 AI 變身
 *
 * 本階段：
 * 1. Plus-Plus 積木牆
 * 2. 中央發光缺口
 * 3. 黃色、紫色積木拖曳
 * 4. 吸附動畫
 * 5. 模式切換
 */

(function () {
  if (window.MindspaceHome) return;

  const COLORS = [
    "#ffca20", "#ffda42", "#276cdd",
    "#a251df", "#f25d73", "#40bb80",
    "#ffffff", "#f59a3e", "#f17ac5",
    "#43b8e8", "#8dd34d"
  ];

  let currentMode = "home";
  let dragging = null;
  let switching = false;

  function createStyles() {
    const style = document.createElement("style");

    style.textContent = `
      #msHome {
        position: fixed;
        inset: 0;
        z-index: 200;
        overflow: hidden;
        font-family: Arial, "Noto Sans TC", sans-serif;
        background: #f5d6c2;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }

      #msHome.ms-hidden {
        display: none;
      }

      .ms-wall {
        position: absolute;
        inset: -3%;
        display: grid;
        grid-template-columns: repeat(13, 1fr);
        grid-template-rows: repeat(9, 1fr);
        background:
          radial-gradient(
            ellipse at 50% 40%,
            #fff3d9 0%,
            #ecc4b0 55%,
            #dba9a1 100%
          );
        filter: saturate(1.12);
        overflow: hidden;
      }

      .ms-wall-piece {
        width: 112%;
        height: 112%;
        position: relative;
        clip-path: polygon(
          34% 0%, 66% 0%,
          66% 34%, 100% 34%,
          100% 66%, 66% 66%,
          66% 100%, 34% 100%,
          34% 66%, 0% 66%,
          0% 34%, 34% 34%
        );
        background:
          linear-gradient(
            145deg,
            #ffffff55 0%,
            transparent 35%,
            #00000025 100%
          ),
          var(--piece-color);
        box-shadow: inset -5px -5px 8px #0002;
        transform: rotate(var(--piece-angle));
      }

      .ms-wall::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(
            ellipse at center,
            #fff4e200 20%,
            #6e42602a 100%
          );
      }

      .ms-hole {
        position: absolute;
        width: clamp(130px, 19vw, 260px);
        aspect-ratio: 1;
        top: 35%;
        left: 50%;
        transform: translate(-50%, -50%);
        clip-path: polygon(
          34% 0%, 66% 0%,
          66% 34%, 100% 34%,
          100% 66%, 66% 66%,
          66% 100%, 34% 100%,
          34% 66%, 0% 66%,
          0% 34%, 34% 34%
        );
        background: #fff4e2;
        filter: drop-shadow(0 0 22px #ffd25d);
        z-index: 3;
      }

      .ms-hole-inner {
        position: absolute;
        inset: 6px;
        clip-path: inherit;
        background:
          radial-gradient(
            circle,
            #fffdf3 0%,
            #ffdda2 70%,
            #ffbd48 100%
          );
        animation: msGlow 2s ease-in-out infinite;
      }

      @keyframes msGlow {
        0%, 100% { opacity: .8; }
        50% { opacity: 1; }
      }

      .ms-hole.ms-near {
        filter: drop-shadow(0 0 40px #ffffff);
        transform:
          translate(-50%, -50%)
          scale(1.08);
      }

      .ms-instruction {
        position: absolute;
        z-index: 5;
        top: 56%;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        padding: 11px 22px;
        border-radius: 40px;
        background: #ffffffdf;
        color: #613b83;
        font-size: clamp(13px, 1.6vw, 20px);
        font-weight: 800;
        box-shadow: 0 6px 24px #51345b26;
      }

      .ms-choices {
        position: absolute;
        z-index: 10;
        bottom: 5%;
        left: 50%;
        transform: translateX(-50%);
        width: min(690px, 94vw);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: clamp(14px, 4vw, 65px);
      }

      .ms-choice {
        position: relative;
        width: clamp(145px, 21vw, 270px);
        aspect-ratio: 1.08;
        flex-shrink: 0;
        cursor: grab;
        touch-action: none;
        display: grid;
        place-items: center;
        border: none;
        background: transparent;
        padding: 0;
        color: #26325e;
        -webkit-tap-highlight-color: transparent;
      }

      .ms-choice:focus-visible {
        outline: 4px solid #fff;
        outline-offset: 5px;
        border-radius: 22px;
      }

      .ms-choice.dragging {
        cursor: grabbing;
        z-index: 50;
        filter: drop-shadow(0 15px 20px #0005);
      }

      .ms-choice-body {
        position: absolute;
        inset: 0;
        clip-path: polygon(
          34% 0%, 66% 0%,
          66% 20%, 100% 20%,
          100% 76%, 66% 76%,
          66% 100%, 34% 100%,
          34% 76%, 0% 76%,
          0% 20%, 34% 20%
        );
        background:
          linear-gradient(
            145deg,
            #ffffff88,
            transparent 35%,
            #00000028
          ),
          var(--choice-color);
        box-shadow: inset 0 -12px 0 #0002;
      }

      .ms-choice-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
        pointer-events: none;
        transform: translateY(-3%);
      }

      .ms-choice-icon {
        font-size: clamp(30px, 5vw, 62px);
        line-height: 1;
        filter: drop-shadow(0 3px 3px #0003);
      }

      .ms-choice-label {
        font-size: clamp(15px, 2.2vw, 28px);
        font-weight: 900;
        white-space: nowrap;
        padding: 7px 13px;
        border-radius: 16px;
        background: #fff9;
        box-shadow: 0 3px 8px #0002;
      }

      .ms-choice[data-mode="mystery"] {
        color: #382060;
      }

      .ms-choice.snapping {
        transition:
          left .28s ease,
          top .28s ease,
          transform .28s ease;
      }

      .ms-flash {
        position: absolute;
        inset: 0;
        z-index: 90;
        background: #fff;
        opacity: 0;
        pointer-events: none;
      }

      .ms-flash.active {
        animation: msFlash .65s ease forwards;
      }

      @keyframes msFlash {
        0% { opacity: 0; }
        45% { opacity: .95; }
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
            circle at 50% 30%,
            #fff3d6,
            #d9b7d7
          );
        font-family: Arial, "Noto Sans TC", sans-serif;
      }

      #msMysteryPlaceholder.active {
        display: grid;
      }

      .ms-placeholder-card {
        text-align: center;
        padding: 30px;
        max-width: 90vw;
        background: #ffffffd9;
        border-radius: 28px;
        box-shadow: 0 15px 45px #553b632c;
      }

      .ms-placeholder-card h1 {
        color: #522078;
        font-size: clamp(28px, 5vw, 48px);
      }

      .ms-placeholder-card p {
        color: #624d71;
        line-height: 1.8;
      }

      .ms-back-button {
        border: none;
        border-radius: 16px;
        padding: 14px 24px;
        background: #713cbb;
        color: #fff;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
      }

      @media (max-width: 600px) {
        .ms-hole {
          top: 32%;
        }

        .ms-instruction {
          top: 51%;
        }

        .ms-choices {
          bottom: 9%;
          gap: 12px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ms-hole-inner {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createWall(container) {
    const wall = document.createElement("div");
    wall.className = "ms-wall";
    wall.setAttribute("aria-hidden", "true");

    for (let i = 0; i < 117; i++) {
      const piece = document.createElement("div");
      piece.className = "ms-wall-piece";

      const colorIndex =
        (i * 7 + Math.floor(i / 13) * 3) %
        COLORS.length;

      piece.style.setProperty(
        "--piece-color",
        COLORS[colorIndex]
      );

      piece.style.setProperty(
        "--piece-angle",
        ((i % 3) - 1) * 90 + "deg"
      );

      wall.appendChild(piece);
    }

    container.appendChild(wall);
  }

  function createChoice(mode, color, icon, label) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "ms-choice";
    button.dataset.mode = mode;
    button.setAttribute(
      "aria-label",
      "拖曳進入" + label
    );

    button.style.setProperty(
      "--choice-color",
      color
    );

    button.innerHTML = `
      <span class="ms-choice-body"></span>
      <span class="ms-choice-content">
        <span class="ms-choice-icon">${icon}</span>
        <span class="ms-choice-label">${label}</span>
      </span>
    `;

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

    // 鍵盤使用者可以直接按 Enter 進入。
    button.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        enterMode(mode);
      }
    });

    return button;
  }

  function createHome() {
    const home = document.createElement("div");
    home.id = "msHome";

    createWall(home);

    const hole = document.createElement("div");
    hole.className = "ms-hole";
    hole.id = "msHole";
    hole.innerHTML =
      '<div class="ms-hole-inner"></div>';

    home.appendChild(hole);

    const instruction = document.createElement("div");
    instruction.className = "ms-instruction";
    instruction.textContent =
      "把喜歡的積木放進發光缺口！";

    home.appendChild(instruction);

    const choices = document.createElement("div");
    choices.className = "ms-choices";

    choices.appendChild(
      createChoice(
        "free",
        "#ffca16",
        "🧩",
        "自由創作"
      )
    );

    choices.appendChild(
      createChoice(
        "mystery",
        "#9751db",
        "🎁",
        "神祕題目"
      )
    );

    home.appendChild(choices);

    const flash = document.createElement("div");
    flash.className = "ms-flash";
    flash.id = "msFlash";
    home.appendChild(flash);

    document.body.appendChild(home);
  }

  function createMysteryPlaceholder() {
    const page = document.createElement("div");
    page.id = "msMysteryPlaceholder";

    page.innerHTML = `
      <div class="ms-placeholder-card">
        <h1>🎁 神祕題目</h1>
        <p>
          首頁拖曳成功！<br>
          下一階段將在這裡加入<br>
          你確認的十個立體 Plus-Plus 關卡。
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

    document.body.appendChild(page);

    document.getElementById(
      "msBackHome"
    ).addEventListener("click", showHome);
  }

  function getHoleCenter() {
    const rect = document.getElementById(
      "msHole"
    ).getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      radius: rect.width * 0.75
    };
  }

  function startDrag(event) {
    if (switching || dragging) return;
    if (event.button !== 0) return;

    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();

    dragging = {
      element,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originalStyle: element.getAttribute("style")
    };

    element.style.position = "fixed";
    element.style.left = rect.left + "px";
    element.style.top = rect.top + "px";
    element.style.width = rect.width + "px";
    element.style.height = rect.height + "px";
    element.style.margin = "0";
    element.classList.add("dragging");

    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!dragging) return;

    if (event.pointerId !== dragging.pointerId) {
      return;
    }

    const element = dragging.element;

    element.style.left =
      event.clientX - dragging.offsetX + "px";

    element.style.top =
      event.clientY - dragging.offsetY + "px";

    const center = getHoleCenter();

    const distance = Math.hypot(
      event.clientX - center.x,
      event.clientY - center.y
    );

    document.getElementById(
      "msHole"
    ).classList.toggle(
      "ms-near",
      distance < center.radius
    );
  }

  function restoreChoice() {
    if (!dragging) return;

    const element = dragging.element;

    if (dragging.originalStyle === null) {
      element.removeAttribute("style");
    } else {
      element.setAttribute(
        "style",
        dragging.originalStyle
      );
    }

    element.classList.remove(
      "dragging",
      "snapping"
    );

    document.getElementById(
      "msHole"
    ).classList.remove("ms-near");

    dragging = null;
  }

  function cancelDrag(event) {
    if (!dragging) return;

    if (event.pointerId !== dragging.pointerId) {
      return;
    }

    restoreChoice();
  }

  function endDrag(event) {
    if (!dragging) return;

    if (event.pointerId !== dragging.pointerId) {
      return;
    }

    const element = dragging.element;
    const mode = element.dataset.mode;
    const center = getHoleCenter();

    const distance = Math.hypot(
      event.clientX - center.x,
      event.clientY - center.y
    );

    if (distance >= center.radius) {
      restoreChoice();
      return;
    }

    switching = true;

    const rect = element.getBoundingClientRect();

    element.classList.add("snapping");

    element.style.left =
      center.x - rect.width / 2 + "px";

    element.style.top =
      center.y - rect.height / 2 + "px";

    element.style.transform = "scale(.85)";

    window.setTimeout(() => {
      document.getElementById(
        "msFlash"
      ).classList.add("active");
    }, 280);

    window.setTimeout(() => {
      restoreChoice();
      switching = false;
      enterMode(mode);
    }, 760);
  }

  function enterMode(mode) {
    const home = document.getElementById("msHome");
    const mystery = document.getElementById(
      "msMysteryPlaceholder"
    );

    home.classList.add("ms-hidden");
    mystery.classList.remove("active");

    if (mode === "free") {
      currentMode = "free";

      // 原本的 p5.js 世界一直存在，
      // 這裡只隱藏首頁，不清空任何作品。
      if (typeof window.resizeCanvas === "function") {
        window.dispatchEvent(new Event("resize"));
      }
    } else if (mode === "mystery") {
      currentMode = "mystery";
      mystery.classList.add("active");
    }

    window.dispatchEvent(
      new CustomEvent("mindspace:mode-change", {
        detail: { mode: currentMode }
      })
    );
  }

  function showHome() {
    if (dragging) restoreChoice();

    switching = false;
    currentMode = "home";

    document.getElementById(
      "msMysteryPlaceholder"
    ).classList.remove("active");

    document.getElementById(
      "msHome"
    ).classList.remove("ms-hidden");

    document.getElementById(
      "msFlash"
    ).classList.remove("active");

    window.dispatchEvent(
      new CustomEvent("mindspace:mode-change", {
        detail: { mode: "home" }
      })
    );
  }

  function initialize() {
    if (document.getElementById("msHome")) {
      return;
    }

    createStyles();
    createHome();
    createMysteryPlaceholder();

    console.info(
      "[Mindspace Home] Plus-Plus 拖曳首頁已載入"
    );
  }

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
