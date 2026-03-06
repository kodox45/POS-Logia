// ============================================================
// Menu Store — Domain: menu
// DB tables: menuItems, menuCategories
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';
import type { MenuItem, MenuCategory } from '@/types';
import { notifySync } from '@/sync/sync-trigger';

function generateId(): string {
  return crypto.randomUUID();
}

export interface MenuState {
  // State
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  loading: boolean;
  error: string | null;

  // Actions
  loadMenuItems: () => Promise<void>;
  loadCategories: () => Promise<void>;
  addMenuItem: (item: Omit<MenuItem, 'id' | 'syncId' | 'syncStatus' | 'createdAt' | 'updatedAt'>) => Promise<MenuItem>;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  toggleAvailability: (id: string) => Promise<void>;
  filterByCategory: (categoryId: string) => MenuItem[];
  addCategory: (name: string, sortOrder?: number) => Promise<MenuCategory>;
  updateCategory: (id: string, updates: Partial<MenuCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      menuItems: [],
      menuCategories: [],
      loading: false,
      error: null,

      loadMenuItems: async () => {
        set({ loading: true, error: null });
        try {
          const items = await db.menuItems.toArray();
          set({ menuItems: items, loading: false });
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      loadCategories: async () => {
        set({ loading: true, error: null });
        try {
          const categories = await db.menuCategories.orderBy('sortOrder').toArray();
          set({ menuCategories: categories, loading: false });
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      addMenuItem: async (itemData) => {
        set({ loading: true, error: null });
        try {
          const now = new Date().toISOString();
          const item: MenuItem = {
            ...itemData,
            id: generateId(),
            syncId: generateId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };
          await db.menuItems.add(item);
          set((state) => ({
            menuItems: [...state.menuItems, item],
            loading: false,
          }));
          notifySync();
          return item;
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
          throw e;
        }
      },

      updateMenuItem: async (id, updates) => {
        set({ loading: true, error: null });
        try {
          const now = new Date().toISOString();
          await db.menuItems.update(id, { ...updates, updatedAt: now, syncStatus: 'pending' });
          set((state) => ({
            menuItems: state.menuItems.map((item) =>
              item.id === id ? { ...item, ...updates, updatedAt: now, syncStatus: 'pending' as const } : item
            ),
            loading: false,
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      deleteMenuItem: async (id) => {
        set({ loading: true, error: null });
        try {
          await db.menuItems.delete(id);
          set((state) => ({
            menuItems: state.menuItems.filter((item) => item.id !== id),
            loading: false,
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      toggleAvailability: async (id) => {
        const item = get().menuItems.find((i) => i.id === id);
        if (!item) return;
        const now = new Date().toISOString();
        await db.menuItems.update(id, { isAvailable: !item.isAvailable, updatedAt: now, syncStatus: 'pending' });
        set((state) => ({
          menuItems: state.menuItems.map((i) =>
            i.id === id ? { ...i, isAvailable: !i.isAvailable, updatedAt: now, syncStatus: 'pending' as const } : i
          ),
        }));
        notifySync();
      },

      filterByCategory: (categoryId) => {
        return get().menuItems.filter((item) => item.categoryId === categoryId);
      },

      addCategory: async (name, sortOrder = 0) => {
        set({ loading: true, error: null });
        try {
          const now = new Date().toISOString();
          const category: MenuCategory = {
            id: generateId(),
            name,
            sortOrder,
            syncId: generateId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };
          await db.menuCategories.add(category);
          set((state) => ({
            menuCategories: [...state.menuCategories, category],
            loading: false,
          }));
          notifySync();
          return category;
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
          throw e;
        }
      },

      updateCategory: async (id, updates) => {
        set({ loading: true, error: null });
        try {
          const now = new Date().toISOString();
          await db.menuCategories.update(id, { ...updates, updatedAt: now, syncStatus: 'pending' });
          set((state) => ({
            menuCategories: state.menuCategories.map((cat) =>
              cat.id === id ? { ...cat, ...updates, updatedAt: now, syncStatus: 'pending' as const } : cat
            ),
            loading: false,
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      deleteCategory: async (id) => {
        set({ loading: true, error: null });
        try {
          const hasItems = await db.menuItems.where('categoryId').equals(id).count();
          if (hasItems > 0) {
            set({ error: 'Tidak dapat menghapus kategori yang masih memiliki menu', loading: false });
            return;
          }
          await db.menuCategories.delete(id);
          set((state) => ({
            menuCategories: state.menuCategories.filter((cat) => cat.id !== id),
            loading: false,
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },
    }),
    {
      name: 'menu-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        menuItems: state.menuItems,
        menuCategories: state.menuCategories,
      }),
    }
  )
);
