
/*
  Mindspace｜Firebase 共用素材庫 V2

  保留：
  1. Firebase 初始化
  2. 匿名登入
  3. 原本共用素材庫
  4. 原始 PNG 上傳
  5. Firestore 作品資料

  新增：
  6. 動物棲地永久儲存
  7. zoneId 園區分類
  8. soundId 聲音來源
  9. 依園區讀取全部歷史作品
  10. 跨裝置即時同步
  11. 防止重複建立作品

  不修改原本 p5.js、OpenAI、
  自由創作及迷宮功能。
*/

import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
  runTransaction,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getBlob,
  getMetadata
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// ==========================================
// 01｜Firebase 設定
// 保留原本 Firebase 專案
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyDB_Z1Y-zQpu372kOryVFBDShSb3vOY7gg",
  authDomain: "mindspace-maze-relay.firebaseapp.com",
  projectId: "mindspace-maze-relay",
  storageBucket: "mindspace-maze-relay.firebasestorage.app",
  messagingSenderId: "600266323883",
  appId: "1:600266323883:web:9b0f51d915b430cec0c4ee",
  measurementId: "G-V724JHK2CM"
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// 02｜資料集合
// ==========================================

const COLLECTIONS = {
  assets: "mindspace_assets",
  animalObjects: "mindspace_animal_world_objects"
};

const ANIMAL_ZONES = [
  "rainforest",
  "temperate",
  "aviary",
  "kids_zoo"
];

const pendingAnimalSaves = new Map();

// ==========================================
// 03｜匿名登入
// ==========================================

let currentUser = null;

const ready = new Promise((resolve, reject) => {

  const unsubscribe = onAuthStateChanged(
    auth,

    async user => {

      if (user) {

        currentUser = user;

        unsubscribe();

        resolve(user);

        return;
      }

      try {

        await signInAnonymously(auth);

      } catch (error) {

        unsubscribe();

        reject(error);
      }
    },

    reject
  );
});

async function requireUser() {

  await ready;

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Firebase 尚未登入");
  }

  currentUser = user;

  return user;
}

// ==========================================
// 04｜共用資料驗證
// ==========================================

function validateId(id) {

  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{10,128}$/.test(id)
  ) {

    throw new Error("作品 ID 格式不正確");
  }

  return id;
}

function validateZone(zoneId) {

  if (!ANIMAL_ZONES.includes(zoneId)) {

    throw new Error(
      "動物園區不存在：" + zoneId
    );
  }

  return zoneId;
}

function validatePNG(pngBlob) {

  if (!(pngBlob instanceof Blob)) {

    throw new Error("請提供 PNG Blob");
  }

  if (
    pngBlob.type !== "image/png" ||
    pngBlob.size <= 0 ||
    pngBlob.size > 5 * 1024 * 1024
  ) {

    throw new Error(
      "圖片必須是 PNG，且大小不可超過 5 MB"
    );
  }
}

function validateType(type) {

  if (
    !["character", "environment"].includes(type)
  ) {

    throw new Error("請指定角色或環境");
  }

  return type;
}

function normalizeName(value, fallback) {

  return (
    String(value || "")
      .trim()
      .slice(0, 100)
    || fallback
  );
}

function validatePosition(value, field) {

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {

    throw new Error(
      field + " 必須介於 0 至 1"
    );
  }

  return value;
}

function validateSize(value) {

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 1
  ) {

    throw new Error(
      "作品大小必須大於 0 且不超過 1"
    );
  }

  return value;
}

// ==========================================
// 05｜讀取原本共用素材庫
// 保留原本的 API 與讀取方式
// ==========================================

async function listAssets(maxCount = 30) {

  await requireUser();

  const count = Math.max(
    1,
    Math.min(
      100,
      Math.floor(Number(maxCount) || 30)
    )
  );

  const snapshot = await getDocs(

    query(
      collection(db, COLLECTIONS.assets),
      limit(count)
    )
  );

  return snapshot.docs.map(item => ({

    ...item.data(),

    id: item.id

  }));
}

// ==========================================
// 06｜取得單一素材資料
// ==========================================

async function getAsset(assetId) {

  await requireUser();

  validateId(assetId);

  const snapshot = await getDoc(

    doc(
      db,
      COLLECTIONS.assets,
      assetId
    )
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    ...snapshot.data(),
    id: snapshot.id
  };
}

// ==========================================
// 07｜取得素材原始圖片
// ==========================================

