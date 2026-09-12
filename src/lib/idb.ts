export const idb = {
  dbPromise: typeof window !== 'undefined' ? new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('zeneva_offline_storage', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('keyval');
    };
  }) : Promise.resolve(null),

  async get<T>(key: string): Promise<T | null> {
    const db = await this.dbPromise;
    if (!db) return null;
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('keyval', 'readonly');
        const store = tx.objectStore('keyval');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as T || null);
        request.onerror = () => reject(request.error);
      } catch (e) {
        resolve(null);
      }
    });
  },

  async set(key: string, val: any): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('keyval', 'readwrite');
        const store = tx.objectStore('keyval');
        const request = store.put(val, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e) {
        resolve();
      }
    });
  },

  async remove(key: string): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('keyval', 'readwrite');
        const store = tx.objectStore('keyval');
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e) {
        resolve();
      }
    });
  },

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('keyval', 'readwrite');
        const store = tx.objectStore('keyval');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e) {
        resolve();
      }
    });
  }
};
