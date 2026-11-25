
/* =====================================================
   Mindspace｜動物世界 V2
   Plus-Plus 互動動物園地圖

   功能：
   1. Plus-Plus 動物園地圖
   2. 四個獨立喇叭按鈕
   3. 各園區隨機動物聲音
   4. 同一探索階段重複播放相同聲音
   5. 點擊及播放動畫
   6. 返回神秘題目選單
   7. 預留掃描、p5.js、Firebase 整合接口

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
  // =========================================

  function createSound(id) {
    return {
      id: id,
      label: "神秘聲音",
      file: ASSETS.sounds + id + ".mp3"
    };
  }

  // =========================================
  // 03. 四個園區
  //
  // x、y：喇叭中心百分比座標
  // size：喇叭占地圖寬度的百分比
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
        createSound("monkey"),
        createSound("tiger"),
        createSound("frog"),
        createSound("elephant")
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
        createSound("wolf"),
        createSound("bear"),
        createSound("deer"),
        createSound("fox")
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
        createSound("parrot"),
        createSound("owl"),
        createSound("peacock"),
        createSound("sparrow")
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
        createSound("dog"),
        createSound("cat"),
        createSound("sheep"),
        createSound("chicken")
      ]
    }
  ];

  // =========================================
  // 04. 暫時狀態
  // 不涉及 Firebase 永久資料
  // =========================================

  let root = null;
  let currentZone = null;
  let currentSound = null;
  let audio = null;
  let playbackToken = 0;
  let activeButton = null;

  const sessionSounds = new Map();
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
  // 06. CSS
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

        width: 100%;
        height: 100dvh;

        margin: 0;
        padding: 0;

        overflow-x: hidden;
        overflow-y: auto;

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
        width: 100%;
        min-height: 100%;

        display: flex;
        flex-direction: column;

        align-items: center;
        justify-content: center;

        padding: 12px 16px;
        gap: 10px;
      }

      /* ===============================
         上方操作區
      =============================== */

      #animalWorldRoot .aw-toolbar {

        width: min(100%, 1400px);

        display: flex;

        align-items: center;
        justify-content: space-between;

        gap: 10px;

        flex-shrink: 0;
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
         動物園地圖
      =============================== */

      #animalWorldRoot .aw-map {

        position: relative;

        width: min(
          100%,
          1400px,
          108dvh
        );

        aspect-ratio: 3 / 2;

        flex-shrink: 0;

        overflow: visible;

        isolation: isolate;
      }

      #animalWorldRoot .aw-map-image {

        display: block;

        width: 100%;
        height: 100%;

        object-fit: fill;

        border-radius: 20px;

        box-shadow:
          0 8px 24px rgba(0,0,0,.15);

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

      /* 滑鼠移入 */

      #animalWorldRoot
      .aw-speaker:hover img {

        transform: scale(1.13);
      }

      /* 按下喇叭 */

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

      /* 真實聲音播放中 */

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

      /* 圖片載入失敗的備用提示 */

      #animalWorldRoot
      .aw-speaker.aw-image-error {

        border-radius: 50%;

        background: #ffda4e;

        border: 3px solid #d4a02d;

        font-size:
          clamp(16px, 3vw, 38px);
      }

      /* ===============================
         下方探索提示
      =============================== */

      #animalWorldRoot .aw-panel {

        width: min(100%, 1000px);

        flex-shrink: 0;

        padding: 10px 18px;

        border: 3px solid white;

        border-radius: 20px;

        background: rgba(255,255,255,.94);

        box-shadow:
          0 5px 16px rgba(0,0,0,.08);
      }

      #animalWorldRoot .aw-title {

        margin: 0 0 5px;

        font-size:
          clamp(17px, 2vw, 23px);

        font-weight: 900;
      }

      #animalWorldRoot .aw-description {

        margin: 4px 0;

        font-size:
          clamp(13px, 1.5vw, 17px);

        line-height: 1.6;
      }

      #animalWorldRoot .aw-status {

        margin: 5px 0 0;

        min-height: 20px;

        font-size: 13px;

        line-height: 1.5;

        color: #64745d;
      }

      #animalWorldRoot .aw-status.aw-error {

        color: #a34b35;
      }

      #animalWorldRoot .aw-actions {

        display: flex;

        align-items: center;

        justify-content: center;

        gap: 10px;

        margin-top: 8px;

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
      }

      #animalWorldRoot .aw-replay:disabled {

        opacity: .45;

        cursor: default;
      }

      /* ===============================
         手機及直式平板
      =============================== */

      @media (max-width: 700px) {

        #animalWorldRoot .aw-layout {

          justify-content: flex-start;

          padding: 10px;

          gap: 12px;
        }

        #animalWorldRoot .aw-map {

          width: 100%;
        }

        #animalWorldRoot .aw-control {

          padding: 8px 12px;

          font-size: 13px;
        }

        #animalWorldRoot .aw-panel {

          padding: 12px;
        }
      }

      @media (prefers-reduced-motion: reduce) {

        #animalWorldRoot .aw-speaker img {

          animation: none !important;

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

    // 上方操作按鈕

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
      "error",
      () => {

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

    mapImage.src = ASSETS.map;

    map.appendChild(mapImage);

    // 下方探索提示

    const panel = el(
      "div",
      "aw-panel"
    );

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
  "📷 掃描我的積木",
  requestAnimalScan,
  "aw-replay"
);

scanButton.id = "awScan";

scanButton.disabled = true;

scanButton.style.background = "#8bcf91";

actions.append(
  replayButton,
  scanButton
);
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
    isError = false
  ) {

    const status =
      getElement("awStatus");

    if (!status) return;

    status.textContent = message;

    status.classList.toggle(
      "aw-error",
      isError
    );
  }

  // =========================================
  // 10. 隨機選擇園區聲音
  //
  // 同一次探索中，同一園區
  // 保留第一次抽到的聲音。
  // =========================================

  function getRandomSound(zone) {

    if (!zone.sounds.length) {
      return null;
    }

    if (sessionSounds.has(zone.id)) {

      return sessionSounds.get(
        zone.id
      );
    }

    const index = Math.floor(
      Math.random() *
      zone.sounds.length
    );

    const sound =
      zone.sounds[index];

    sessionSounds.set(
      zone.id,
      sound
    );

    return sound;
  }

  // =========================================
  // 11. 選擇園區
  // =========================================
  // =========================================
