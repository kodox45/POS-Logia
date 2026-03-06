// ============================================================
// Dexie-backed storage adapter for Zustand persist middleware
// Bridges Zustand persist to IndexedDB via Dexie
// ============================================================

import Dexie from 'dexie';
import type { StateStorage } from 'zustand/middleware';

// Dedicated Dexie instance for store persistence (separate from entity tables)
class PersistDB extends Dexie {
  storeSnapshots!: Dexie.Table<{ key: string; value: string }, string>;

  constructor() {
    super('LogiaPOS_StoreSnapshots');
    this.version(1).stores({
      storeSnapshots: 'key',
    });
  }
}

const persistDb = new PersistDB();

export const dexieStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const record = await persistDb.storeSnapshots.get(name);
    return record?.value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await persistDb.storeSnapshots.put({ key: name, value });
  },
  removeItem: async (name: string): Promise<void> => {
    await persistDb.storeSnapshots.delete(name);
  },
};
