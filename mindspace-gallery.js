
/*
  Mindspace｜正式雲端素材庫 V1
  mindspace-gallery.js

  功能：
  - 工作台雲端素材庫
  - 自動儲存已分類的原始積木 PNG
  - 跨裝置瀏覽
  - 從雲端加入目前世界
  - 不刪除雲端原始素材
*/

(() => {
  "use strict";

  const LIB = () => window.MindspaceLibrary;
  const COLLECTION_PATH = /^mindspace_assets\/[^/]+\/[A-Za-z0-9_-]{10,128}\.png$/;

  let librarySection = null;
  let galleryGrid = null;
  let galleryStatus = null;
  let refreshButton = null;
  let loading = false;
  let restoring = false;

  const savedCreations = new Set();
  const pendingCreations = new Set();

  // =====================================
  // 01｜基本介面
  // =====================================

  function setStatus(message, isError = false) {
    if (!galleryStatus) return;

    galleryStatus.textContent = message;
    galleryStatus.style.color =
      isError ? "#b42318" : "#52657b";
  }

  function createElement(tag, text = "", className = "") {
    const element = document.createElement(tag);

    if (text) element.textContent = text;
    if (className) element.className = className;

    return element;
  }

 

function createGalleryUI() {
  if (document.getElementById("mindspaceLibraryPanel")) {
    return;
  }

  // 素材庫按鈕放進原本浮動工具列
  const openButton = document.createElement("button");
  openButton.id = "mindspaceOpenLibrary";
  openButton.type = "button";
  openButton.className = "floatButton";
  openButton.textContent = "☁️";
  openButton.title = "開啟素材庫";
  openButton.setAttribute("aria-label", "開啟雲端素材庫");

  const controls = document.getElementById("floatingControls");
  const workbenchButton = document.getElementById("bubbleWorkbench");

  if (controls) {
    if (workbenchButton) {
      controls.insertBefore(openButton, workbenchButton);
    } else {
      controls.appendChild(openButton);
    }
  } else {
    Object.assign(openButton.style, {
      position: "fixed",
      right: "20px",
      bottom: "90px",
      zIndex: "45"
    });
    document.body.appendChild(openButton);
  }

  // 右側面板，不使用全畫面遮罩
  // 這樣積木可以直接拖出素材庫到世界
  const panel = document.createElement("aside");
  panel.id = "mindspaceLibraryPanel";

  Object.assign(panel.style, {
    position: "fixed",
    top: "0",
    right: "0",
    width: "min(400px, 85vw)",
    height: "100dvh",
    zIndex: "110",
    background: "#eee7d9",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-8px 0 30px #0003",
    transform: "translateX(105%)",
    transition: "transform 0.28s ease",
    visibility: "hidden",
    pointerEvents: "none",
    overflow: "hidden"
  });

  const header = document.createElement("div");

  Object.assign(header.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    background: "#d4c5a8",
    borderBottom: "3px solid #a39477",
    flexShrink: "0"
  });

  const heading = createElement(
    "h2",
    "☁️ Mindspace 積木背包"
  );

  Object.assign(heading.style, {
    margin: "0",
    fontSize: "18px",
    color: "#453b2e"
  });

  const closeButton = createElement("button", "❯");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "向右收合素材庫");

  Object.assign(closeButton.style, {
    width: "40px",
    height: "40px",
    borderRadius: "8px",
    background: "#f5eee1",
    color: "#453b2e",
    fontSize: "20px"
  });

  header.append(heading, closeButton);

  const content = document.createElement("div");

  Object.assign(content.style, {
    flex: "1",
    minHeight: "0",
    overflowY: "auto",
    padding: "14px",
    overscrollBehavior: "contain"
  });

  const description = createElement(
    "p",
    "按住積木，拖曳到左側世界即可加入。"
  );

  Object.assign(description.style, {
    fontSize: "13px",
    color: "#675c4b",
    margin: "0 0 12px"
  });

  refreshButton = createElement(
    "button",
    "🔄 重新整理素材庫",
    "action"
  );

  galleryStatus = createElement(
    "p",
    "正在準備雲端素材庫……"
  );
  galleryStatus.setAttribute("aria-live", "polite");

  Object.assign(galleryStatus.style, {
    fontSize: "12px",
    color: "#675c4b",
    margin: "10px 0"
  });

  galleryGrid = document.createElement("div");
  galleryGrid.id = "mindspaceGalleryGrid";

  Object.assign(galleryGrid.style, {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    padding: "9px",
    background: "#b6aa94",
    border: "3px solid #91836b",
    borderRadius: "8px",
    alignContent: "start"
  });

  content.append(
    description,
    refreshButton,
    galleryStatus,
    galleryGrid
  );

  panel.append(header, content);
  document.body.appendChild(panel);

  function openGallery() {
    panel.style.visibility = "visible";
    panel.style.pointerEvents = "auto";
    panel.style.transform = "translateX(0)";
    openButton.setAttribute("aria-expanded", "true");
    void refreshGallery();
  }

  function closeGallery() {
    panel.style.transform = "translateX(105%)";
    panel.style.pointerEvents = "none";
    openButton.setAttribute("aria-expanded", "false");

    setTimeout(() => {
      if (panel.style.transform === "translateX(105%)") {
        panel.style.visibility = "hidden";
      }
    }, 280);
  }

  openButton.addEventListener("click", () => {
    if (panel.style.transform === "translateX(0)") {
      closeGallery();
    } else {
      openGallery();
    }
  });

  closeButton.addEventListener("click", closeGallery);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeGallery();
    }
  });

  refreshButton.addEventListener("click", refreshGallery);

  window.openMindspaceGallery = openGallery;
  window.closeMindspaceGallery = closeGallery;

  librarySection = panel;
}


  // =====================================
  // 02｜圖片轉換
  // =====================================

  async function dataURLToBlob(dataURL) {
    if (
      typeof dataURL !== "string" ||
      !dataURL.startsWith("data:image/png;base64,")
    ) {
      throw new Error("作品缺少原始 PNG");
    }

    const response = await fetch(dataURL);
    const blob = await response.blob();

    if (blob.type !== "image/png") {
      throw new Error("圖片格式不是 PNG");
    }

    return blob;
  }

  // =====================================
  // 03｜雲端自動儲存
  // =====================================

  async function saveCreationToCloud(
    creationId,
    type,
    description,
    aiData
  ) {
    if (restoring) return;

    if (
      savedCreations.has(creationId) ||
      pendingCreations.has(creationId)
    ) {
      return;
    }

    const creation =
      window.mindspaceCreations?.find(
        item => item.id === creationId
      );

    if (!creation?.originalPNG) {
      console.warn(
        "[Mindspace Cloud] 找不到原始積木 PNG",
        creationId
      );
      return;
    }

    pendingCreations.add(creationId);

    try {
      const library = LIB();

      if (!library) {
        throw new Error("Firebase 素材庫尚未載入");
      }

      setStatus("☁️ 正在儲存新的積木作品……");

      const pngBlob = await dataURLToBlob(
        creation.originalPNG
      );

      const name = String(
        aiData?.name ||
        creation.name ||
        creation.identity ||
        description ||
        (type === "character" ? "我的角色" : "我的環境")
      ).trim().slice(0, 100);

      const result = await library.saveAsset({
        pngBlob,
        name,
        type,
        creatorName: "Mindspace 小小創作者",
        sourceWorld: "free",
        description: String(description || "")
          .slice(0, 1000)
      });

      savedCreations.add(creationId);

      creation.cloudAssetId = result.id;
      creation.cloudImagePath = result.imagePath;

      console.log(
        "[Mindspace Cloud] 作品儲存成功",
        result
      );

      setStatus("✅ 作品已儲存到雲端素材庫");

      await refreshGallery();

    } catch (error) {
      console.error(
        "[Mindspace Cloud] 作品儲存失敗",
        error
      );

      setStatus(
        "❌ 雲端儲存失敗：" + error.message,
        true
      );

    } finally {
      pendingCreations.delete(creationId);
    }
  }

  // =====================================
  // 04｜接入原本 AI 分類流程
  // =====================================

  function installClassificationHook() {
    const original =
      window.applyMindspaceClassification;

    if (typeof original !== "function") {
      console.error(
        "找不到 applyMindspaceClassification"
      );
      return;
    }

    if (original.__mindspaceCloudHook) {
      return;
    }

    function wrappedClassification(
      id,
      type,
      description,
      aiData
    ) {
      const result = original.apply(
        this,
        arguments
      );

      if (
        result !== false &&
        !restoring &&
        ["character", "environment"].includes(type)
      ) {
        // 背景上傳，不阻擋原本的分類、
        // AI 效果與世界互動。
        void saveCreationToCloud(
          id,
          type,
          description,
          aiData
        );
      }

      return result;
    }

    wrappedClassification.__mindspaceCloudHook = true;

    window.applyMindspaceClassification =
      wrappedClassification;
  }

  // =====================================
  // 05｜雲端素材卡片
  // =====================================

 
