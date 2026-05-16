(function () {
  const DB_NAME = "stillpoint-therapy-db";
  const DB_VERSION = 2;
  const LEGACY_STORAGE_KEY = "stillpoint-therapy-companion-v1";
  const META_STORE = "meta";
  const SAFETY_PLAN_KEY = "active";
  const STORE_LIMITS = {
    moods: 60,
    journals: 80,
    reframes: 40,
    bodyNotes: 30,
    agentMessages: 80,
  };

  const entryStores = Object.keys(STORE_LIMITS);

  function createEmptyState() {
    return {
      moods: [],
      journals: [],
      reframes: [],
      bodyNotes: [],
      agentMessages: [],
      safetyPlan: {
        warning: "",
        reasons: "",
        contacts: "",
        environment: "",
      },
    };
  }

  function openDatabase() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("IndexedDB is not available."));
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        entryStores.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: "id" });
            store.createIndex("createdAt", "createdAt");
          }
        });

        if (!db.objectStoreNames.contains("safetyPlan")) {
          db.createObjectStore("safetyPlan", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Database upgrade was blocked by another tab."));
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionComplete(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Database transaction aborted."));
    });
  }

  function getStorage() {
    try {
      const storage = window.localStorage;
      const testKey = `${LEGACY_STORAGE_KEY}-test`;
      storage.setItem(testKey, "ok");
      storage.removeItem(testKey);
      return storage;
    } catch (error) {
      return null;
    }
  }

  function loadLegacyState() {
    try {
      const saved = getStorage()?.getItem(LEGACY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn("Could not read legacy Stillpoint data", error);
      return null;
    }
  }

  async function hasMigrated(db) {
    const transaction = db.transaction(META_STORE, "readonly");
    const record = await requestToPromise(transaction.objectStore(META_STORE).get("legacyMigration"));
    return Boolean(record?.value);
  }

  async function markMigrated(db) {
    const transaction = db.transaction(META_STORE, "readwrite");
    transaction.objectStore(META_STORE).put({
      key: "legacyMigration",
      value: true,
      updatedAt: new Date().toISOString(),
    });
    await transactionComplete(transaction);
  }

  async function migrateLegacyState(db) {
    if (await hasMigrated(db)) {
      return;
    }

    const legacyState = loadLegacyState();
    if (legacyState) {
      await saveToIndexedDb(db, normalizeState(legacyState));
    }
    await markMigrated(db);
  }

  function normalizeState(rawState) {
    const empty = createEmptyState();
    if (!rawState || typeof rawState !== "object") {
      return empty;
    }

    return {
      moods: Array.isArray(rawState.moods) ? rawState.moods.slice(0, STORE_LIMITS.moods) : [],
      journals: Array.isArray(rawState.journals)
        ? rawState.journals.slice(0, STORE_LIMITS.journals)
        : [],
      reframes: Array.isArray(rawState.reframes)
        ? rawState.reframes.slice(0, STORE_LIMITS.reframes)
        : [],
      bodyNotes: Array.isArray(rawState.bodyNotes)
        ? rawState.bodyNotes.slice(0, STORE_LIMITS.bodyNotes)
        : [],
      agentMessages: Array.isArray(rawState.agentMessages)
        ? rawState.agentMessages.slice(0, STORE_LIMITS.agentMessages)
        : [],
      safetyPlan: {
        ...empty.safetyPlan,
        ...(rawState.safetyPlan || {}),
      },
    };
  }

  async function readAllByDate(db, storeName) {
    const transaction = db.transaction(storeName, "readonly");
    const records = await requestToPromise(transaction.objectStore(storeName).getAll());
    return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function loadFromIndexedDb(db) {
    const state = createEmptyState();
    await migrateLegacyState(db);

    await Promise.all(
      entryStores.map(async (storeName) => {
        state[storeName] = await readAllByDate(db, storeName);
      }),
    );

    const transaction = db.transaction("safetyPlan", "readonly");
    const safetyPlan = await requestToPromise(
      transaction.objectStore("safetyPlan").get(SAFETY_PLAN_KEY),
    );
    if (safetyPlan) {
      state.safetyPlan = {
        ...state.safetyPlan,
        warning: safetyPlan.warning || "",
        reasons: safetyPlan.reasons || "",
        contacts: safetyPlan.contacts || "",
        environment: safetyPlan.environment || "",
      };
    }

    return state;
  }

  async function clearStore(db, storeName) {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    await transactionComplete(transaction);
  }

  async function saveEntries(db, storeName, entries) {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    entries.slice(0, STORE_LIMITS[storeName]).forEach((entry) => store.put(entry));
    await transactionComplete(transaction);
  }

  async function saveSafetyPlan(db, safetyPlan) {
    const transaction = db.transaction("safetyPlan", "readwrite");
    transaction.objectStore("safetyPlan").put({
      id: SAFETY_PLAN_KEY,
      ...safetyPlan,
      updatedAt: new Date().toISOString(),
    });
    await transactionComplete(transaction);
  }

  async function saveToIndexedDb(db, state) {
    await Promise.all(entryStores.map((storeName) => clearStore(db, storeName)));
    await Promise.all(entryStores.map((storeName) => saveEntries(db, storeName, state[storeName] || [])));
    await saveSafetyPlan(db, state.safetyPlan || createEmptyState().safetyPlan);
  }

  function saveToLocalStorage(state) {
    const storage = getStorage();
    if (storage) {
      storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
    }
  }

  let databasePromise = null;
  let usingIndexedDb = false;

  async function getDatabase() {
    if (!databasePromise) {
      databasePromise = openDatabase();
    }
    return databasePromise;
  }

  async function loadState() {
    try {
      const db = await getDatabase();
      usingIndexedDb = true;
      return normalizeState(await loadFromIndexedDb(db));
    } catch (error) {
      console.warn("Stillpoint is using localStorage fallback.", error);
      usingIndexedDb = false;
      return normalizeState(loadLegacyState());
    }
  }

  async function saveState(state) {
    const normalizedState = normalizeState(state);
    if (usingIndexedDb) {
      try {
        await saveToIndexedDb(await getDatabase(), normalizedState);
        return;
      } catch (error) {
        console.warn("Could not save to IndexedDB; using localStorage fallback.", error);
        usingIndexedDb = false;
      }
    }

    saveToLocalStorage(normalizedState);
  }

  window.StillpointDB = {
    createEmptyState,
    loadState,
    saveState,
    getStatus: () => (usingIndexedDb ? "IndexedDB" : "localStorage fallback"),
  };
})();