// 動物世界｜正式掃描入口
// =========================================

function requestAnimalScan() {

  if (!currentZone) {

    setStatus(
      "請先選擇想探索的園區。",
      true
    );

    return;
  }

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

  stopSound();

  window.dispatchEvent(

    new CustomEvent(

      "mindspace-animal-scan-requested",

      {
        detail: {

          zoneId: currentZone.id,

          soundId:
            currentSound?.id || "",

          sourceWorld: "animal"
        }
      }
    )
  );
}
  function selectZone(zone) {

    stopSound();

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

    getElement("awTitle")
      .textContent = zone.title;

    getElement("awDescription")
      .textContent =
        "仔細聽聽看！你想像中的生物會長什麼樣子呢？";

    getElement("awReplay")
      .disabled = !currentSound;
getElement("awScan")
  .disabled = false;
    if (!currentSound) {

      setStatus(
        "這個園區尚未準備聲音。",
        true
      );

      return;
    }

    // 提供後續掃描及共同世界使用

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
  // 12. 清除播放動畫
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
  // 13. 停止聲音
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
  // 14. 播放真實音檔
  // 不使用假音效或模擬動物叫聲
  // =========================================

  async function playSound() {

    if (
      !currentZone ||
      !currentSound
    ) return;

    stopSound();

    const token = playbackToken;

    const sound = currentSound;

    const player =
      new Audio(sound.file);

    audio = player;

    player.preload = "auto";

    player.volume = 0.8;

    setStatus(
      "正在載入神秘聲音……"
    );

    player.addEventListener(
      "playing",
      () => {

        if (
          token !== playbackToken
        ) return;

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

    player.addEventListener(
      "waiting",
      () => {

        if (
          token !== playbackToken
        ) return;

        clearPlayingAnimation();

        setStatus(
          "正在載入神秘聲音……"
        );
      }
    );

    player.addEventListener(
      "ended",
      () => {

        if (
          token !== playbackToken
        ) return;

        clearPlayingAnimation();

        setStatus(
          "聽完了！用 Plus-Plus 拼出你想像中的生物吧！"
        );
      }
    );

    player.addEventListener(
      "error",
      () => {

        if (
          token !== playbackToken
        ) return;

        clearPlayingAnimation();

        setStatus(
          "聲音尚未準備完成，請稍後再試。",
          true
        );

        console.warn(
          "[Animal World] Audio missing:",
          sound.file
        );
      }
    );

    try {

      await player.play();

      if (
        token !== playbackToken
      ) {

        player.pause();

        return;
      }

    } catch (error) {

      if (
        token !== playbackToken
      ) return;

      clearPlayingAnimation();

      setStatus(
        "目前無法播放聲音，請確認音檔已上傳。",
        true
      );

      console.warn(
        "[Animal World] Playback failed:",
        sound.file,
        error
      );
    }
  }

  // =========================================
  // 15. 重播同一個聲音
  // =========================================

  function replaySound() {

    if (!currentSound) return;

    playSound();
  }

  // =========================================
  // 16. 重置暫時探索狀態
  //
  // 不會清空任何既有作品
  // 不會刪除 Firebase 資料
  // =========================================

  function resetSession() {

    stopSound();

    sessionSounds.clear();

    currentZone = null;

    currentSound = null;

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

    if (!root) return;

    getElement("awTitle")
      .textContent =
        "今天想探索哪個地方？";

    getElement("awDescription")
      .textContent =
        "點擊黃色喇叭，聽聽神秘的動物聲音！";

    getElement("awReplay")
      .disabled = true;
getElement("awScan")
  .disabled = true;
    setStatus("");

    const mapImage =
      getElement("awMapImage");

    if (
      mapImage &&
      mapImage.complete &&
      !mapImage.naturalWidth
    ) {

      setStatus(
        "地圖載入失敗，請確認圖片路徑。",
        true
      );
    }
  }

  // =========================================
  // 17. 開啟動物世界
  // =========================================

  function open() {

    createInterface();

    resetSession();

    root.hidden = false;

    root.scrollTop = 0;

    console.info(
      "[Mindspace Animal World] V2 opened"
    );
  }

  // =========================================
  // 18. 關閉動物世界
  //
  // 下方原本的神秘題目選單
  // 保持不變。
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
  // 19. 返回動物園總覽
  // =========================================

  function showOverview() {

    createInterface();

    stopSound();

    root.hidden = false;

    root.scrollTop = 0;
  }

  // =========================================
  // 20. 初始化
  // =========================================

  function initialize() {

    createInterface();

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
      "[Mindspace Animal World] V2 已載入"
    );
  }

  // =========================================
  // 21. 公開 API
  // 保留 V1 的 getCurrentZone 回傳格式
  // =========================================

  window.MindspaceAnimalWorld = {

    version: "2.0.0",

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
      Boolean(root && !root.hidden)
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