async function createAssetCard(asset) {
  const card = document.createElement("div");
  card.title = asset.name || "積木作品";
  card.setAttribute(
    "aria-label",
    `拖曳${asset.name || "積木作品"}到世界`
  );

  Object.assign(card.style, {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    border: "2px solid #938670",
    borderRadius: "3px",
    padding: "5px",
    background: "#d9cfbd",
    boxShadow:
      "inset 2px 2px #f8f0e3, inset -2px -2px #a89b86",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    touchAction: "none",
    userSelect: "none",
    overflow: "hidden"
  });

  const image = document.createElement("img");
  image.alt = asset.name || "積木作品";
  image.draggable = false;

  Object.assign(image.style, {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    pointerEvents: "none",
    userSelect: "none"
  });

  card.appendChild(image);

 
let available = false;

try {
  const blob = await LIB().loadAssetBlob(asset);

  const reader = new FileReader();

  image.src = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("無法建立素材縮圖"));

    reader.readAsDataURL(blob);
  });

  available = true;


  } catch (error) {
    console.warn("素材圖片載入失敗", asset.id, error);
    card.style.opacity = "0.45";
    card.title = "素材圖片無法載入";
  }

  card.addEventListener("pointerdown", event => {
    if (!available || event.button !== 0) return;

    event.preventDefault();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    // 拖曳預覽圖
    const ghost = document.createElement("img");
    ghost.src = image.src;
    ghost.alt = "";

    Object.assign(ghost.style, {
      position: "fixed",
      width: "100px",
      height: "100px",
      objectFit: "contain",
      left: `${startX}px`,
      top: `${startY}px`,
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      zIndex: "99999",
      opacity: "0.9",
      filter: "drop-shadow(0 5px 8px #0005)"
    });

    document.body.appendChild(ghost);

    card.style.background = "#f4e1a5";

    function moveGhost(e) {
      if (e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.hypot(dx, dy) > 5) {
        moved = true;
      }

      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;
    }

    async function finishDrag(e) {
      if (e.pointerId !== pointerId) return;

      document.removeEventListener("pointermove", moveGhost);
      document.removeEventListener("pointerup", finishDrag);
      document.removeEventListener("pointercancel", cancelDrag);

      ghost.remove();
      card.style.background = "#d9cfbd";

      if (!moved) return;

      const canvas = document.querySelector("#scene canvas");
      if (!canvas) {
        setStatus("找不到互動世界畫布", true);
        return;
      }

      const rect = canvas.getBoundingClientRect();

      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      const panel = document.getElementById(
        "mindspaceLibraryPanel"
      );

      const panelRect = panel?.getBoundingClientRect();

      const overPanel = panelRect &&
        e.clientX >= panelRect.left &&
        e.clientX <= panelRect.right &&
        e.clientY >= panelRect.top &&
        e.clientY <= panelRect.bottom;

      // 放在素材庫內或畫布外，就取消拖曳
      if (!inside || overPanel) return;

      const position = {
        x: (e.clientX - rect.left) *
           (canvas.width / rect.width),
        y: (e.clientY - rect.top) *
           (canvas.height / rect.height)
      };

      try {
        setStatus("正在將積木放入世界……");
        await addAssetToWorld(asset, position);
        setStatus(
          `✅ ${asset.name || "積木作品"}已加入世界`
        );
      } catch (error) {
        console.error("[Mindspace Drag]", error);
        setStatus(
          "拖曳加入失敗：" + error.message,
          true
        );
      }
    }

    function cancelDrag(e) {
      if (e.pointerId !== pointerId) return;

      document.removeEventListener("pointermove", moveGhost);
      document.removeEventListener("pointerup", finishDrag);
      document.removeEventListener("pointercancel", cancelDrag);

      ghost.remove();
      card.style.background = "#d9cfbd";
    }

    document.addEventListener("pointermove", moveGhost);
    document.addEventListener("pointerup", finishDrag);
    document.addEventListener("pointercancel", cancelDrag);
  });

  return card;
}

  // =====================================
  // 06｜將素材加入 p5.js 世界
  // =====================================

  async function addAssetToWorld(asset, dropPosition = null) {
    if (
      typeof window.addMindspaceCreation !== "function"
    ) {
      throw new Error("p5.js 世界尚未準備完成");
    }

    const blob = await LIB().loadAssetBlob(asset);

    const dataURL = await new Promise(
      (resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(
          new Error("無法讀取雲端 PNG")
        );

        reader.readAsDataURL(blob);
      }
    );

    // 先讓原始積木立即進入世界。
   
    // 將原始積木加入拖曳指定的位置
    const creationId =
      await window.addMindspaceCreation(
        dataURL,
        dropPosition
      );

    const creation =
      window.mindspaceCreations?.find(
        item => item.id === creationId
      );

    if (creation) {
      creation.cloudAssetId = asset.id;
      creation.cloudImagePath = asset.imagePath;
    }

    // 重複使用素材時，不再次上傳。
    restoring = true;

    try {
      window.applyMindspaceClassification?.(
        creationId,
        asset.type,
        asset.description || "",
        null
      );
    } finally {
      restoring = false;
    }


    const bubble =
      document.getElementById("speechBubble");

    if (bubble) {
      bubble.textContent =
        "雲端積木已經加入你的世界！";
    }
  }

  // =====================================
  // 07｜讀取雲端作品
  // =====================================

  async function refreshGallery() {
    if (loading || !galleryGrid) return;

    loading = true;

    if (refreshButton) {
      refreshButton.disabled = true;
    }

    galleryGrid.replaceChildren();
    setStatus("正在讀取雲端作品……");

    try {
      await LIB().ready;

      const assets = await LIB().listAssets(100);

      // 排除 setup_test 等無效測試資料。
      const validAssets = assets.filter(asset =>
        ["character", "environment"].includes(
          asset.type
        ) &&
        typeof asset.imagePath === "string" &&
        COLLECTION_PATH.test(asset.imagePath)
      );

      if (!validAssets.length) {
        setStatus("目前還沒有正式的積木作品。");
        return;
      }

      validAssets.sort((a, b) => {
        const timeA =
          a.createdAt?.seconds || 0;

        const timeB =
          b.createdAt?.seconds || 0;

        return timeB - timeA;
      });

      for (const asset of validAssets) {
        const card = await createAssetCard(asset);
        galleryGrid.appendChild(card);
      }

      setStatus(
        `☁️ 目前顯示 ${validAssets.length} 件雲端作品`
      );

    } catch (error) {
      console.error(
        "[Mindspace Cloud] 讀取失敗",
        error
      );

      setStatus(
        "❌ 讀取素材庫失敗：" + error.message,
        true
      );

    } finally {
      loading = false;

      if (refreshButton) {
        refreshButton.disabled = false;
      }
    }
  }

  // =====================================
  // 08｜啟動正式素材庫
  // =====================================

  async function initialize() {
    createGalleryUI();
    installClassificationHook();

    try {
      if (!LIB()) {
        throw new Error(
          "找不到 firebase-library.js"
        );
      }

      await LIB().ready;
      await refreshGallery();

      console.log(
        "[Mindspace Cloud] 正式素材庫已啟動"
      );

    } catch (error) {
      console.error(error);

      setStatus(
        "素材庫啟動失敗：" + error.message,
        true
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

  window.refreshMindspaceGallery = refreshGallery;
})();
