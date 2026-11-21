
/*
  Mindspace｜Firebase 共用素材庫 V1

  第一階段：
  1. Firebase 初始化
  2. 匿名登入
  3. 讀取共用素材
  4. 上傳原始 PNG
  5. 儲存 Firestore 作品資料

  不修改原本 p5.js 或 OpenAI 功能。
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
  getDocs,
  query,
  limit,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getBlob
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// ==========================================
// 01｜Firebase 設定
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
// 02｜匿名登入
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

// ==========================================
// 03｜讀取素材庫
// ==========================================

async function listAssets(maxCount = 30) {
  await ready;

  const count = Math.max(
    1,
    Math.min(100, Number(maxCount) || 30)
  );

  const snapshot = await getDocs(
    query(
      collection(db, "mindspace_assets"),
      limit(count)
    )
  );

  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

// ==========================================
// 04｜取得素材圖片
// ==========================================

async function loadAssetBlob(asset) {
  await ready;

  if (!asset?.imagePath) {
    throw new Error("素材沒有圖片路徑");
  }

  return getBlob(
    ref(storage, asset.imagePath)
  );
}

// ==========================================
// 05｜儲存原始 PNG
// ==========================================

async function saveAsset({
  id,
  pngBlob,
  name,
  type,
  creatorName,
  sourceWorld = "free",
  description = "",
  soundId = ""
}) {
  const user = await ready;

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

  const assetId = id || crypto.randomUUID();

  if (!/^[A-Za-z0-9_-]{10,128}$/.test(assetId)) {
    throw new Error("作品 ID 格式不正確");
  }

  if (!["character", "environment"].includes(type)) {
    throw new Error("請指定角色或環境");
  }

  if (!["free", "animal", "maze"].includes(sourceWorld)) {
    throw new Error("來源世界不正確");
  }

  const imagePath =
    `mindspace_assets/${user.uid}/${assetId}.png`;

  const imageRef = ref(storage, imagePath);

  // 先上傳圖片，再建立 Firestore 資料
  await uploadBytes(imageRef, pngBlob, {
    contentType: "image/png"
  });

  const data = {
    creatorUid: user.uid,
    creatorName: String(creatorName || "小小創作者")
      .slice(0, 40),
    name: String(name || "我的積木作品")
      .slice(0, 100),
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

  await setDoc(
    doc(db, "mindspace_assets", assetId),
    data
  );

  return {
    id: assetId,
    imagePath
  };
}

// ==========================================
// 06｜提供給原本網頁使用
// ==========================================

window.MindspaceLibrary = {
  ready,
  listAssets,
  loadAssetBlob,
  saveAsset,

  get currentUser() {
    return currentUser;
  }
};

ready.then(
  user => {
    console.log(
      "Mindspace Firebase 連線成功",
      user.uid
    );

    window.dispatchEvent(
      new CustomEvent("mindspace-library-ready")
    );
  },
  error => {
    console.error(
      "Mindspace Firebase 連線失敗",
      error
    );
  }
);
