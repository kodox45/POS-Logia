// ============================================================
// Settings Store — Domain: settings
// DB tables: posSettings, ewalletProviders, discounts
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';
import type { PosSettings, EwalletProvider, Discount } from '@/types';
import { notifySync } from '@/sync/sync-trigger';

function generateId(): string {
  return crypto.randomUUID();
}

export interface SettingsState {
  // State
  posSettings: PosSettings | null;
  ewalletProviders: EwalletProvider[];
  discounts: Discount[];
  loading: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  getPPNRate: () => number;
  togglePPN: () => Promise<void>;
  updatePPNRate: (rate: number) => Promise<void>;
  getActiveDiscounts: () => Discount[];
  updateRestaurantInfo: (info: Partial<PosSettings>) => Promise<void>;
  configurePaymentMethods: (providers: EwalletProvider[]) => Promise<void>;
  addDiscount: (data: { discountName: string; discountType: 'percentage' | 'fixed_amount'; discountValue: number; appliedTo: 'whole_order' | 'specific_items'; isActive?: boolean }) => Promise<Discount>;
  updateDiscount: (id: string, updates: Partial<Discount>) => Promise<void>;
  deleteDiscount: (id: string) => Promise<void>;
  toggleDiscountActive: (id: string) => Promise<void>;
  initializeSettings: () => Promise<PosSettings>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      posSettings: null,
      ewalletProviders: [],
      discounts: [],
      loading: false,
      error: null,

      loadSettings: async () => {
        set({ loading: true, error: null });
        try {
          const settings = await db.posSettings.toCollection().first();
          const providers = await db.ewalletProviders.toArray();
          const discounts = await db.discounts.toArray();
          set({
            posSettings: settings ?? null,
            ewalletProviders: providers,
            discounts,
            loading: false,
          });
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      getPPNRate: () => {
        return get().posSettings?.ppnRate ?? 11;
      },

      togglePPN: async () => {
        try {
          const settings = get().posSettings;
          if (!settings) return;
          const now = new Date().toISOString();
          const newEnabled = !settings.ppnEnabled;
          await db.posSettings.update(settings.id, {
            ppnEnabled: newEnabled,
            updatedAt: now,
            syncStatus: 'pending',
          });
          set({
            posSettings: { ...settings, ppnEnabled: newEnabled, updatedAt: now, syncStatus: 'pending' as const },
          });
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      updatePPNRate: async (rate: number) => {
        try {
          const settings = get().posSettings;
          if (!settings) return;
          const now = new Date().toISOString();
          await db.posSettings.update(settings.id, {
            ppnRate: rate,
            updatedAt: now,
            syncStatus: 'pending',
          });
          set({
            posSettings: { ...settings, ppnRate: rate, updatedAt: now, syncStatus: 'pending' as const },
          });
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      getActiveDiscounts: () => {
        return get().discounts.filter((d) => d.isActive);
      },

      updateRestaurantInfo: async (info: Partial<PosSettings>) => {
        try {
          const settings = get().posSettings;
          if (!settings) return;
          const now = new Date().toISOString();
          await db.posSettings.update(settings.id, {
            ...info,
            updatedAt: now,
            syncStatus: 'pending',
          });
          set({
            posSettings: { ...settings, ...info, updatedAt: now, syncStatus: 'pending' as const },
          });
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      configurePaymentMethods: async (providers: EwalletProvider[]) => {
        try {
          await db.ewalletProviders.bulkPut(providers);
          set({ ewalletProviders: providers });
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      addDiscount: async (data) => {
        try {
          const now = new Date().toISOString();
          const discount: Discount = {
            id: generateId(),
            discountName: data.discountName,
            discountType: data.discountType,
            discountValue: data.discountValue,
            appliedTo: data.appliedTo,
            isActive: data.isActive ?? true,
            syncId: generateId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };
          await db.discounts.add(discount);
          set((state) => ({
            discounts: [...state.discounts, discount],
          }));
          notifySync();
          return discount;
        } catch (e) {
          set({ error: (e as Error).message });
          throw e;
        }
      },

      updateDiscount: async (id, updates) => {
        try {
          const now = new Date().toISOString();
          await db.discounts.update(id, {
            ...updates,
            updatedAt: now,
            syncStatus: 'pending',
          });
          set((state) => ({
            discounts: state.discounts.map((d) =>
              d.id === id ? { ...d, ...updates, updatedAt: now, syncStatus: 'pending' as const } : d
            ),
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      deleteDiscount: async (id) => {
        try {
          await db.discounts.delete(id);
          set((state) => ({
            discounts: state.discounts.filter((d) => d.id !== id),
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      toggleDiscountActive: async (id) => {
        try {
          const discount = get().discounts.find((d) => d.id === id);
          if (!discount) return;
          const now = new Date().toISOString();
          const newActive = !discount.isActive;
          await db.discounts.update(id, {
            isActive: newActive,
            updatedAt: now,
            syncStatus: 'pending',
          });
          set((state) => ({
            discounts: state.discounts.map((d) =>
              d.id === id ? { ...d, isActive: newActive, updatedAt: now, syncStatus: 'pending' as const } : d
            ),
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      initializeSettings: async () => {
        const existing = await db.posSettings.toCollection().first();
        if (existing) return existing;
        const now = new Date().toISOString();
        const settings: PosSettings = {
          id: generateId(),
          ppnEnabled: true,
          ppnRate: 11,
          showPpnOnReceipt: true,
          syncId: generateId(),
          syncStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        };
        await db.posSettings.add(settings);
        set({ posSettings: settings });
        notifySync();
        return settings;
      },
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        posSettings: state.posSettings,
        ewalletProviders: state.ewalletProviders,
        discounts: state.discounts,
      }),
    }
  )
);
