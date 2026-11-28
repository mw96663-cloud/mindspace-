
/*
  Mindspace｜動物世界共同棲地 V1
  animal-habitat.js

  功能：
  1. 四個 Plus-Plus 棲地背景
  2. 獨立 p5.js Instance Mode
  3. 原始積木 PNG 呈現
  4. 積木生物自主活動
  5. 滑鼠與觸控拖曳
  6. Firebase 永久共同棲地
  7. 跨裝置即時同步
  8. 儲存失敗重試
  9. 保護歷史作品

  不修改原本：
  自由創作、迷宮、星星、解鎖、
  相機、OpenAI、去背、雲端素材庫。
*/

(() => {

  "use strict";

  if (window.MindspaceAnimalHabitat) return;

  // ==========================================
  // 01｜四個棲地設定
  // ==========================================

  const HABITATS = {

    rainforest: {

      id: "rainforest",

      title: "熱帶雨林區",

      background:
        "./assets/animal/habitats/rainforest.png",

      color: "#426e3e",

      movement: "walk",

      minY: 0.58,

      maxY: 0.88
    },

    temperate: {

      id: "temperate",

      title: "溫帶動物區",

      background:
        "./assets/animal/habitats/temperate.png",

      color: "#729b4b",

      movement: "walk",

      minY: 0.60,

      maxY: 0.88
    },

    aviary: {

      id: "aviary",

      title: "鳥園",

      background:
        "./assets/animal/habitats/aviary.png",

      color: "#75b9d7",

      movement: "float",

      minY: 0.30,

      maxY: 0.84
    },

    kids_zoo: {

      id: "kids_zoo",

      title: "兒童動物園區",

      background:
        "./assets/animal/habitats/kids_zoo.png",

      color: "#b5ca73",

      movement: "bounce",

      minY: 0.60,

      maxY: 0.88
    }
  };

  // ==========================================
  // 02｜獨立狀態
  // ==========================================

  const LIB = () => window.MindspaceLibrary;

  let root = null;

  let canvasHost = null;

  let backgroundLayer = null;

  let titleElement = null;

  let statusElement = null;

  let countElement = null;

  let retryButton = null;

  let scanButton = null;

  let backButton = null;

  let p5Instance = null;

  let unsubscribeWorld = null;

  let currentHabitat = null;

  let currentSoundId = "";

  let sessionToken = 0;

  let syncVersion = 0;

  let opened = false;

  let dragging = null;

  let backgroundFailed = false;

  const objects = new Map();

  const loadingImages = new Map();

  // 尚未成功儲存的作品。
  // 離開棲地不清除，保留重試能力。
  // 這些資料暫存在記憶體中。

  const pendingSaves = new Map();

  const activeSaves = new Map();

  // ==========================================
  // 03｜基本工具
  // ==========================================

  function createElement(
    tag,
    className = "",
    text = ""
  ) {

    const element =
      document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function makeButton(text, handler) {

    const button = createElement(
      "button",
      "ah-button",
      text
    );

    button.type = "button";

    button.addEventListener(
      "click",
      handler
    );

    return button;
  }

  function clamp(value, min, max) {

    return Math.max(
      min,
      Math.min(max, value)
    );
  }

  function randomBetween(min, max) {

    return min + Math.random() * (max - min);
  }

  function getHabitat(zoneId) {

    if (!HABITATS[zoneId]) {

      throw new Error(
        "找不到指定棲地：" + zoneId
      );
    }

    return HABITATS[zoneId];
  }

  function setStatus(message, error = false) {

    if (!statusElement) return;

    statusElement.textContent = message;

    statusElement.classList.toggle(
      "ah-error",
      error
    );
  }

  function getPendingCount() {

    return pendingSaves.size;
  }

  function updateCount() {

    if (!countElement) return;

    const savedCount = [...objects.values()]
      .filter(item => item.saved).length;

    const localCount = [...objects.values()]
      .filter(item => !item.saved).length;

    countElement.textContent =
      `共同棲地：${savedCount} 件作品`
      + (
        localCount
          ? `｜${localCount} 件待儲存`
          : ""
      );

    if (retryButton) {

      retryButton.hidden =
        getPendingCount() === 0;

      retryButton.disabled =
        activeSaves.size > 0;
    }
  }

  // ==========================================
  // 04｜棲地專屬 CSS
  // ==========================================

  function installStyles() {

    if (
      document.getElementById(
        "animal-habitat-styles"
      )
    ) return;

    const style =
      document.createElement("style");

    style.id = "animal-habitat-styles";

    style.textContent = `

      #animalHabitatRoot {

        position: fixed;

        inset: 0;

        z-index: 245;

        width: 100%;

        height: 100dvh;

        margin: 0;

        padding: 0;

        overflow: hidden;

        isolation: isolate;

        background: #729b4b;

        font-family:
          Arial,
          "Noto Sans TC",
          sans-serif;
      }

      #animalHabitatRoot[hidden] {

        display: none !important;
      }

      #animalHabitatRoot * {

        box-sizing: border-box;
      }

      #animalHabitatRoot .ah-background {

        position: absolute;

        inset: 0;

        width: 100%;

        height: 100%;

        object-fit: cover;

        object-position: center;

        pointer-events: none;

        user-select: none;

        z-index: 0;
      }

      #animalHabitatRoot .ah-canvas {

        position: absolute;

        inset: 0;

        width: 100%;

        height: 100%;

        z-index: 1;

        overflow: hidden;

        touch-action: none;
      }

      #animalHabitatRoot .ah-canvas canvas {

        display: block;

        touch-action: none;
      }

      #animalHabitatRoot .ah-toolbar {

        position: absolute;

        top: 14px;

        left: 14px;

        right: 14px;

        z-index: 5;

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: 10px;

        pointer-events: none;
      }

      #animalHabitatRoot .ah-toolbar > * {

        pointer-events: auto;
      }

      #animalHabitatRoot .ah-title {

        padding: 12px 24px;

        margin: 0;

        border: 3px solid white;

        border-radius: 22px;

        background: #fff9e8ee;

        color: #415638;

        font-size:
          clamp(16px, 2.5vw, 26px);

        font-weight: 900;

        box-shadow:
          0 4px 12px #0002;

        text-align: center;
      }

      #animalHabitatRoot .ah-button {

        padding: 12px 18px;

        border: 3px solid white;

        border-radius: 18px;

        background: #ffdc72;

        color: #604a29;

        font-size:
          clamp(13px, 1.8vw, 18px);

        font-weight: 900;

        box-shadow:
          0 4px 0 #ba9850;

        cursor: pointer;

        touch-action: manipulation;
      }

      #animalHabitatRoot .ah-button:active {

        transform: translateY(3px);

        box-shadow:
          0 1px 0 #ba9850;
      }

      #animalHabitatRoot .ah-button:disabled {

        opacity: .55;

        cursor: wait;
      }

      #animalHabitatRoot .ah-button[hidden] {

        display: none !important;
      }

      #animalHabitatRoot .ah-info {

        position: absolute;

        bottom: 16px;

        left: 16px;

        max-width: calc(100% - 32px);

        padding: 12px 18px;

        border: 3px solid white;

        border-radius: 20px;

        background: #fffdf1ed;

        box-shadow:
          0 4px 15px #0002;

        color: #40543c;

        z-index: 5;
      }

      #animalHabitatRoot .ah-count {

        margin: 0 0 5px;

        font-size: 15px;

        font-weight: 900;
      }

      #animalHabitatRoot .ah-status {

        margin: 0;

        font-size: 13px;

        line-height: 1.5;
      }

      #animalHabitatRoot .ah-status.ah-error {

        color: #ad4331;
      }

      #animalHabitatRoot .ah-retry {

        margin-top: 8px;
      }

      @media (max-width: 600px) {

        #animalHabitatRoot .ah-toolbar {

          top: 8px;

          left: 8px;

          right: 8px;

          gap: 5px;
        }

        #animalHabitatRoot .ah-title {

          padding: 8px 12px;

          font-size: 15px;
        }

        #animalHabitatRoot .ah-button {

          padding: 9px 10px;

          font-size: 12px;
        }

        #animalHabitatRoot .ah-info {

          left: 8px;

          bottom: 8px;

          padding: 9px 12px;
        }
      }

    `;

    document.head.appendChild(style);
  }

  // ==========================================
  // 05｜建立棲地介面
  // ==========================================

  function createInterface() {

    if (root) return;

    installStyles();

    root = createElement("section");

    root.id = "animalHabitatRoot";

    root.hidden = true;

    root.setAttribute(
      "aria-label",
      "Mindspace 動物共同棲地"
    );

    backgroundLayer = createElement(
      "img",
      "ah-background"
    );

    backgroundLayer.alt = "";

    backgroundLayer.draggable = false;

    backgroundLayer.addEventListener(
      "error",
      () => {

        backgroundFailed = true;

        setStatus(
          "棲地背景載入失敗，請檢查圖片路徑。",
          true
        );
      }
    );

    backgroundLayer.addEventListener(
      "load",
      () => {
        backgroundFailed = false;
      }
    );

    canvasHost = createElement(
      "div",
      "ah-canvas"
    );

    const toolbar = createElement(
      "div",
      "ah-toolbar"
    );

    backButton = makeButton(
      "← 動物園",
      returnToOverview
    );

    titleElement = createElement(
      "h1",
      "ah-title",
      "共同棲地"
    );

   scanButton = makeButton(
  "🔊 再次探索",
  requestScan
);
    toolbar.append(
      backButton,
      titleElement,
      scanButton
    );

    const info = createElement(
      "div",
      "ah-info"
    );

    countElement = createElement(
      "p",
      "ah-count",
      "共同棲地：0 件作品"
    );

    statusElement = createElement(
      "p",
      "ah-status",
      "正在準備棲地……"
    );

    statusElement.setAttribute(
      "role",
      "status"
    );

    retryButton = makeButton(
      "重新儲存作品",
      () => {
        void retryPendingSaves();
      }
    );

    retryButton.classList.add("ah-retry");

    retryButton.hidden = true;

    info.append(
      countElement,
      statusElement,
      retryButton
    );

    root.append(
      backgroundLayer,
      canvasHost,
      toolbar,
      info
    );

    document.body.appendChild(root);
  }

  // ==========================================
  // 06｜建立獨立 p5.js 畫布
  // ==========================================

  function createP5Canvas() {

    if (p5Instance) return;

    if (typeof window.p5 !== "function") {

      throw new Error("找不到 p5.js");
    }

    p5Instance = new window.p5(p => {

      let previousTime = 0;

      p.setup = () => {

        const canvas = p.createCanvas(

          Math.max(
            1,
            canvasHost.clientWidth
          ),

          Math.max(
            1,
            canvasHost.clientHeight
          )
        );

        canvas.parent(canvasHost);

        p.pixelDensity(
          Math.min(
            window.devicePixelRatio || 1,
            2
          )
        );

        p.imageMode(p.CENTER);

        p.noStroke();

        p.frameRate(60);

        previousTime = p.millis();

        installPointerEvents(
          canvas.elt,
          p
        );
      };

      p.draw = () => {

        p.clear();

        if (!opened) return;

        const now = p.millis();

        const dt = Math.min(
          (now - previousTime) / 1000,
          0.05
        );

        previousTime = now;

        const orderedObjects =
          [...objects.values()]
            .sort((a, b) => a.y - b.y);

        for (const item of orderedObjects) {

          updateObject(
            item,
            dt,
            now / 1000
          );

          drawObject(
            p,
            item,
            now / 1000
          );
        }
      };

      p.windowResized = () => {

        if (!opened) return;

        p.resizeCanvas(

          Math.max(
            1,
            canvasHost.clientWidth
          ),

          Math.max(
            1,
            canvasHost.clientHeight
          )
        );
      };

    }, canvasHost);
  }

  // ==========================================
  // 07｜圖片載入工具
  // ==========================================

  function blobToImage(blob) {

    return new Promise((resolve, reject) => {

      const url = URL.createObjectURL(blob);

      const image = new Image();

      image.onload = () => {

        URL.revokeObjectURL(url);

        resolve(image);
      };

      image.onerror = () => {

        URL.revokeObjectURL(url);

        reject(
          new Error("積木圖片載入失敗")
        );
      };

      image.src = url;
    });
  }

  async function pngToBlob(png) {

    if (png instanceof Blob) {

      if (
        png.type !== "image/png" ||
        png.size <= 0 ||
        png.size > 5 * 1024 * 1024
      ) {

        throw new Error(
          "作品必須是 5 MB 以下的 PNG"
        );
      }

      return png;
    }

    if (
      typeof png !== "string" ||
      !png.startsWith("data:image/png;base64,")
    ) {

      throw new Error(
        "找不到有效的透明 PNG"
      );
    }

    const response = await fetch(png);

    const blob = await response.blob();

    return pngToBlob(blob);
  }

  // ==========================================
  // 08｜建立棲地物件
  // ==========================================

  function createWorldObject(
    data,
    image,
    saved = true
  ) {

    const habitat = getHabitat(
      data.zoneId
    );

    return {

      id: data.id,

      assetId: data.assetId || null,

      zoneId: data.zoneId,

      soundId: data.soundId || "",

      name: data.name || "我的積木生物",

      type: data.type || "character",

      imagePath: data.imagePath || "",

      image,

      x: clamp(
        Number(data.x ?? 0.5),
        0,
        1
      ),

      y: clamp(
        Number(data.y ?? 0.7),
        0,
        1
      ),

      size: clamp(
        Number(data.size ?? 0.15),
        0.01,
        1
      ),

      speed: randomBetween(
        0.012,
        0.045
      ),

      direction:
        Math.random() > 0.5 ? 1 : -1,

      phase: randomBetween(
        0,
        Math.PI * 2
      ),

      movement: habitat.movement,

      bounce: 0,

      angle: 0,

      saved,

      dragging: false,

      pauseUntil: 0
    };
  }

  // ==========================================
  // 09｜積木生物自主活動
  // ==========================================

  function updateObject(item, dt, time) {

    if (item.dragging) return;

    if (item.type === "environment") {

      item.bounce = 0;

      item.angle = 0;

      return;
    }

    if (performance.now() < item.pauseUntil) {

      item.bounce = 0;

      item.angle = 0;

      return;
    }

    const habitat = getHabitat(
      item.zoneId
    );

    item.x +=
      item.direction
      * item.speed
      * dt;

    const minX = 0.10;

    const maxX = 0.90;

    if (item.x >= maxX) {

      item.x = maxX;

      item.direction = -1;
    }

    if (item.x <= minX) {

      item.x = minX;

      item.direction = 1;
    }

    if (item.movement === "float") {

      item.bounce =
        Math.sin(
          time * 2 + item.phase
        ) * 0.025;

      item.angle =
        Math.sin(
          time * 1.5 + item.phase
        ) * 0.06;

    } else if (item.movement === "bounce") {

      item.bounce =
        -Math.abs(
          Math.sin(
            time * 3 + item.phase
          )
        ) * 0.018;

      item.angle =
        Math.sin(
          time * 3 + item.phase
        ) * 0.035;

    } else {

      item.bounce =
        Math.sin(
          time * 4 + item.phase
        ) * 0.004;

      item.angle =
        Math.sin(
          time * 4 + item.phase
        ) * 0.025;
    }

    item.y = clamp(

      item.y,

      habitat.minY,

      habitat.maxY
    );
  }

  // ==========================================
  // 10｜維持原始積木比例
  // ==========================================

  function getObjectDimensions(p, item) {

    const image = item.image;

    const baseSize =
      Math.min(p.width, p.height)
      * item.size;

    const ratio =
      image.naturalWidth /
      Math.max(1, image.naturalHeight);

    let w = baseSize;

    let h = baseSize;

    if (ratio >= 1) {

      h = baseSize / ratio;

    } else {

      w = baseSize * ratio;
    }

    return { w, h };
  }

  // ==========================================
  // 11｜繪製積木作品
  // ==========================================

  function drawObject(p, item, time) {

    if (!item.image) return;

    const { w, h } =
      getObjectDimensions(p, item);

    const x = item.x * p.width;

    const groundY = item.y * p.height;

    const y =
      groundY
      + item.bounce * p.height
      - h / 2;

    // 地面柔和陰影

    p.push();

    p.noStroke();

    p.fill(0, 0, 0, 38);

    p.ellipse(
      x,
      groundY,
      w * 0.82,
      Math.max(5, h * 0.13)
    );

    p.pop();

    // 原始 PNG
    // 不改變積木造型、顏色及比例。

    p.push();

    p.translate(x, y);

    p.rotate(item.angle);

    // 使用原生 Canvas 繪製 HTMLImageElement。

    const ctx = p.drawingContext;

    ctx.drawImage(

      item.image,

      -w / 2,

      -h / 2,

      w,

      h
    );

    p.pop();

    // 拖曳時顯示外框

    if (item.dragging) {

      p.push();

      p.noFill();

      p.stroke(255, 230, 100);

      p.strokeWeight(3);

      p.rectMode(p.CENTER);

      p.rect(
        x,
        y,
        w + 12,
        h + 12,
        12
      );

      p.pop();
    }

    // 待儲存作品標示

    if (!item.saved) {

      p.push();

      p.noStroke();

      p.fill(255, 205, 80);

      p.circle(
        x + w / 2,
        y - h / 2,
        13
      );

      p.pop();
    }
  }

  // ==========================================
  // 12｜滑鼠與觸控拖曳
  // ==========================================

  function installPointerEvents(canvas, p) {

    let activePointer = null;

    let offsetX = 0;

    let offsetY = 0;

    function getPoint(event) {

      const rect =
        canvas.getBoundingClientRect();

      return {

        x:
          (event.clientX - rect.left)
          / Math.max(1, rect.width)
          * p.width,

        y:
          (event.clientY - rect.top)
          / Math.max(1, rect.height)
          * p.height
      };
    }

    canvas.addEventListener(

      "pointerdown",

      event => {

        if (!opened || dragging) return;

        if (
          event.pointerType === "mouse" &&
          event.button !== 0
        ) return;

        const point = getPoint(event);

        const ordered =
          [...objects.values()]
            .sort((a, b) => b.y - a.y);

        for (const item of ordered) {

          if (!item.image) continue;

          const { w, h } =
            getObjectDimensions(p, item);

          const x = item.x * p.width;

          const groundY =
            item.y * p.height;

          const y =
            groundY
            + item.bounce * p.height
            - h / 2;

          if (

            Math.abs(point.x - x)
              <= w / 2 + 8

            &&

            Math.abs(point.y - y)
              <= h / 2 + 8

          ) {

            event.preventDefault();

            dragging = item;

            item.dragging = true;

            item.bounce = 0;

            item.angle = 0;

            activePointer = event.pointerId;

            offsetX = point.x - x;

            offsetY = point.y - groundY;

            canvas.setPointerCapture(
              event.pointerId
            );

            break;
          }
        }
      }
    );

    canvas.addEventListener(

      "pointermove",

      event => {

        if (
          !dragging ||
          activePointer !== event.pointerId
        ) return;

        event.preventDefault();

        const point = getPoint(event);

        dragging.x = clamp(

          (point.x - offsetX) / p.width,

          0.05,

          0.95
        );

        dragging.y = clamp(

          (point.y - offsetY) / p.height,

          0.15,

          0.95
        );
      }
    );

    function endDrag(event) {

      if (
        !dragging ||
        activePointer !== event.pointerId
      ) return;

      dragging.dragging = false;

      dragging.pauseUntil =
        performance.now() + 1500;

      dragging = null;

      activePointer = null;

      if (
        canvas.hasPointerCapture(
          event.pointerId
        )
      ) {

        canvas.releasePointerCapture(
          event.pointerId
        );
      }

      // 拖曳只改變目前畫面的暫時位置。
      // 不覆蓋 Firebase 歷史作品。
    }

    canvas.addEventListener(
      "pointerup",
      endDrag
    );

    canvas.addEventListener(
      "pointercancel",
      endDrag
    );

    canvas.addEventListener(
      "lostpointercapture",
      endDrag
    );
  }

  // ==========================================
  // 13｜載入單一 Firebase 歷史作品
  // ==========================================

  async function loadCloudObject(
    data,
    token,
    version
  ) {

    if (
      !opened ||
      token !== sessionToken ||
      version !== syncVersion
    ) return;

    if (
      data.zoneId !== currentHabitat?.id
    ) return;

    if (objects.has(data.id)) {

      const existing =
        objects.get(data.id);

      existing.saved = true;

      existing.assetId = data.assetId;

      existing.imagePath = data.imagePath;

      return;
    }

    const key = `${token}:${data.id}`;

    let task = loadingImages.get(key);

    if (!task) {

      task = (async () => {

        const blob =
          await LIB()
            .loadAnimalWorldObjectBlob(data);

        return blobToImage(blob);

      })();

      loadingImages.set(key, task);

      task.then(

        () => loadingImages.delete(key),

        () => loadingImages.delete(key)
      );
    }

    const image = await task;

    if (

      !opened ||

      token !== sessionToken ||

      version !== syncVersion ||

      currentHabitat?.id !== data.zoneId

    ) return;

    if (objects.has(data.id)) return;

    const item = createWorldObject(

      data,

      image,

      true
    );

    objects.set(
      item.id,
      item
    );

    updateCount();
  }

  // ==========================================
  // 14｜同步 Firebase 棲地資料
  // ==========================================

  async function synchronizeWorld(
    records,
    metadata,
    token
  ) {

    if (
      !opened ||
      token !== sessionToken
    ) return;

    const version = ++syncVersion;

    const cloudIds = new Set(
      records.map(item => item.id)
    );

    // 只有確認為伺服器資料時，
    // 才處理已被管理員刪除的作品。
    // 不因暫時離線或快取而清空畫面。

    if (
      !metadata.fromCache &&
      !metadata.hasPendingWrites
    ) {

      for (const [id, item] of objects) {

        if (

          item.saved &&

          !cloudIds.has(id) &&

          !pendingSaves.has(id)

        ) {

          if (dragging?.id === id) {

            dragging.dragging = false;

            dragging = null;
          }

          objects.delete(id);
        }
      }
    }

    let failedCount = 0;

    // 分批載入圖片，降低瞬間下載負擔。

    const batchSize = 6;

    for (
      let i = 0;
      i < records.length;
      i += batchSize
    ) {

      if (

        token !== sessionToken ||

        version !== syncVersion ||

        !opened

      ) return;

      const batch =
        records.slice(i, i + batchSize);

      const results =
        await Promise.allSettled(

          batch.map(data =>

            loadCloudObject(
              data,
              token,
              version
            )
          )
        );

      failedCount += results.filter(

        result =>
          result.status === "rejected"

      ).length;
    }

    if (

      token !== sessionToken ||

      version !== syncVersion ||

      !opened

    ) return;

    updateCount();

    if (backgroundFailed) {

      setStatus(
        "棲地背景載入失敗，請檢查圖片路徑。",
        true
      );

    } else if (failedCount > 0) {

      setStatus(

        `${failedCount} 件作品圖片載入失敗，`
        + "可重新進入棲地再試一次。",

        true
      );

    } else if (getPendingCount() > 0) {

      setStatus(
        "有作品尚未完成雲端儲存。",
        true
      );

    } else if (
      metadata.fromCache ||
      metadata.hasPendingWrites
    ) {

      setStatus(
        "正在等待 Firebase 雲端確認……"
      );

    } else {

      setStatus(
        "☁️ 已同步共同棲地作品"
      );
    }
  }

  // ==========================================
  // 15｜啟動 Firebase 即時監聽
  // ==========================================

  function startWorldSubscription() {

    stopWorldSubscription();

    if (!LIB()?.subscribeAnimalWorld) {

      throw new Error(
        "Firebase 素材庫 V2 尚未載入"
      );
    }

    const token = sessionToken;

    const zoneId = currentHabitat.id;

    unsubscribeWorld =
      LIB().subscribeAnimalWorld(

        zoneId,

        (records, metadata) => {

          void synchronizeWorld(

            records,

            metadata,

            token

          ).catch(error => {

            if (
              opened &&
              token === sessionToken
            ) {

              setStatus(
                "棲地同步失敗：" + error.message,
                true
              );
            }
          });
        },

        error => {

          if (
            opened &&
            token === sessionToken
          ) {

            setStatus(
              "Firebase 讀取失敗："
              + error.message,
              true
            );
          }
        }
      );
  }

  function stopWorldSubscription() {

    if (unsubscribeWorld) {

      unsubscribeWorld();

      unsubscribeWorld = null;
    }
  }

  // ==========================================
  // 16｜永久儲存與重試
  // ==========================================

  function persistCreation(id) {

    if (activeSaves.has(id)) {

      return activeSaves.get(id);
    }

    const record = pendingSaves.get(id);

    if (!record) {

      return Promise.reject(
        new Error("找不到待儲存作品")
      );
    }

    const task = (async () => {

      try {

        if (!LIB()?.saveAnimalCreation) {

          throw new Error(
            "Firebase V2 尚未載入"
          );
        }

        if (opened) {

          setStatus(
            "☁️ 正在永久儲存積木作品……"
          );
        }

        // 使用固定 ID 及固定初始位置。
        // 重試時不產生新的作品 ID。

        const result =
          await LIB().saveAnimalCreation(
            record.data
          );

        pendingSaves.delete(id);

        const item = objects.get(id);

        if (item) {

          item.saved = true;

          item.assetId = result.assetId;

          item.imagePath = result.imagePath;
        }

        if (opened) {

          setStatus(
            "☁️ 作品已永久加入共同棲地"
          );
        }

        updateCount();

        return result;

      } catch (error) {

        console.error(
          "[Animal Habitat] 儲存失敗",
          error
        );

        if (opened) {

          setStatus(

            "作品尚未儲存成功："
            + error.message
            + "。請重新儲存。",

            true
          );
        }

        throw error;
      }
    })();

    activeSaves.set(id, task);

    updateCount();

    function finish() {

      activeSaves.delete(id);

      updateCount();
    }

    task.then(finish, finish);

    return task;
  }

  async function retryPendingSaves() {

    if (activeSaves.size > 0) return;

    const ids = [...pendingSaves.keys()];

    let failures = 0;

    for (const id of ids) {

      try {

        await persistCreation(id);

      } catch (error) {

        failures++;
      }
    }

    if (!opened) return;

    if (failures > 0) {

      setStatus(

        `${failures} 件作品仍未儲存成功。`,

        true
      );

    } else {

      setStatus(
        "☁️ 所有待儲存作品已完成"
      );
    }

    updateCount();
  }

  // ==========================================
  // 17｜加入新的掃描作品
  //
  // 後續由原本相機及手動修整流程呼叫。
  // 不重新製作相機或 AI 去背。
  // ==========================================

  async function addCreation({

    id,

    png,

    zoneId,

    soundId = "",

    name = "我的積木生物",

    type = "character"

  }) {

    const habitat = getHabitat(zoneId);

    const creationId =
      id || crypto.randomUUID();

    if (

      !/^[A-Za-z0-9_-]{10,128}$/
        .test(creationId)

    ) {

      throw new Error("作品 ID 格式錯誤");
    }

    if (
      !["character", "environment"]
        .includes(type)
    ) {

      throw new Error("作品類型錯誤");
    }

    if (pendingSaves.has(creationId)) {

      const record =
        pendingSaves.get(creationId);

      if (
        record.data.zoneId !== zoneId
      ) {

        throw new Error(
          "待儲存作品的園區不一致"
        );
      }

      if (
        !opened ||
        currentHabitat?.id !== zoneId
      ) {

        await open(zoneId, soundId);
      }

      return persistCreation(creationId);
    }

    const pngBlob = await pngToBlob(png);

    const image = await blobToImage(pngBlob);

    if (
      !opened ||
      currentHabitat?.id !== zoneId
    ) {

      await open(zoneId, soundId);
    }

    if (objects.has(creationId)) {

      throw new Error(
        "此作品 ID 已存在於棲地"
      );
    }

    const data = {

      id: creationId,

      pngBlob,

      zoneId,

      soundId,

      name,

      type,

      x: randomBetween(
        0.20,
        0.80
      ),

      y: randomBetween(
        habitat.minY,
        habitat.maxY
      ),

      size: randomBetween(
        0.16,
        0.23
      )
    };

    const item = createWorldObject(

      data,

      image,

      false
    );

    pendingSaves.set(

      creationId,

      {
        data,
        image
      }
    );

    objects.set(
      creationId,
      item
    );

    updateCount();

    // 先呈現兒童原始作品，
    // 再等待 Firebase 確認永久儲存。

    return persistCreation(creationId);
  }

  // ==========================================
  // 18｜開啟指定棲地
  // ==========================================

  async function open(
    zoneId,
    soundId = ""
  ) {

    const habitat = getHabitat(zoneId);

    if (
      opened &&
      currentHabitat?.id === zoneId
    ) {

      currentSoundId = soundId;

      return;
    }

    createInterface();

    close();

    currentHabitat = habitat;

    currentSoundId = soundId;

    opened = true;

    backgroundFailed = false;

    root.hidden = false;

    root.style.background =
      habitat.color;

    titleElement.textContent =
      habitat.title;

    backgroundLayer.src =
      habitat.background;

    setStatus(
      "正在讀取歷史積木作品……"
    );

    // 恢復同一園區尚未完成儲存的作品。

    for (const record of pendingSaves.values()) {

      if (record.data.zoneId !== zoneId) {
        continue;
      }

      const item = createWorldObject(

        record.data,

        record.image,

        false
      );

      objects.set(
        item.id,
        item
      );
    }

    try {

      createP5Canvas();

      updateCount();

      startWorldSubscription();

    } catch (error) {

      setStatus(
        "棲地啟動失敗：" + error.message,
        true
      );

      throw error;
    }

    window.dispatchEvent(

      new CustomEvent(

        "mindspace-animal-habitat-opened",

        {
          detail: {
            zoneId,
            soundId,
            sourceWorld: "animal"
          }
        }
      )
    );
  }

  // ==========================================
  // 19｜離開棲地
  //
  // 只清除暫時畫面。
  // 不刪除任何 Firebase 資料。
  // ==========================================

  function close() {

    sessionToken++;

    syncVersion++;

    opened = false;

    stopWorldSubscription();

    if (dragging) {

      dragging.dragging = false;

      dragging = null;
    }

    if (p5Instance) {

      p5Instance.remove();

      p5Instance = null;
    }

    objects.clear();

    loadingImages.clear();

    currentHabitat = null;

    currentSoundId = "";

    if (root) {

      root.hidden = true;
    }

    // pendingSaves 與 activeSaves 不清除。
    // 正在上傳的作品仍可完成儲存。
  }

  // ==========================================
  // 20｜返回動物園地圖
  // ==========================================

  function returnToOverview() {

  // 必須完成雲端儲存
  // 避免尚未儲存的作品被遺忘

  if (getPendingCount() > 0) {

    setStatus(

      "作品尚未完成雲端儲存。"
      + "請等待儲存完成，"
      + "或點擊重新儲存作品。",

      true
    );

    return;
  }

  close();

  window.MindspaceAnimalWorld
    ?.showOverview?.();
}

  // ==========================================
  // 21｜掃描入口
  //
  // 本階段只建立事件。
  // 下一階段串接原本相機。
  // ==========================================

  // ==========================================
// V4｜開始下一次感官探索
// 不直接跳過聲音進入相機
// ==========================================

function requestScan() {

  if (!currentHabitat) return;

  // 尚有作品等待雲端儲存時
  // 先完成原本的作品

  if (getPendingCount() > 0) {

    setStatus(

      "請先完成目前作品的雲端儲存，"
      + "再開始下一次探索。",

      true
    );

    return;
  }

  // 返回動物園地圖
  // 由兒童自行選擇下一個探索園區

  returnToOverview();
}
  // ==========================================
  // 22｜避免未儲存作品意外遺失
  // ==========================================

  window.addEventListener(

    "beforeunload",

    event => {

      if (pendingSaves.size > 0) {

        event.preventDefault();

        event.returnValue = "";
      }
    }
  );

  // ==========================================
  // 23｜公開 API
  // ==========================================

  window.MindspaceAnimalHabitat = {

    version: "1.1.0",

    open,

    close,

    addCreation,

    requestScan,

    retryPendingSaves,

    returnToOverview,

    isOpen() {

      return opened;
    },

    getCurrentZone() {

      return currentHabitat?.id || null;
    },

    getCurrentSoundId() {

      return currentSoundId;
    },

    getObjectCount() {

      return objects.size;
    },

    getPendingCount,

    getHabitats() {

      return Object.values(HABITATS)
        .map(item => ({ ...item }));
    }
  };

  console.info(
    "[Mindspace] 動物共同棲地 V1 已載入"
  );

})();