async function loadAssetBlob(asset) {

  await requireUser();

  if (!asset?.imagePath) {

    throw new Error("素材沒有圖片路徑");
  }

  return getBlob(
    ref(storage, asset.imagePath)
  );
}

// ==========================================
// 08｜儲存原始 PNG
//
// 保留原本自由創作功能
// 新增 zoneId 欄位
// ==========================================

async function saveAsset({

  id,
  pngBlob,
  name,
  type,
  creatorName,
  sourceWorld = "free",
  description = "",
  soundId = "",
  zoneId = ""

}) {

  const user = await requireUser();

  validatePNG(pngBlob);

  const assetId = validateId(
    id || crypto.randomUUID()
  );

  validateType(type);

  if (
    !["free", "animal", "maze"]
      .includes(sourceWorld)
  ) {

    throw new Error("來源世界不正確");
  }

  if (zoneId) {

    if (sourceWorld !== "animal") {

      throw new Error(
        "只有動物世界可以指定 zoneId"
      );
    }

    validateZone(zoneId);
  }

  const imagePath =
    `mindspace_assets/${user.uid}/${assetId}.png`;

  const imageRef = ref(
    storage,
    imagePath
  );

  const assetRef = doc(
    db,
    COLLECTIONS.assets,
    assetId
  );

  // 檢查是否已經存在。
  // 不覆蓋任何原始作品。

  const existing = await getDoc(assetRef);

  if (existing.exists()) {

    const old = existing.data();

    if (
      old.creatorUid !== user.uid ||
      old.imagePath !== imagePath ||
      old.sourceWorld !== sourceWorld ||
      old.type !== type ||
      (old.zoneId || "") !== zoneId ||
      (old.soundId || "") !==
        String(soundId || "").slice(0, 100)
    ) {

      throw new Error(
        "作品 ID 已存在且資料不一致"
      );
    }

    return {
      id: assetId,
      imagePath: old.imagePath,
      alreadyExists: true
    };
  }

  // ========================================
  // 檢查圖片是否已經上傳
  //
  // 若先前圖片上傳成功，
  // 但 Firestore 儲存失敗，
  // 可以使用相同 ID 繼續完成儲存。
  // ========================================

  let imageExists = false;

  try {

    const metadata = await getMetadata(imageRef);

    if (
      metadata.contentType !== "image/png" ||
      Number(metadata.size) !== pngBlob.size
    ) {

      throw new Error(
        "既有圖片與目前作品不一致"
      );
    }

    // 確認既有圖片內容相同，
    // 避免不同作品誤用同一個 ID。

    const oldBlob = await getBlob(imageRef);

    const oldBytes = new Uint8Array(
      await oldBlob.arrayBuffer()
    );

    const newBytes = new Uint8Array(
      await pngBlob.arrayBuffer()
    );

    if (
      oldBytes.length !== newBytes.length ||
      !oldBytes.every(
        (value, index) => value === newBytes[index]
      )
    ) {

      throw new Error(
        "既有圖片內容與目前作品不同"
      );
    }

    imageExists = true;

  } catch (error) {

    if (error.code !== "storage/object-not-found") {

      throw error;
    }
  }

  if (!imageExists) {

    await uploadBytes(
      imageRef,
      pngBlob,
      {
        contentType: "image/png"
      }
    );
  }

  const data = {

    creatorUid: user.uid,

    creatorName:
      String(
        creatorName || "小小創作者"
      ).slice(0, 40),

    name: normalizeName(
      name,
      "我的積木作品"
    ),

    type,

    sourceWorld,

    imagePath,

    createdAt: serverTimestamp()
  };

  if (description) {

    data.description =
      String(description).slice(0, 1000);
  }

  if (soundId) {

    data.soundId =
      String(soundId).slice(0, 100);
  }

  if (zoneId) {

    data.zoneId = zoneId;
  }

  // 使用交易避免同時寫入時覆蓋舊資料。

  await runTransaction(db, async transaction => {

    const snapshot = await transaction.get(
      assetRef
    );

    if (snapshot.exists()) {

      const old = snapshot.data();

      if (
        old.creatorUid !== user.uid ||
        old.imagePath !== imagePath ||
        old.sourceWorld !== sourceWorld ||
        old.type !== type ||
        (old.zoneId || "") !== zoneId ||
        (old.soundId || "") !==
          String(soundId || "").slice(0, 100)
      ) {

        throw new Error(
          "作品 ID 已存在且資料不一致"
        );
      }

      return;
    }

    transaction.set(assetRef, data);
  });

  return {
    id: assetId,
    imagePath
  };
}

