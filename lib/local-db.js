const DB_NAME = "multizap-local";
const DB_VERSION = 1;

export function openLocalDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB não disponível neste dispositivo."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("conversations")) {
        const store = db.createObjectStore("conversations", { keyPath: "id" });
        store.createIndex("accountKey", "accountKey", { unique: false });
      }

      if (!db.objectStoreNames.contains("messages")) {
        const store = db.createObjectStore("messages", { keyPath: "localId", autoIncrement: true });
        store.createIndex("chatId", "chatId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("accounts")) {
        db.createObjectStore("accounts", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putRecord(storeName, value) {
  const db = await openLocalDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await requestToPromise(store.put(value));
  db.close();
}

export async function addRecord(storeName, value) {
  const db = await openLocalDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const id = await requestToPromise(store.add(value));
  db.close();
  return id;
}

export async function getAllRecords(storeName) {
  const db = await openLocalDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const rows = await requestToPromise(store.getAll());
  db.close();
  return rows;
}

export async function getMessagesByChat(chatId) {
  const db = await openLocalDB();
  const tx = db.transaction("messages", "readonly");
  const store = tx.objectStore("messages");
  const index = store.index("chatId");
  const rows = await requestToPromise(index.getAll(IDBKeyRange.only(chatId)));
  db.close();
  return rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function saveLocalMessage({ chatId, accountKey, from, text, time, status = "local" }) {
  return addRecord("messages", {
    chatId,
    accountKey,
    from,
    text,
    time,
    status,
    createdAt: Date.now()
  });
}

export async function seedLocalData(accounts, chatsByAccount) {
  for (const account of accounts) {
    await putRecord("accounts", account);
  }

  for (const [accountKey, chats] of Object.entries(chatsByAccount)) {
    for (const chat of chats) {
      await putRecord("conversations", { ...chat, accountKey });
    }
  }
}

export async function exportLocalDatabase() {
  const [accounts, conversations, messages, settings] = await Promise.all([
    getAllRecords("accounts"),
    getAllRecords("conversations"),
    getAllRecords("messages"),
    getAllRecords("settings")
  ]);

  return {
    exportedAt: new Date().toISOString(),
    database: DB_NAME,
    accounts,
    conversations,
    messages,
    settings
  };
}

export async function clearLocalDatabase() {
  const db = await openLocalDB();
  const stores = ["accounts", "conversations", "messages", "settings"];
  const tx = db.transaction(stores, "readwrite");
  for (const storeName of stores) {
    tx.objectStore(storeName).clear();
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}