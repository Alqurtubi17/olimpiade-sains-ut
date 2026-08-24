import { broadcastState } from "./sync-engine.js";

const NS = "olimpiade2026";

function storageKey(key, shared) {
  return `${NS}:${shared ? "shared" : "personal"}:${key}`;
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error("storage-shim get error", e);
    return null;
  }
}

let activeSyncRoomId = null;

export function setActiveSyncRoom(roomId) {
  activeSyncRoomId = roomId;
}

export const storageShim = {
  async get(key, shared = false) {
    const raw = safeGet(storageKey(key, shared));
    if (raw === null || raw === undefined) return null;
    return { key, value: raw, shared };
  },

  async set(key, value, shared = false) {
    try {
      localStorage.setItem(storageKey(key, shared), value);
      return { key, value, shared };
    } catch (e) {
      console.error("storage-shim set error", e);
      return null;
    }
  },

  async delete(key, shared = false) {
    try {
      localStorage.removeItem(storageKey(key, shared));
      return { key, deleted: true, shared };
    } catch (e) {
      console.error("storage-shim delete error", e);
      return null;
    }
  },

  async list(prefix = "", shared = false) {
    try {
      const fullPrefix = storageKey(prefix, shared);
      const scopePrefix = `${NS}:${shared ? "shared" : "personal"}:`;
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) {
          keys.push(k.slice(scopePrefix.length));
        }
      }
      return { keys, prefix, shared };
    } catch (e) {
      console.error("storage-shim list error", e);
      return null;
    }
  },
};

if (typeof window !== "undefined") {
  window.storage = storageShim;
}
