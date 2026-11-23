
/*
 * Mindspace｜動物世界 V1
 * 第一階段：動物園總覽、聲音區域、返回
 *
 * 獨立模組：
 * 不修改 home.js、sketch.js、迷宮或自由創作。
 *
 * 動物園聲音檔案放在：
 * assets/sounds/
 */

(() => {
  "use strict";

  if (window.MindspaceAnimalWorld) return;

  const ZONES = [
    {
      id: "forest",
      title: "森林",
      emoji: "🌳",
      color: "#d7efc8",
      sounds: [
        {
          id: "forest-01",
          label: "神秘聲音 1",
          file: "./assets/sounds/forest-01.mp3"
        }
      ]
    },
    {
      id: "grassland",
      title: "草原",
      emoji: "🌾",
      color: "#f8e8ae",
      sounds: [
        {
          id: "grassland-01",
          label: "神秘聲音 1",
          file: "./assets/sounds/grassland-01.mp3"
        }
      ]
    },
    {
      id: "pond",
      title: "池塘",
      emoji: "💧",
      color: "#c7eaf1",
      sounds: [
        {
          id: "pond-01",
          label: "神秘聲音 1",
          file: "./assets/sounds/pond-01.mp3"
        }
      ]
    },
    {
      id: "mountain",
      title: "山地",
      emoji: "⛰️",
      color: "#e4d8cb",
      sounds: [
        {
          id: "mountain-01",
          label: "神秘聲音 1",
          file: "./assets/sounds/mountain-01.mp3"
        }
      ]
    }
  ];

  let root = null;
  let currentZone = null;
  let currentSound = null;
  let audio = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function makeButton(text, handler, className = "") {
    const button = el("button", className, text);
    button.type = "button";
    button.addEventListener("click", handler);
    return button;
  }

  function stopSound() {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  function close() {
    stopSound();
    currentZone = null;
    currentSound = null;

    if (root) {
      root.hidden = true;
    }
  }

  function open() {
    if (!root) return;
    stopSound();
    currentZone = null;
    currentSound = null;
    root.hidden = false;
    showOverview();
  }

  function setContent(title, subtitle) {
    root.replaceChildren();

    const header = el("header", "aw-header");

    header.append(
      makeButton("⌂ 返回", close, "aw-back"),
      el("h1", "", title)
    );

    const description = el("p", "aw-subtitle", subtitle);

    root.append(header, description);
  }

  function showOverview() {
    stopSound();

    setContent(
      "Mindspace｜動物世界",
      "選擇一個地方，聽聽裡面藏著什麼聲音！"
    );

    const grid = el("div", "aw-grid");

    for (const zone of ZONES) {
      const card = makeButton(
        "",
        () => showZone(zone),
        "aw-zone"
      );

      card.style.background = zone.color;

      const icon = el("div", "aw-zone-icon", zone.emoji);
      const name = el("strong", "", zone.title);
      const hint = el("span", "", "點我去探索");

      card.append(icon, name, hint);
      grid.appendChild(card);
    }

    root.appendChild(grid);
  }

  function showZone(zone) {
    stopSound();
    currentZone = zone;
    currentSound = null;

    setContent(
      zone.emoji + " " + zone.title,
      "先聆聽聲音，再用 Plus-Plus 拼出你的想像！"
    );

    const area = el("div", "aw-sound-area");

    area.appendChild(
      makeButton(
        "← 選擇其他區域",
        showOverview,
        "aw-secondary"
      )
    );

    for (const sound of zone.sounds) {
      const card = el("div", "aw-sound-card");

      const label = el("h2", "", sound.label);

      const play = makeButton(
        "▶ 播放神秘聲音",
        async () => {
          currentSound = sound;
          stopSound();

          audio = new Audio(sound.file);

          try {
            await audio.play();
            status.textContent =
              "仔細聽聽看，你想到了什麼？";
          } catch (error) {
            console.error(
              "[Animal World] 聲音播放失敗",
              error
            );

            status.textContent =
              "目前無法播放聲音，請確認音檔已放入 assets/sounds/。";
          }
        },
        "aw-primary"
      );

      const replay = makeButton(
        "↻ 再聽一次",
        () => play.click(),
        "aw-secondary"
      );

      const status = el(
        "p",
        "aw-status",
        "沒有標準答案，想像什麼都可以！"
      );

      card.append(label, play, replay, status);
      area.appendChild(card);
    }

    const notice = el(
      "p",
      "aw-next",
      "聽完後就可以開始拼接積木。拍照掃描與進入共同棲地將在下一階段接入。"
    );

    area.appendChild(notice);
    root.appendChild(area);
  }

  function installStyles() {
    if (document.getElementById("aw-styles")) return;

    const style = document.createElement("style");
    style.id = "aw-styles";

    style.textContent = `
      #animalWorldRoot {
        position: fixed;
        inset: 0;
        z-index: 240;
        overflow-y: auto;
        padding: 20px;
        background:
          linear-gradient(160deg, #c5e8d3, #f8efcf);
        color: #344b41;
        font-family: Arial, "Noto Sans TC", sans-serif;
        text-align: center;
      }

      #animalWorldRoot[hidden] {
        display: none !important;
      }

      .aw-header {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        min-height: 56px;
      }

      .aw-header h1 {
        margin: 0;
        font-size: clamp(22px, 3vw, 36px);
      }

      .aw-back {
        position: absolute;
        left: 0;
        top: 0;
        background: white;
        border-radius: 16px;
        padding: 12px 18px;
        color: #344b41;
        font-weight: bold;
      }

      .aw-subtitle {
        font-size: clamp(14px, 1.8vw, 20px);
        margin: 14px auto 28px;
      }

      .aw-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
        width: min(850px, 95%);
        margin: 0 auto;
      }

      .aw-zone {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 12px;
        min-height: 220px;
        padding: 20px;
        border: 4px solid white;
        border-radius: 28px;
        color: #344b41;
        box-shadow: 0 8px 20px #294d3222;
        transition: transform .2s;
      }

      .aw-zone:hover {
        transform: scale(1.035);
      }

      .aw-zone-icon {
        font-size: clamp(52px, 7vw, 90px);
      }

      .aw-zone strong {
        font-size: 24px;
      }

      .aw-zone span {
        font-size: 14px;
      }

      .aw-sound-area {
        width: min(650px, 95%);
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }

      .aw-sound-card {
        width: 100%;
        padding: 30px;
        background: #ffffffdd;
        border-radius: 28px;
        box-shadow: 0 8px 20px #294d3222;
      }

      .aw-sound-card h2 {
        margin: 0 0 24px;
      }

      .aw-primary,
      .aw-secondary {
        display: block;
        width: min(100%, 350px);
        margin: 12px auto;
        padding: 15px;
        border-radius: 18px;
        font-weight: bold;
        font-size: 17px;
      }

      .aw-primary {
        background: #ffcf5d;
        color: #344b41;
      }

      .aw-secondary {
        background: #e6eee8;
        color: #344b41;
      }

      .aw-status,
      .aw-next {
        font-size: 15px;
        line-height: 1.8;
      }

      @media (max-width: 600px) {
        #animalWorldRoot {
          padding: 14px;
        }

        .aw-header {
          padding-top: 65px;
        }

        .aw-grid {
          gap: 10px;
          width: 100%;
        }

        .aw-zone {
          min-height: 170px;
          padding: 10px;
        }

        .aw-zone strong {
          font-size: 18px;
        }

        .aw-zone-icon {
          font-size: 50px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function initialize() {
    if (document.getElementById("animalWorldRoot")) {
      return;
    }

    installStyles();

    root = el("section");
    root.id = "animalWorldRoot";
    root.hidden = true;

    document.body.appendChild(root);

    // 只攔截 zoo，不改動其他關卡。
    // 使用捕獲階段，避免 home.js 原本的
    // zoo 按鈕先執行 enterMode("free")。
    document.addEventListener(
      "click",
      event => {
        const target = event.target;

        if (!(target instanceof Element)) return;

        const zooButton = target.closest(
          '.ms-level[data-level="zoo"]'
        );

        if (!zooButton) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        open();
      },
      true
    );

    window.addEventListener(
      "mindspace:mode-change",
      event => {
        if (event.detail?.mode === "home") {
          close();
        }
      }
    );

    console.log(
      "[Mindspace Animal World] V1 已載入"
    );
  }

  window.MindspaceAnimalWorld = {
    open,
    close,
    showOverview,
    getCurrentZone: () => currentZone?.id || null,
    getCurrentSoundId: () => currentSound?.id || null,
    getZones: () => ZONES
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