// ==========================================
// 09｜讀取指定園區的全部歷史作品
//
// 不使用原本素材庫的 100 筆限制。
// 不依 soundId 過濾。
// ==========================================

async function listAnimalWorldObjects(zoneId) {

  await requireUser();

  validateZone(zoneId);

  const worldQuery = query(

    collection(
      db,
      COLLECTIONS.animalObjects
    ),

    where(
      "zoneId",
      "==",
      zoneId
    )
  );

  const snapshot = await getDocs(worldQuery);

  const objects = snapshot.docs.map(item => ({

    ...item.data(),

    id: item.id

  }));

  objects.sort((a, b) => {

    const timeA =
      a.createdAt?.toMillis?.() || 0;

    const timeB =
      b.createdAt?.toMillis?.() || 0;

    return timeA - timeB;
  });

  console.info(

    "[Mindspace Animal] 已讀取園區作品",

    zoneId,

    objects.length
  );

  return objects;
}

// ==========================================
// 10｜取得單一棲地作品
// ==========================================

async function getAnimalWorldObject(objectId) {

  await requireUser();

  validateId(objectId);

  const snapshot = await getDoc(

    doc(
      db,
      COLLECTIONS.animalObjects,
      objectId
    )
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {

    ...snapshot.data(),

    id: snapshot.id
  };
}

// ==========================================
// 11｜儲存棲地作品位置
//
// 已存在的原始素材可重複使用。
// 每次加入棲地使用獨立 objectId。
// ==========================================

async function saveAnimalWorldObject({

  id,
  assetId,
  zoneId,
  soundId = "",
  name,
  type,
  x = 0.5,
  y = 0.7,
  size = 0.15

}) {

  const user = await requireUser();

  const objectId = validateId(
    id || crypto.randomUUID()
  );

  validateId(assetId);

  validateZone(zoneId);

  validatePosition(x, "x");

  validatePosition(y, "y");

  validateSize(size);

  const asset = await getAsset(assetId);

  if (!asset) {

    throw new Error(
      "找不到對應的雲端原始素材"
    );
  }

  const objectType = validateType(
    type || asset.type
  );

  const objectName = normalizeName(

    name || asset.name,

    "我的積木作品"
  );

  const sound = String(
    soundId || ""
  ).slice(0, 100);

  const objectRef = doc(

    db,

    COLLECTIONS.animalObjects,

    objectId
  );

  const data = {

    assetId,

    creatorUid: user.uid,

    zoneId,

    soundId: sound,

    sourceWorld: "animal",

    imagePath: asset.imagePath,

    name: objectName,

    type: objectType,

    x,

    y,

    size,

    createdAt: serverTimestamp()
  };

  await runTransaction(db, async transaction => {

    const existing = await transaction.get(
      objectRef
    );

    if (existing.exists()) {

      const old = existing.data();

      if (
        old.creatorUid !== user.uid ||
        old.assetId !== assetId ||
        old.zoneId !== zoneId ||
        old.soundId !== sound ||
        old.imagePath !== asset.imagePath ||
        old.type !== objectType ||
        old.name !== objectName ||
        old.x !== x ||
        old.y !== y ||
        old.size !== size
      ) {

        throw new Error(
          "棲地作品 ID 已存在且資料不一致"
        );
      }

      // 相同作品已經成功儲存，
      // 不再新增，也不覆蓋。

      return;
    }

    transaction.set(
      objectRef,
      data
    );
  });

  console.info(

    "[Mindspace Animal] 棲地作品儲存成功",

    objectId,

    zoneId
  );

  return {

    id: objectId,

    assetId,

    zoneId,

    soundId: sound,

    imagePath: asset.imagePath,

    name: objectName,

    type: objectType,

    x,

    y,

    size
  };
}

// ==========================================
// 12｜完整儲存新的動物積木作品
//
// 第一步：原始 PNG 加入共用素材庫
// 第二步：加入指定園區的永久棲地
//
// 圖片只上傳一次。
// ==========================================

function saveAnimalCreation({

  id,
  pngBlob,
  zoneId,
  soundId = "",
  name = "我的積木生物",
  type = "character",
  creatorName = "Mindspace 小小創作者",
  description = "",
  x = 0.5,
  y = 0.7,
  size = 0.15

}) {

  const creationId = validateId(
    id || crypto.randomUUID()
  );

  validateZone(zoneId);

  validatePNG(pngBlob);

  validateType(type);

  validatePosition(x, "x");

  validatePosition(y, "y");

  validateSize(size);

  if (pendingAnimalSaves.has(creationId)) {

    return Promise.reject(
      new Error("這件作品正在儲存，請稍候")
    );
  }

  const task = (async () => {

    // 先儲存原始素材。

    const asset = await saveAsset({

      id: creationId,

      pngBlob,

      name,

      type,

      creatorName,

      sourceWorld: "animal",

      description,

      soundId,

      zoneId
    });

    // 再加入永久共同棲地。

    const object = await saveAnimalWorldObject({

      id: creationId,

      assetId: asset.id,

      zoneId,

      soundId,

      name,

      type,

      x,

      y,

      size
    });

    window.dispatchEvent(

      new CustomEvent(

        "mindspace-animal-creation-saved",

        {
          detail: {
            ...object
          }
        }
      )
    );

    return {

      ...object,

      assetId: asset.id,

      saved: true
    };

  })();

  pendingAnimalSaves.set(
    creationId,
    task
  );

  task.then(

    () => {
      pendingAnimalSaves.delete(creationId);
    },

    () => {
      pendingAnimalSaves.delete(creationId);
    }
  );

  return task;
}

// ==========================================
// 13｜即時監聽指定園區
//
// 其他裝置新增作品後，
// 可以即時同步到目前園區。
//
// 回傳取消監聽函式。
// 離開棲地時必須呼叫。
// ==========================================

function subscribeAnimalWorld(

  zoneId,

  onChange,

  onError = console.error

) {

  validateZone(zoneId);

  if (typeof onChange !== "function") {

    throw new Error(
      "請提供棲地更新回呼函式"
    );
  }

  let cancelled = false;

  let unsubscribe = null;

  requireUser()

    .then(() => {

      if (cancelled) return;

      const worldQuery = query(

        collection(
          db,
          COLLECTIONS.animalObjects
        ),

        where(
          "zoneId",
          "==",
          zoneId
        )
      );

      unsubscribe = onSnapshot(

        worldQuery,

        {
          includeMetadataChanges: true
        },

        snapshot => {

          if (cancelled) return;

          const objects = snapshot.docs.map(

            item => ({

              ...item.data(),

              id: item.id
            })
          );

          objects.sort((a, b) => {

            const timeA =
              a.createdAt?.toMillis?.() || 0;

            const timeB =
              b.createdAt?.toMillis?.() || 0;

            return timeA - timeB;
          });

          onChange(

            objects,

            {

              zoneId,

              count: objects.length,

              fromCache:
                snapshot.metadata.fromCache,

              hasPendingWrites:
                snapshot.metadata.hasPendingWrites
            }
          );
        },

        error => {

          if (!cancelled) {
            onError(error);
          }
        }
      );
    })

    .catch(error => {

      if (!cancelled) {
        onError(error);
      }
    });

  return () => {

    cancelled = true;

    if (unsubscribe) {

      unsubscribe();

      unsubscribe = null;
    }
  };
}

// ==========================================
// 14｜取得棲地作品原始圖片
// ==========================================

async function loadAnimalWorldObjectBlob(object) {

  if (!object?.imagePath) {

    throw new Error(
      "棲地作品缺少原始圖片"
    );
  }

  return loadAssetBlob(object);
}

// ==========================================
// 15｜提供給原本網頁使用
//
// 完整保留 V1 公開 API
// ==========================================

window.MindspaceLibrary = {

  version: "2.0.0",

  ready,

  // 原本素材庫功能

  listAssets,

  loadAssetBlob,

  saveAsset,

  // 新增素材讀取功能

  getAsset,

  // 動物世界永久儲存功能

  saveAnimalCreation,

  saveAnimalWorldObject,

  listAnimalWorldObjects,

  getAnimalWorldObject,

  loadAnimalWorldObjectBlob,

  subscribeAnimalWorld,

  getAnimalZones() {

    return [...ANIMAL_ZONES];
  },

  get currentUser() {

    return auth.currentUser || currentUser;
  }
};

// ==========================================
// 16｜Firebase 連線通知
// 保留原本事件名稱
// ==========================================

ready.then(

  user => {

    console.log(

      "Mindspace Firebase V2 連線成功",

      user.uid
    );

    window.dispatchEvent(

      new CustomEvent(
        "mindspace-library-ready"
      )
    );
  },

  error => {

    console.error(

      "Mindspace Firebase 連線失敗",

      error
    );
  }
);
