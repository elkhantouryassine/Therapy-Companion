(function () {
  const DB_NAME = "stillpoint-therapy-db";
  const DB_VERSION = 3;
  const LEGACY_STORAGE_KEY = "stillpoint-therapy-companion-v1";
  const META_STORE = "meta";
  const SESSION_STORE = "session";
  const USERS_STORE = "users";
  const CURRENT_USER_KEY = "currentUser";
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
          let store;
          if (!db.objectStoreNames.contains(storeName)) {
            store = db.createObjectStore(storeName, { keyPath: "id" });
            store.createIndex("createdAt", "createdAt");
          } else {
            store = request.transaction.objectStore(storeName);
          }

          if (!store.indexNames.contains("userId")) {
            store.createIndex("userId", "userId");
          }
        });

        if (!db.objectStoreNames.contains("safetyPlan")) {
          db.createObjectStore("safetyPlan", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(USERS_STORE)) {
          const users = db.createObjectStore(USERS_STORE, { keyPath: "id" });
          users.createIndex("email", "email", { unique: true });
        }

        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          db.createObjectStore(SESSION_STORE, { keyPath: "key" });
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

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
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

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  function makeSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  }

  async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: base64ToBytes(salt),
        iterations: 120000,
      },
      keyMaterial,
      256,
    );
    return bytesToBase64(new Uint8Array(bits));
  }

  async function getUserByEmail(db, email) {
    const transaction = db.transaction(USERS_STORE, "readonly");
    return requestToPromise(transaction.objectStore(USERS_STORE).index("email").get(normalizeEmail(email)));
  }

  async function getUserById(db, userId) {
    if (!userId) return null;
    const transaction = db.transaction(USERS_STORE, "readonly");
    return requestToPromise(transaction.objectStore(USERS_STORE).get(userId));
  }

  async function setSession(db, userId) {
    const transaction = db.transaction(SESSION_STORE, "readwrite");
    transaction.objectStore(SESSION_STORE).put({
      key: CURRENT_USER_KEY,
      userId,
      updatedAt: new Date().toISOString(),
    });
    await transactionComplete(transaction);
  }

  async function clearSession(db) {
    const transaction = db.transaction(SESSION_STORE, "readwrite");
    transaction.objectStore(SESSION_STORE).delete(CURRENT_USER_KEY);
    await transactionComplete(transaction);
  }

  async function getSessionUserId(db) {
    const transaction = db.transaction(SESSION_STORE, "readonly");
    const session = await requestToPromise(transaction.objectStore(SESSION_STORE).get(CURRENT_USER_KEY));
    return session?.userId || "";
  }

  async function createAccount({ name, email, password }) {
    const db = await getDatabase();
    const normalizedEmail = normalizeEmail(email);
    if (!name?.trim()) {
      throw new Error("Add your name.");
    }
    if (!normalizedEmail.includes("@")) {
      throw new Error("Use a valid email address.");
    }
    if (String(password || "").length < 8) {
      throw new Error("Use at least 8 characters for the password.");
    }
    if (await getUserByEmail(db, normalizedEmail)) {
      throw new Error("An account with that email already exists.");
    }

    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordSalt: makeSalt(),
      passwordHash: "",
      createdAt: new Date().toISOString(),
    };
    user.passwordHash = await hashPassword(password, user.passwordSalt);

    const transaction = db.transaction(USERS_STORE, "readwrite");
    transaction.objectStore(USERS_STORE).add(user);
    await transactionComplete(transaction);
    await setSession(db, user.id);
    await claimUnownedData(db, user.id);
    return publicUser(user);
  }

  async function login(email, password) {
    const db = await getDatabase();
    const user = await getUserByEmail(db, email);
    if (!user) {
      throw new Error("No account found for that email.");
    }

    const passwordHash = await hashPassword(password, user.passwordSalt);
    if (passwordHash !== user.passwordHash) {
      throw new Error("That password does not match.");
    }

    await setSession(db, user.id);
    return publicUser(user);
  }

  async function logout() {
    await clearSession(await getDatabase());
  }

  async function getCurrentUser() {
    const db = await getDatabase();
    return publicUser(await getUserById(db, await getSessionUserId(db)));
  }

  async function claimUnownedData(db, userId) {
    const legacyState = normalizeState(loadLegacyState());

    await Promise.all(
      entryStores.map(async (storeName) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const records = await requestToPromise(store.getAll());
        records
          .filter((record) => !record.userId)
          .forEach((record) => store.put({ ...record, userId }));

        legacyState[storeName].forEach((record) => {
          store.put({ ...record, userId });
        });
        await transactionComplete(transaction);
      }),
    );

    const safetyPlan = legacyState.safetyPlan || createEmptyState().safetyPlan;
    const safetyTransaction = db.transaction("safetyPlan", "readwrite");
    const safetyStore = safetyTransaction.objectStore("safetyPlan");
    const oldPlan = await requestToPromise(safetyStore.get("active"));
    const userPlan = await requestToPromise(safetyStore.get(userId));
    if (!userPlan && (oldPlan || Object.values(safetyPlan).some(Boolean))) {
      safetyStore.put({
        id: userId,
        ...createEmptyState().safetyPlan,
        ...safetyPlan,
        ...(oldPlan || {}),
        updatedAt: new Date().toISOString(),
      });
    }
    await transactionComplete(safetyTransaction);
  }

  async function readAllByDate(db, storeName, userId) {
    const transaction = db.transaction(storeName, "readonly");
    const records = await requestToPromise(transaction.objectStore(storeName).index("userId").getAll(userId));
    if (storeName === "agentMessages") {
      return records.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function loadFromIndexedDb(db, userId) {
    const state = createEmptyState();

    await Promise.all(
      entryStores.map(async (storeName) => {
        state[storeName] = await readAllByDate(db, storeName, userId);
      }),
    );

    const transaction = db.transaction("safetyPlan", "readonly");
    const safetyPlan = await requestToPromise(transaction.objectStore("safetyPlan").get(userId));
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

  async function clearUserStore(db, storeName, userId) {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const keys = await requestToPromise(store.index("userId").getAllKeys(userId));
    keys.forEach((key) => store.delete(key));
    await transactionComplete(transaction);
  }

  async function saveEntries(db, storeName, entries, userId) {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    entries.slice(0, STORE_LIMITS[storeName]).forEach((entry) => store.put({ ...entry, userId }));
    await transactionComplete(transaction);
  }

  async function saveSafetyPlan(db, safetyPlan, userId) {
    const transaction = db.transaction("safetyPlan", "readwrite");
    transaction.objectStore("safetyPlan").put({
      id: userId,
      ...safetyPlan,
      updatedAt: new Date().toISOString(),
    });
    await transactionComplete(transaction);
  }

  async function saveToIndexedDb(db, state, userId) {
    await Promise.all(entryStores.map((storeName) => clearUserStore(db, storeName, userId)));
    await Promise.all(
      entryStores.map((storeName) => saveEntries(db, storeName, state[storeName] || [], userId)),
    );
    await saveSafetyPlan(db, state.safetyPlan || createEmptyState().safetyPlan, userId);
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
      const userId = await getSessionUserId(db);
      if (!userId) {
        throw new Error("Sign in before loading data.");
      }
      usingIndexedDb = true;
      return normalizeState(await loadFromIndexedDb(db, userId));
    } catch (error) {
      console.warn("Stillpoint could not load the account database.", error);
      usingIndexedDb = false;
      return createEmptyState();
    }
  }

  async function saveState(state) {
    const normalizedState = normalizeState(state);
    if (usingIndexedDb) {
      try {
        const db = await getDatabase();
        const userId = await getSessionUserId(db);
        if (!userId) {
          throw new Error("Sign in before saving data.");
        }
        await saveToIndexedDb(db, normalizedState, userId);
        return;
      } catch (error) {
        console.warn("Could not save to IndexedDB; using localStorage fallback.", error);
        usingIndexedDb = false;
      }
    }

    saveToLocalStorage(normalizedState);
  }

  window.StillpointDB = {
    createAccount,
    createEmptyState,
    getCurrentUser,
    getStatus: () => (usingIndexedDb ? "IndexedDB account database" : "localStorage fallback"),
    loadState,
    login,
    logout,
    saveState,
  };
})();
