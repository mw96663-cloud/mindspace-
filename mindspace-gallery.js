
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
    if (document.getElementById("mindspaceCloudLibrary")) {
      return;
    }

    const sidebarBody =
      document.querySelector("#sidebar .sidebarBody");

    if (!sidebarBody) {
      console.error("找不到 Mindspace 工作台");
      return;
    }

    librarySection = createElement("section");
    librarySection.id = "mindspaceCloudLibrary";

    librarySection.style.gridColumn = "1 / -1";

    const heading = createElement(
      "h2",
      "☁️ Mindspace 雲端素材庫"
    );

    const description = createElement(
      "p",
      "這裡保存孩子創造的 Plus-Plus 積木作品。選擇作品即可重新加入世界。",
      "muted"
    );

    refreshButton = createElement(
      "button",
      "🔄 重新整理素材庫",
      "action primary"
    );

    galleryStatus = createElement(
      "p",
      "正在準備雲端素材庫……",
      "muted"
    );

    galleryStatus.setAttribute("aria-live", "polite");

    galleryGrid = createElement("div");
    galleryGrid.id = "mindspaceGalleryGrid";

    Object.assign(galleryGrid.style, {
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fill, minmax(130px, 1fr))",
      gap: "12px",
      marginTop: "12px"
    });

    librarySection.append(
      heading,
      description,
      refreshButton,
      galleryStatus,
      galleryGrid
    );

    sidebarBody.appendChild(librarySection);

    refreshButton.addEventListener(
      "click",
      refreshGallery
    );
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
    const card = createElement("div");

    Object.assign(card.style, {
      border: "1px solid #dce5ef",
      borderRadius: "14px",
      padding: "10px",
      background: "#f8fbff",
      minWidth: "0"
    });

    const image = document.createElement("img");

    Object.assign(image.style, {
      width: "100%",
      height: "110px",
      objectFit: "contain",
      borderRadius: "10px",
      background: "#eaf1f8"
    });

    image.alt = asset.name || "積木作品";

    const title = createElement(
      "div",
      asset.name || "未命名作品"
    );

    Object.assign(title.style, {
      fontWeight: "bold",
      fontSize: "13px",
      marginTop: "8px",
      overflowWrap: "anywhere"
    });

    const typeLabel = createElement(
      "div",
      asset.type === "environment"
        ? "🏰 環境"
        : "🐉 角色"
    );

    Object.assign(typeLabel.style, {
      fontSize: "12px",
      color: "#64748b",
      margin: "5px 0"
    });

    const addButton = createElement(
      "button",
      "＋ 加入世界",
      "action primary"
    );

    addButton.style.fontSize = "12px";

    card.append(
      image,
      title,
      typeLabel,
      addButton
    );

    let objectURL = null;

    try {
      const blob = await LIB().loadAssetBlob(asset);

      objectURL = URL.createObjectURL(blob);
      image.src = objectURL;

      image.addEventListener(
        "load",
        () => {
          if (objectURL) {
            URL.revokeObjectURL(objectURL);
            objectURL = null;
          }
        },
        { once: true }
      );

      image.addEventListener(
        "error",
        () => {
          if (objectURL) {
            URL.revokeObjectURL(objectURL);
            objectURL = null;
          }
        },
        { once: true }
      );

    } catch (error) {
      console.warn(
        "素材圖片載入失敗",
        asset.id,
        error
      );

      image.alt = "圖片載入失敗";
      addButton.disabled = true;
      addButton.textContent = "圖片無法載入";
    }

    addButton.addEventListener("click", async () => {
      addButton.disabled = true;
      addButton.textContent = "加入中……";

      try {
        await addAssetToWorld(asset);

        addButton.textContent = "✓ 已加入";

      } catch (error) {
        console.error(error);

        addButton.textContent = "重試加入";
        setStatus(
          "加入世界失敗：" + error.message,
          true
        );

      } finally {
        addButton.disabled = false;
      }
    });

    return card;
  }

  // =====================================
  // 06｜將素材加入 p5.js 世界
  // =====================================

  async function addAssetToWorld(asset) {
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
    const creationId =
      await window.addMindspaceCreation(dataURL);

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

    document
      .getElementById("sidebar")
      ?.classList.remove("open");

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
