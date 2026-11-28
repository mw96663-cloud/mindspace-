/* =====================================================
   Mindspace｜動物世界 V3
   Plus-Plus 聲音感官啟發互動系統

   功能：
   1. 滿版 Plus-Plus 動物園地圖
   2. 四個獨立喇叭按鈕
   3. 每個園區三種真實動物聲音
   4. 支援 MP3、M4A 混合播放
   5. 同一探索階段重複播放相同聲音
   6. 真實聲音播放動畫
   7. 完整聽完聲音才能解鎖掃描
   8. 播放失敗時禁止掃描
   9. 重新探索時重新隨機抽取
   10. 保留相機、p5.js、Firebase 串接

   不修改：
   自由創作、迷宮、星星、解鎖、
   OpenAI、相機、去背及雲端素材庫。
===================================================== */

(() => {
  "use strict";

  if (window.MindspaceAnimalWorld) return;

  // =========================================
  // 01. 圖片及聲音素材
  // =========================================

  const ASSETS = {
    map: "./assets/animal/animal-world-map.png",
    speaker: "./assets/animal/sound-button.png",
    sounds: "./assets/animal/sounds/"
  };

  // =========================================
  // 02. 建立聲音資料
  // 支援 MP3、M4A
  // =========================================

  function createSound(id, extension = "mp3") {
    return {
      id: id,
      label: "神秘聲音",
      file: ASSETS.sounds + id + "." + extension
    };
  }

  // =========================================
  // 03. 四個園區
  // 每個園區三種動物聲音
  // =========================================

  const ZONES = [
    {
      id: "rainforest",
      title: "熱帶雨林區",
      x: 26.24,
      y: 37.60,
      size: 9,
      color: "#d7efc8",

      sounds: [
        createSound("monkey", "m4a"),
        createSound("frog", "mp3"),
        createSound("elephant", "m4a")
      ]
    },

    {
      id: "temperate",
      title: "溫帶動物區",
      x: 76.63,
      y: 37.30,
      size: 9,
      color: "#f0dfbf",

      sounds: [
        createSound("horse", "mp3"),
        createSound("cow", "mp3"),
        createSound("pig", "mp3")
      ]
    },

    {
      id: "aviary",
      title: "鳥園",
      x: 23.05,
      y: 77.15,
      size: 9,
      color: "#c7eaf1",

      sounds: [
        createSound("rooster", "mp3"),
        createSound("duck", "mp3"),
        createSound("sparrow", "mp3")
      ]
    },

    {
      id: "kids_zoo",
      title: "兒童動物園區",
      x: 79.69,
      y: 76.76,
      size: 9,
      color: "#f8e8ae",

      sounds: [
        createSound("dog", "mp3"),
        createSound("cat", "mp3"),
        createSound("sheep", "mp3")
      ]
    }
  ];

  // =========================================
  // 04. 暫時探索狀態
  // 不涉及 Firebase 永久資料
  // =========================================

  let root = null;

  let currentZone = null;
  let currentSound = null;

  let audio = null;
  let playbackToken = 0;
  let activeButton = null;

  let soundCompleted = false;

  let playbackState = "idle";

  let mapLoadFailed = false;

  // 各園區目前尚未完成的探索聲音
const sessionSounds = new Map();

// 各園區尚未完成的聲音清單
const zoneSoundQueues = new Map();

// 各園區上一次完成的聲音
const lastCompletedSounds = new Map();

// 已處理的作品 ID，避免重複計算
const completedCreationIds = new Set();

  const speakerButtons = new Map();

  // =========================================
  // 05. DOM 工具
  // =========================================

  function el(tag, className, text) {

    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text) {
      node.textContent = text;
    }

    return node;
  }

  function makeButton(
    text,
    handler,
    className = ""
  ) {

    const button = el(
      "button",
      className,
      text
    );

    button.type = "button";

    button.addEventListener(
      "click",
      handler
    );

    return button;
  }

  function getElement(id) {

    return root
      ? root.querySelector("#" + id)
      : null;
  }

  // =========================================
  // 06. 滿版地圖 CSS
  // 所有樣式限制在動物世界內
  // =========================================

  function installStyles() {

    if (
      document.getElementById("aw-styles")
    ) return;

    const style =
      document.createElement("style");

    style.id = "aw-styles";

    style.textContent = `

      #animalWorldRoot {

        position: fixed;
        inset: 0;
        z-index: 240;

        width: 100vw;
        height: 100dvh;

        margin: 0;
        padding: 0;

        overflow: hidden;

        background: #e5edcf;
        color: #344b41;

        font-family:
          Arial,
          "Noto Sans TC",
          sans-serif;

        text-align: center;

        overscroll-behavior: contain;

        isolation: isolate;
      }

      #animalWorldRoot[hidden] {
        display: none !important;
      }

      #animalWorldRoot * {
        box-sizing: border-box;
      }

      #animalWorldRoot .aw-layout {

        position: relative;

        width: 100%;
        height: 100%;

        min-height: 0;

        margin: 0;
        padding: 0;

        display: block;
      }

      /* ===============================
         上方操作區
      =============================== */

      #animalWorldRoot .aw-toolbar {

        position: absolute;

        top: 14px;
        left: 14px;
        right: 14px;

        width: auto;

        display: flex;

        align-items: center;
        justify-content: space-between;

        gap: 10px;

        z-index: 20;

        pointer-events: none;
      }

      #animalWorldRoot .aw-toolbar button {
        pointer-events: auto;
      }

      #animalWorldRoot .aw-control {

        border: 3px solid #fff;

        border-radius: 18px;

        padding: 10px 18px;

        background: #ffdf79;

        color: #634321;

        font-size: 16px;
        font-weight: 900;

        box-shadow: 0 4px 0 #cba451;

        cursor: pointer;

        touch-action: manipulation;

        transition:
          transform .15s ease,
          filter .15s ease;
      }

      #animalWorldRoot .aw-control:hover {

        filter: brightness(1.06);

        transform: translateY(-2px);
      }

      #animalWorldRoot .aw-control:active {

        transform: translateY(3px);

        box-shadow: 0 1px 0 #cba451;
      }

      /* ===============================
         滿版動物園地圖
      =============================== */

      #animalWorldRoot .aw-map {

        position: absolute;

        inset: 0;

        width: 100%;
        height: 100%;

        max-width: none;

        margin: 0;
        padding: 0;

        overflow: visible;

        isolation: isolate;
      }

      #animalWorldRoot .aw-map-image {

        display: block;

        width: 100%;
        height: 100%;

        object-fit: fill;

        border-radius: 0;

        box-shadow: none;

        pointer-events: none;

        user-select: none;

        -webkit-user-drag: none;
      }

      /* ===============================
         喇叭按鈕
      =============================== */

      #animalWorldRoot .aw-speaker {

        position: absolute;

        transform: translate(-50%, -50%);

        aspect-ratio: 1;

        height: auto;

        max-width: 120px;

        margin: 0;
        padding: 0;

        border: 0;

        background: transparent;

        box-shadow: none;

        z-index: 5;

        cursor: pointer;

        touch-action: manipulation;

        -webkit-tap-highlight-color:
          transparent;
      }

      #animalWorldRoot .aw-speaker img {

        display: block;

        width: 100%;
        height: 100%;

        object-fit: contain;

        pointer-events: none;

        user-select: none;

        -webkit-user-drag: none;

        transition:
          transform .18s ease,
          filter .18s ease;

        filter:
          drop-shadow(
            0 4px 4px rgba(0,0,0,.20)
          );
      }

      #animalWorldRoot
      .aw-speaker:hover img {

        transform: scale(1.13);
      }

      #animalWorldRoot
      .aw-speaker:active img {

        transform: scale(.90);
      }

      /* 選取園區 */

      #animalWorldRoot
      .aw-speaker.aw-selected img {

        filter:
          drop-shadow(0 0 5px white)
          drop-shadow(0 0 10px #ffd83d);
      }

      /* 聲音播放中 */

      #animalWorldRoot
      .aw-speaker.aw-playing img {

        animation:
          awSpeakerPulse
          .65s ease-in-out infinite;
      }

      @keyframes awSpeakerPulse {

        0%, 100% {
          transform: scale(1);
        }

        50% {
          transform: scale(1.15);
        }
      }

      #animalWorldRoot
      .aw-speaker:focus-visible {

        outline: 3px solid white;

        outline-offset: 3px;

        border-radius: 50%;
      }

      /* 喇叭圖片載入失敗的備用樣式 */

      #animalWorldRoot
      .aw-speaker.aw-image-error {

        border-radius: 50%;

        background: #ffda4e;

        border: 3px solid #d4a02d;

        font-size:
          clamp(16px, 3vw, 38px);
      }

      /* ===============================
         下方探索提示面板
      =============================== */

      #animalWorldRoot .aw-panel {

        position: absolute;

        left: 50%;
        bottom: 14px;

        transform: translateX(-50%);

        width: min(
          calc(100% - 28px),
          680px
        );

        padding: 10px 16px;

        border: 3px solid white;

        border-radius: 20px;

        background:
          rgba(255,255,255,.92);

        backdrop-filter: blur(10px);

        box-shadow:
          0 5px 16px rgba(0,0,0,.08);

        z-index: 20;
      }

      #animalWorldRoot .aw-panel[hidden] {
        display: none !important;
      }

      #animalWorldRoot .aw-title {

        margin: 0 0 4px;

        font-size: 19px;

        font-weight: 900;
      }

      #animalWorldRoot .aw-description {

        margin: 2px 0;

        font-size: 14px;

        line-height: 1.6;
      }

      #animalWorldRoot .aw-status {

        margin: 4px 0 0;

        min-height: 20px;

        font-size: 12px;

        line-height: 1.5;

        color: #64745d;
      }

      #animalWorldRoot
      .aw-status.aw-error {

        color: #a34b35;
      }

      #animalWorldRoot
      .aw-status.aw-success {

        color: #39804a;

        font-weight: 800;
      }

      #animalWorldRoot .aw-actions {

        display: flex;

        align-items: center;

        justify-content: center;

        gap: 10px;

        margin-top: 6px;

        flex-wrap: wrap;
      }

      #animalWorldRoot .aw-replay {

        border: 0;

        border-radius: 14px;

        background: #ffe17b;

        color: #634321;

        padding: 9px 18px;

        font-size: 15px;

        font-weight: 900;

        cursor: pointer;

        touch-action: manipulation;

        transition:
          background .2s ease,
          transform .2s ease,
          opacity .2s ease;
      }

      #animalWorldRoot
      .aw-replay:not(:disabled):hover {

        transform: translateY(-2px);
      }

      #animalWorldRoot
      .aw-replay:disabled {

        opacity: .45;

        cursor: default;

        transform: none;
      }

      /* ===============================
         掃描按鈕狀態
      =============================== */

      #animalWorldRoot #awScan {

        background: #8bcf91;

        color: #245232;
      }

      #animalWorldRoot #awScan:disabled {

        background: #d4d8d0;

        color: #687166;

        opacity: .8;
      }

      #animalWorldRoot
      #awScan.aw-unlocked {

        background: #8bcf91;

        color: #245232;

        box-shadow:
          0 3px 0 #62a96a,
          0 0 12px rgba(139,207,145,.35);
      }

      /* ===============================
         聲音播放進度
      =============================== */

      #animalWorldRoot .aw-progress {

        width: min(100%, 300px);

        height: 7px;

        margin: 10px auto 4px;

        overflow: hidden;

        border-radius: 20px;

        background: #e1e7db;
      }

      #animalWorldRoot
      .aw-progress[hidden] {

        display: none !important;
      }

      #animalWorldRoot .aw-progress-fill {

        width: 0%;

        height: 100%;

        border-radius: 20px;

        background: #e7bb49;

        transition: width .15s linear;
      }

      #animalWorldRoot
      .aw-progress-fill.aw-finished {

        background: #8bcf91;
      }

      /* ===============================
         手機及直式平板
      =============================== */

      @media (max-width: 700px) {

        #animalWorldRoot .aw-toolbar {

          top: 8px;
          left: 8px;
          right: 8px;
        }

        #animalWorldRoot .aw-control {

          padding: 8px 12px;

          font-size: 13px;
        }

        #animalWorldRoot .aw-panel {

          bottom: 8px;

          padding: 8px 12px;
        }

        #animalWorldRoot .aw-speaker {

          min-width: 44px;
        }

        #animalWorldRoot .aw-title {

          font-size: 17px;
        }

        #animalWorldRoot .aw-description {

          font-size: 13px;
        }

        #animalWorldRoot .aw-replay {

          font-size: 13px;

          padding: 9px 12px;
        }
      }

      @media (prefers-reduced-motion: reduce) {

        #animalWorldRoot .aw-speaker img {

          animation: none !important;

          transition: none !important;
        }

        #animalWorldRoot .aw-progress-fill {

          transition: none !important;
        }
      }

    `;

    document.head.appendChild(style);
  }

  // =========================================
  // 07. 建立主要介面
  // =========================================

  function createInterface() {

    if (root) return;

    installStyles();

    root = el("section");

    root.id = "animalWorldRoot";

    root.hidden = true;

    root.setAttribute(
      "aria-label",
      "Mindspace 動物世界"
    );

    const layout = el(
      "div",
      "aw-layout"
    );

    // 上方操作區

    const toolbar = el(
      "div",
      "aw-toolbar"
    );

    const backButton = makeButton(
      "← 返回",
      close,
      "aw-control"
    );

    const restartButton = makeButton(
      "重新探索",
      resetSession,
      "aw-control"
    );

    toolbar.append(
      backButton,
      restartButton
    );

    // 動物園地圖

    const map = el(
      "div",
      "aw-map"
    );

    map.id = "awMap";

    const mapImage = el(
      "img",
      "aw-map-image"
    );

    mapImage.id = "awMapImage";

    mapImage.alt =
      "Mindspace Plus-Plus 動物世界";

    mapImage.draggable = false;

    mapImage.addEventListener(
      "load",
      () => {

        mapLoadFailed = false;

        if (!currentZone) {
          setPanelVisible(false);
        }
      }
    );

    mapImage.addEventListener(
      "error",
      () => {

        mapLoadFailed = true;

        setPanelVisible(true);

        setStatus(
          "地圖載入失敗，請確認圖片路徑。",
          true
        );

        console.error(
          "[Animal World] Map missing:",
          ASSETS.map
        );
      }
    );

    map.appendChild(mapImage);

    // 下方探索提示

    const panel = el(
      "div",
      "aw-panel"
    );

    panel.id = "awPanel";

    panel.hidden = true;

    const title = el(
      "h2",
      "aw-title",
      "今天想探索哪個地方？"
    );

    title.id = "awTitle";

    const description = el(
      "p",
      "aw-description",
      "點擊黃色喇叭，聽聽神秘的動物聲音！"
    );

    description.id = "awDescription";

    // 聲音播放進度

    const progress = el(
      "div",
      "aw-progress"
    );

    progress.id = "awProgress";

    progress.hidden = true;

    progress.setAttribute(
      "role",
      "progressbar"
    );

    progress.setAttribute(
      "aria-label",
      "聲音播放進度"
    );

    progress.setAttribute(
      "aria-valuemin",
      "0"
    );

    progress.setAttribute(
      "aria-valuemax",
      "100"
    );

    progress.setAttribute(
      "aria-valuenow",
      "0"
    );

    const progressFill = el(
      "div",
      "aw-progress-fill"
    );

    progressFill.id =
      "awProgressFill";

    progress.appendChild(
      progressFill
    );

    // 操作按鈕

    const actions = el(
      "div",
      "aw-actions"
    );

    const replayButton = makeButton(
      "🔊 再聽一次",
      replaySound,
      "aw-replay"
    );

    replayButton.id = "awReplay";

    replayButton.disabled = true;

    const scanButton = makeButton(
      "🔒 聽完聲音後解鎖",
      requestAnimalScan,
      "aw-replay"
    );

    scanButton.id = "awScan";

    scanButton.disabled = true;

    actions.append(
      replayButton,
      scanButton
    );

    // 狀態提示

    const status = el(
      "p",
      "aw-status"
    );

    status.id = "awStatus";

    status.setAttribute(
      "role",
      "status"
    );

    status.setAttribute(
      "aria-live",
      "polite"
    );

    panel.append(
      title,
      description,
      progress,
      actions,
      status
    );

    layout.append(
      toolbar,
      map,
      panel
    );

    root.appendChild(layout);

    document.body.appendChild(root);

    createSpeakerButtons(map);

    mapImage.src = ASSETS.map;
  }

  // =========================================
  // 08. 建立四個喇叭
  // =========================================

  function createSpeakerButtons(map) {

    speakerButtons.clear();

    for (const zone of ZONES) {

      const button = makeButton(
        "",
        () => selectZone(zone),
        "aw-speaker"
      );

      button.dataset.zone = zone.id;

      button.style.left =
        zone.x + "%";

      button.style.top =
        zone.y + "%";

      button.style.width =
        zone.size + "%";

      button.setAttribute(
        "aria-label",
        "聆聽" +
        zone.title +
        "的神秘聲音"
      );

      button.setAttribute(
        "aria-pressed",
        "false"
      );

      const image = el("img");

      image.alt = "";

      image.draggable = false;

      image.addEventListener(
        "error",
        () => {

          image.remove();

          button.textContent = "🔊";

          button.classList.add(
            "aw-image-error"
          );

          console.error(
            "[Animal World] Speaker missing:",
            ASSETS.speaker
          );
        }
      );

      image.src = ASSETS.speaker;

      button.appendChild(image);

      speakerButtons.set(
        zone.id,
        button
      );

      map.appendChild(button);
    }
  }

  // =========================================
  // 09. 顯示提示
  // =========================================

  function setStatus(
    message,
    isError = false,
    isSuccess = false
  ) {

    const status =
      getElement("awStatus");

    if (!status) return;

    status.textContent = message;

    status.classList.toggle(
      "aw-error",
      isError
    );

    status.classList.toggle(
      "aw-success",
      isSuccess && !isError
    );
  }

  function setPanelVisible(visible) {

    const panel =
      getElement("awPanel");

    if (!panel) return;

    panel.hidden = !visible;
  }

  // =========================================
  // 10. 播放進度控制
  // =========================================

  function setProgressVisible(visible) {

    const progress =
      getElement("awProgress");

    if (!progress) return;

    progress.hidden = !visible;
  }

  function setProgress(
    value,
    finished = false
  ) {

    const progress =
      getElement("awProgress");

    const fill =
      getElement("awProgressFill");

    if (!progress || !fill) return;

    const percent = Math.max(
      0,
      Math.min(
        100,
        Number(value) || 0
      )
    );

    fill.style.width =
      percent + "%";

    progress.setAttribute(
      "aria-valuenow",
      String(Math.round(percent))
    );

    fill.classList.toggle(
      "aw-finished",
      finished
    );
  }

  // =========================================
  // 11. 掃描按鈕鎖定及解鎖
  // =========================================

  function lockScan() {

    soundCompleted = false;

    const button =
      getElement("awScan");

    if (!button) return;

    button.disabled = true;

    button.textContent =
      "🔒 聽完聲音後解鎖";

    button.classList.remove(
      "aw-unlocked"
    );
  }

  function unlockScan() {

    if (
      !currentZone ||
      !currentSound ||
      playbackState !== "completed"
    ) return;

    soundCompleted = true;

    const button =
      getElement("awScan");

    if (!button) return;

    button.disabled = false;

    button.textContent =
      "📷 掃描我的積木";

    button.classList.add(
      "aw-unlocked"
    );
  }

  // =========================================
  // 12. 更新重播按鈕
  // =========================================

  function updateReplayButton() {

    const button =
      getElement("awReplay");

    if (!button) return;

    button.disabled = !currentSound;

    if (playbackState === "error") {

      button.textContent =
        "🔊 再試一次";

    } else {

      button.textContent =
        "🔊 再聽一次";
    }
  }

  // =========================================
  // 13. 隨機選擇園區聲音
  //
  // 同一次探索中，同一園區
  // 保留第一次抽到的聲音。
  // =========================================

  // =========================================
// V4｜各園區獨立洗牌
// =========================================

function shuffleSounds(sounds) {

  const result = [...sounds];

  for (let i = result.length - 1; i > 0; i--) {

    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [result[i], result[j]] = [
      result[j],
      result[i]
    ];
  }

  return result;
}

// =========================================
// V4｜建立新一輪聲音清單
// 避免與上一輪最後一個聲音重複
// =========================================

function createSoundQueue(zone) {

  const queue = shuffleSounds(
    zone.sounds
  );

  const lastSoundId =
    lastCompletedSounds.get(zone.id);

  if (
    queue.length > 1 &&
    queue[0].id === lastSoundId
  ) {

    const swapIndex =
      1 + Math.floor(
        Math.random() * (queue.length - 1)
      );

    [queue[0], queue[swapIndex]] = [
      queue[swapIndex],
      queue[0]
    ];
  }

  zoneSoundQueues.set(
    zone.id,
    queue
  );

  return queue;
}

// =========================================
// V4｜取得目前探索的聲音
// 尚未完成作品前不更換
// =========================================

function getRandomSound(zone) {

  if (!zone.sounds.length) {

    return null;
  }

  // 尚未完成的探索維持原本聲音

  if (sessionSounds.has(zone.id)) {

    return sessionSounds.get(
      zone.id
    );
  }

  let queue =
    zoneSoundQueues.get(zone.id);

  // 三種聲音全部完成後才重新洗牌

  if (!queue || queue.length === 0) {

    queue = createSoundQueue(zone);
  }

  // 先取得聲音，但不移除
  // 必須完成雲端儲存才正式消耗

  const sound = queue[0];

  sessionSounds.set(
    zone.id,
    sound
  );

  console.info(
    "[Animal World V4] 開始探索",
    {
      zoneId: zone.id,
      soundId: sound.id,
      remaining: queue.length
    }
  );

  return sound;
}

  // =========================================
  // 14. 動物世界正式掃描入口
  // =========================================
// =========================================
// V4｜完成目前園區的聲音探索
//
// 只接受 Firebase 儲存成功事件
// 不因拍照或去背完成而提前更換
// =========================================

function handleAnimalCreationSaved(event) {

  const detail = event.detail || {};

  const creationId = detail.id;

  const zoneId = detail.zoneId;

  const soundId = detail.soundId;

  if (
    !creationId ||
    !zoneId ||
    !soundId
  ) {

    return;
  }

  // 防止同一件作品重複完成探索

  if (
    completedCreationIds.has(creationId)
  ) {

    return;
  }

  completedCreationIds.add(
    creationId
  );

  const assignedSound =
    sessionSounds.get(zoneId);

  // 必須符合該園區目前的探索聲音

  if (
    !assignedSound ||
    assignedSound.id !== soundId
  ) {

    return;
  }

  const queue =
    zoneSoundQueues.get(zoneId);

  // 完成目前聲音，移出待探索清單

  if (queue) {

    const index = queue.findIndex(
      sound => sound.id === soundId
    );

    if (index !== -1) {

      queue.splice(index, 1);
    }
  }

  // 紀錄上一個完成的聲音

  lastCompletedSounds.set(
    zoneId,
    soundId
  );

  // 解除該園區目前的聲音綁定

  sessionSounds.delete(zoneId);

  // 若完成的是目前選擇的園區
  // 清除暫時介面狀態

  if (
    currentZone?.id === zoneId &&
    currentSound?.id === soundId
  ) {

    stopSound();

    lockScan();

    playbackState = "idle";

    currentSound = null;

    currentZone = null;

    activeButton = null;

    for (const button of
      speakerButtons.values()
    ) {

      button.classList.remove(
        "aw-selected",
        "aw-playing"
      );

      button.setAttribute(
        "aria-pressed",
        "false"
      );
    }

    updateReplayButton();

    setProgress(0);

    setProgressVisible(false);

    setPanelVisible(false);
  }

  console.info(
    "[Animal World V4] 本次探索完成",
    {
      creationId,
      zoneId,
      soundId,
      remaining: queue?.length || 0
    }
  );

  // 提供後續擴充使用

  window.dispatchEvent(

    new CustomEvent(

      "mindspace:animal-exploration-completed",

      {
        detail: {

          creationId,

          zoneId,

          soundId,

          remainingSounds:
            queue?.length || 0
        }
      }
    )
  );
}
  function requestAnimalScan() {

    if (
      !currentZone ||
      !currentSound
    ) {

      setStatus(
        "請先選擇想探索的園區。",
        true
      );

      return;
    }

    // 必須真的完整播放完畢

    if (
      !soundCompleted ||
      playbackState !== "completed"
    ) {

      setStatus(
        "請先完整聽完神秘聲音。",
        true
      );

      return;
    }

    // 確認既有棲地及雲端系統

    if (
      !window.MindspaceAnimalHabitat ||
      !window.MindspaceLibrary
    ) {

      setStatus(
        "棲地系統尚未載入，請重新整理。",
        true
      );

      return;
    }

    const scanDetail = {

      zoneId: currentZone.id,

      soundId: currentSound.id,

      sourceWorld: "animal"
    };

    // 停止聲音，但保留已完成狀態
    // 取消相機後仍可重新掃描

    stopSound();

    setStatus(
      "準備掃描你的積木作品！",
      false,
      true
    );

    // 保留原本 index.html 使用的事件

    window.dispatchEvent(

      new CustomEvent(

        "mindspace-animal-scan-requested",

        {
          detail: scanDetail
        }
      )
    );
  }

  // =========================================
  // 15. 選擇園區
  // =========================================

  function selectZone(zone) {

    stopSound();

    lockScan();

    playbackState = "idle";

    currentZone = zone;

    currentSound =
      getRandomSound(zone);

    activeButton =
      speakerButtons.get(zone.id);

    for (const button of
      speakerButtons.values()
    ) {

      button.classList.remove(
        "aw-selected",
        "aw-playing"
      );

      button.setAttribute(
        "aria-pressed",
        "false"
      );
    }

    if (activeButton) {

      activeButton.classList.add(
        "aw-selected"
      );

      activeButton.setAttribute(
        "aria-pressed",
        "true"
      );
    }

    setPanelVisible(true);

    getElement("awTitle")
      .textContent = zone.title;

    getElement("awDescription")
      .textContent =
        "仔細聽聽看！你想像中的生物會長什麼樣子呢？";

    setProgress(0);

    setProgressVisible(false);

    updateReplayButton();

    if (!currentSound) {

      playbackState = "error";

      setStatus(
        "這個園區尚未準備聲音。",
        true
      );

      return;
    }

    // 保留原本的園區選擇事件

    window.dispatchEvent(

      new CustomEvent(

        "mindspace:animal-zone-selected",

        {
          detail: {

            zoneId: currentZone.id,

            soundId: currentSound.id,

            sourceWorld: "animal"
          }
        }
      )
    );

    playSound();
  }

  // =========================================
  // 16. 清除播放動畫
  // =========================================

  function clearPlayingAnimation() {

    for (const button of
      speakerButtons.values()
    ) {

      button.classList.remove(
        "aw-playing"
      );
    }
  }

  // =========================================
  // 17. 停止聲音
  //
  // playbackToken 防止舊音檔事件
  // 影響目前選擇的園區。
  // =========================================

  function stopSound() {

    playbackToken++;

    if (audio) {

      const oldAudio = audio;

      audio = null;

      oldAudio.pause();

      try {

        oldAudio.currentTime = 0;

      } catch (error) {

        // 音檔尚未載入時略過。
      }

      oldAudio.removeAttribute("src");

      oldAudio.load();
    }

    clearPlayingAnimation();
  }

  // =========================================
  // 18. 聲音播放失敗
  // =========================================

  function handlePlaybackError(
    sound,
    error
  ) {

    stopSound();

    playbackState = "error";

    lockScan();

    clearPlayingAnimation();

    setProgress(0);

    setProgressVisible(false);

    updateReplayButton();

    setStatus(
      "聲音播放失敗，請再試一次。",
      true
    );

    console.warn(

      "[Animal World] Audio playback failed:",

      sound.file,

      error
    );
  }

  // =========================================
  // 19. 播放真實動物音檔
  //
  // 不使用模擬聲音
  // 不使用固定秒數解鎖
  // 必須收到真正的 ended 事件
  // =========================================

  async function playSound() {

    if (
      !currentZone ||
      !currentSound
    ) return;

    stopSound();

    // 每次播放都重新鎖定掃描

    lockScan();

    playbackState = "loading";

    setProgress(0);

    setProgressVisible(true);

    updateReplayButton();

    const token = playbackToken;

    const sound = currentSound;

    const zoneId = currentZone.id;

    const player = new Audio();

    audio = player;

    player.preload = "auto";

    player.volume = 0.8;

    player.loop = false;

    setStatus(
      "正在載入神秘聲音……"
    );

    // 確認事件仍屬於目前音檔

    function isCurrentPlayback() {

      return (

        token === playbackToken &&

        audio === player &&

        currentZone?.id === zoneId &&

        currentSound?.id === sound.id
      );
    }

    // -------------------------------------
    // 開始真正播放
    // -------------------------------------

    player.addEventListener(

      "playing",

      () => {

        if (!isCurrentPlayback()) return;

        playbackState = "playing";

        if (activeButton) {

          activeButton.classList.add(
            "aw-playing"
          );
        }

        setStatus(
          "仔細聽聽看，你想到了什麼？"
        );
      }
    );

    // -------------------------------------
    // 等待音檔載入
    // -------------------------------------

    player.addEventListener(

      "waiting",

      () => {

        if (!isCurrentPlayback()) return;

        if (player.ended) return;

        playbackState = "loading";

        lockScan();

        clearPlayingAnimation();

        setStatus(
          "正在載入神秘聲音……"
        );
      }
    );

    // -------------------------------------
    // 音檔播放進度
    // -------------------------------------

    player.addEventListener(

      "timeupdate",

      () => {

        if (!isCurrentPlayback()) return;

        if (

          !Number.isFinite(player.duration) ||

          player.duration <= 0

        ) return;

        const percent =

          player.currentTime /

          player.duration *

          100;

        setProgress(percent);
      }
    );

    // -------------------------------------
    // 暫停播放
    // -------------------------------------

    player.addEventListener(

      "pause",

      () => {

        if (!isCurrentPlayback()) return;

        if (player.ended) return;

        playbackState = "paused";

        lockScan();

        clearPlayingAnimation();

        setStatus(
          "聲音已暫停，請再聽一次。"
        );
      }
    );

    // -------------------------------------
    // 真正完整播放結束
    // 只有這裡可以解鎖掃描
    // -------------------------------------

    player.addEventListener(

      "ended",

      () => {

        if (!isCurrentPlayback()) return;

        playbackState = "completed";

        clearPlayingAnimation();

        setProgress(
          100,
          true
        );

        unlockScan();

        updateReplayButton();

        getElement("awDescription")
          .textContent =
            "用 Plus-Plus 拼出你想像中的生物吧！";

        setStatus(
          "聽完了！完成積木創作後，就可以掃描作品囉！",
          false,
          true
        );

        window.dispatchEvent(

          new CustomEvent(

            "mindspace:animal-sound-completed",

            {
              detail: {

                zoneId: zoneId,

                soundId: sound.id,

                sourceWorld: "animal"
              }
            }
          )
        );
      }
    );

    // -------------------------------------
    // 音檔載入或解碼失敗
    // -------------------------------------

    player.addEventListener(

      "error",

      () => {

        if (!isCurrentPlayback()) return;

        handlePlaybackError(

          sound,

          player.error
        );
      }
    );

    // 設定真實音檔來源

    player.src = sound.file;

    // -------------------------------------
    // 開始播放
    // -------------------------------------

    try {

      await player.play();

      if (!isCurrentPlayback()) {

        player.pause();

        return;
      }

    } catch (error) {

      if (!isCurrentPlayback()) return;

      handlePlaybackError(

        sound,

        error
      );
    }
  }

  // =========================================
  // 20. 重播同一個聲音
  // 不重新隨機抽取
  // =========================================

  function replaySound() {

    if (
      !currentZone ||
      !currentSound
    ) return;

    getElement("awDescription")
      .textContent =
        "仔細聽聽看！你想像中的生物會長什麼樣子呢？";

    playSound();
  }

  // =========================================
  // 21. 重置暫時探索狀態
  //
  // 不會清空任何既有作品
  // 不會刪除 Firebase 資料
  // =========================================

  function resetSession() {

    stopSound();

    currentZone = null;

    currentSound = null;

    activeButton = null;

    playbackState = "idle";

    soundCompleted = false;

    for (const button of
      speakerButtons.values()
    ) {

      button.classList.remove(

        "aw-selected",

        "aw-playing"
      );

      button.setAttribute(

        "aria-pressed",

        "false"
      );
    }

    if (!root) return;

    getElement("awTitle")
      .textContent =
        "今天想探索哪個地方？";

    getElement("awDescription")
      .textContent =
        "點擊黃色喇叭，聽聽神秘的動物聲音！";

    lockScan();

    updateReplayButton();

    setProgress(0);

    setProgressVisible(false);

    setStatus("");

    setPanelVisible(false);

    const mapImage =
      getElement("awMapImage");

    if (

      mapLoadFailed ||

      (
        mapImage &&
        mapImage.complete &&
        !mapImage.naturalWidth
      )

    ) {

      setPanelVisible(true);

      setStatus(
        "地圖載入失敗，請確認圖片路徑。",
        true
      );
    }

    console.info(
      "[Animal World] New exploration session"
    );
  }

  // =========================================
  // 22. 開啟動物世界
  // =========================================

  function open() {

    createInterface();

    resetSession();

    root.hidden = false;

    root.scrollTop = 0;

    console.info(
      "[Mindspace Animal World] V3 opened"
    );
  }

  // =========================================
  // 23. 關閉動物世界
  // =========================================

  function close() {

    resetSession();

    if (root) {

      root.hidden = true;
    }

    console.info(
      "[Mindspace Animal World] closed"
    );
  }

  // =========================================
  // 24. 返回動物園總覽
  //
  // 保留同一探索階段的聲音
  // 但中途停止的聲音不能解鎖掃描
  // =========================================

  function showOverview() {

    createInterface();

    stopSound();

    if (

      playbackState === "playing" ||

      playbackState === "loading"

    ) {

      playbackState = "paused";

      lockScan();

      setStatus(
        "請再聽一次神秘聲音。"
      );
    }

    root.hidden = false;

    root.scrollTop = 0;

    setPanelVisible(

      Boolean(currentZone) ||

      mapLoadFailed
    );
  }

  // =========================================
  // 25. 初始化
  // =========================================

  function initialize() {

  createInterface();

  // 監聽真正的 Firebase 作品儲存成功事件

  window.addEventListener(

    "mindspace-animal-creation-saved",

    handleAnimalCreationSaved
  );

  // 保留原本首頁模式切換

  window.addEventListener(

    "mindspace:mode-change",

    event => {

      if (

        event.detail?.mode === "home"

      ) {

        close();
      }
    }
  );

  console.info(
    "[Mindspace Animal World] V4 已載入"
  );
}

  // =========================================
  // 26. 公開 API
  //
  // 保留原本 V2 所有公開接口
  // =========================================

  window.MindspaceAnimalWorld = {

    version: "4.0.0",
    // V4｜取得指定園區的探索紀錄

getExplorationState: (zoneId) => {

  const zone = ZONES.find(
    item => item.id === zoneId
  );

  if (!zone) {

    return null;
  }

  return {

    zoneId,

    currentSound:
      sessionSounds.get(zoneId)?.id || null,

    lastCompletedSound:
      lastCompletedSounds.get(zoneId) || null,

    remainingSounds:
      (zoneSoundQueues.get(zoneId) || [])
        .map(sound => sound.id),

    totalSounds:
      zone.sounds.length
  };
},
    open,

    close,

    showOverview,

    resetSession,

    replaySound,

    getCurrentZone: () =>

      currentZone?.id || null,

    getCurrentSoundId: () =>

      currentSound?.id || null,

    getCurrentZoneData: () => {

      if (!currentZone) {

        return null;
      }

      return {

        ...currentZone,

        sounds: currentZone.sounds.map(

          sound => ({ ...sound })
        )
      };
    },

    getZones: () => {

      return ZONES.map(zone => ({

        ...zone,

        sounds: zone.sounds.map(

          sound => ({ ...sound })
        )
      }));
    },

    isOpen: () =>

      Boolean(root && !root.hidden),

    // V3 新增聲音狀態接口

    isSoundCompleted: () =>

      soundCompleted,

    getPlaybackState: () =>

      playbackState,

    canScan: () =>

      Boolean(

        currentZone &&

        currentSound &&

        soundCompleted &&

        playbackState === "completed"
      )
  };

  // =========================================
  // 27. 啟動
  // =========================================

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
