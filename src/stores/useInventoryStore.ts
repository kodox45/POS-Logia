// ============================================================
// Inventory Store — Domain: inventory
// DB tables: inventoryItems, stockMovements
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';
import type { InventoryItem, StockMovement } from '@/types';
import type { StockStatus } from '@/types/enums';
import { notifySync } from '@/sync/sync-trigger';

function generateId(): string {
  return crypto.randomUUID();
}

function computeStockStatus(quantity: number, threshold?: number): StockStatus {
  if (!threshold) return 'ok';
  if (quantity <= 0) return 'critical';
  if (quantity <= threshold) return 'low';
  return 'ok';
}

export interface InventoryState {
  // State
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  loading: boolean;
  error: string | null;

  // Actions
  loadInventoryItems: () => Promise<void>;
  addStock: (data: { itemName: string; quantity: number; unit: string; minimumThreshold?: number }) => Promise<InventoryItem>;
  updateItem: (id: string, updates: Partial<Pick<InventoryItem, 'itemName' | 'unit' | 'minimumThreshold'>>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  restockItem: (itemId: string, quantity: number, reason: string, performedBy: string) => Promise<void>;
  deductStock: (itemId: string, quantity: number, orderId: string, performedBy: string) => Promise<void>;
  adjustStock: (itemId: string, newQuantity: number, reason: string, performedBy: string) => Promise<void>;
  checkThreshold: (itemId: string) => Promise<boolean>;
  getMovementHistory: (itemId: string) => Promise<StockMovement[]>;
  loadMovements: (itemId: string) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      inventoryItems: [],
      stockMovements: [],
      loading: false,
      error: null,

      loadInventoryItems: async () => {
        set({ loading: true, error: null });
        try {
          const items = await db.inventoryItems.toArray();
          set({ inventoryItems: items, loading: false });
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      addStock: async (data) => {
        set({ loading: true, error: null });
        try {
          const now = new Date().toISOString();
          const status = computeStockStatus(data.quantity, data.minimumThreshold);
          const item: InventoryItem = {
            id: generateId(),
            itemName: data.itemName,
            quantity: data.quantity,
            unit: data.unit,
            minimumThreshold: data.minimumThreshold,
            stockStatus: status,
            syncId: generateId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };
          await db.inventoryItems.add(item);

          const movement: StockMovement = {
            id: generateId(),
            inventoryItemId: item.id,
            movementType: 'restock',
            quantityChange: data.quantity,
            reason: 'Stok awal',
            performedBy: 'system',
            syncId: generateId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };
          await db.stockMovements.add(movement);

          set((state) => ({
            inventoryItems: [...state.inventoryItems, item],
            loading: false,
          }));
          notifySync();
          return item;
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
          throw e;
        }
      },

      updateItem: async (id, updates) => {
        set({ loading: true, error: null });
        try {
          const now = new Date().toISOString();
          const item = get().inventoryItems.find((i) => i.id === id);
          if (!item) throw new Error('Item not found');

          const newThreshold = updates.minimumThreshold !== undefined ? updates.minimumThreshold : item.minimumThreshold;
          const newStatus = computeStockStatus(item.quantity, newThreshold);

          await db.inventoryItems.update(id, {
            ...updates,
            stockStatus: newStatus,
            updatedAt: now,
            syncStatus: 'pending',
          });

          set((state) => ({
            inventoryItems: state.inventoryItems.map((i) =>
              i.id === id ? { ...i, ...updates, stockStatus: newStatus, updatedAt: now, syncStatus: 'pending' as const } : i
            ),
            loading: false,
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      deleteItem: async (id) => {
        set({ loading: true, error: null });
        try {
          const hasIngredients = await db.recipeIngredients.where('inventoryItemId').equals(id).count();
          if (hasIngredients > 0) {
            set({ error: 'Tidak dapat menghapus item yang digunakan oleh resep', loading: false });
            return;
          }
          await db.inventoryItems.delete(id);
          set((state) => ({
            inventoryItems: state.inventoryItems.filter((i) => i.id !== id),
            loading: false,
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      restockItem: async (itemId, quantity, reason, performedBy) => {
        try {
          const now = new Date().toISOString();
          await db.transaction('rw', [db.inventoryItems, db.stockMovements], async () => {
            const item = await db.inventoryItems.get(itemId);
            if (!item) throw new Error('Item not found');

            const newQty = item.quantity + quantity;
            const newStatus = computeStockStatus(newQty, item.minimumThreshold);

            await db.inventoryItems.update(itemId, {
              quantity: newQty,
              stockStatus: newStatus,
              updatedAt: now,
              syncStatus: 'pending',
            });

            await db.stockMovements.add({
              id: generateId(),
              inventoryItemId: itemId,
              movementType: 'restock',
              quantityChange: quantity,
              reason,
              performedBy,
              syncId: generateId(),
              syncStatus: 'pending',
              createdAt: now,
              updatedAt: now,
            });
          });

          const items = await db.inventoryItems.toArray();
          set({ inventoryItems: items });
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      deductStock: async (itemId, quantity, orderId, performedBy) => {
        try {
          const now = new Date().toISOString();
          await db.transaction('rw', [db.inventoryItems, db.stockMovements], async () => {
            const item = await db.inventoryItems.get(itemId);
            if (!item) throw new Error('Item not found');

            const newQty = Math.max(0, item.quantity - quantity);
            const newStatus = computeStockStatus(newQty, item.minimumThreshold);

            await db.inventoryItems.update(itemId, {
              quantity: newQty,
              stockStatus: newStatus,
              updatedAt: now,
              syncStatus: 'pending',
            });

            await db.stockMovements.add({
              id: generateId(),
              inventoryItemId: itemId,
              movementType: 'auto_deduction',
              quantityChange: -quantity,
              reason: `Deduction for order`,
              orderId,
              performedBy,
              syncId: generateId(),
              syncStatus: 'pending',
              createdAt: now,
              updatedAt: now,
            });
          });

          const items = await db.inventoryItems.toArray();
          set({ inventoryItems: items });
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      adjustStock: async (itemId, newQuantity, reason, performedBy) => {
        try {
          const now = new Date().toISOString();
          await db.transaction('rw', [db.inventoryItems, db.stockMovements], async () => {
            const item = await db.inventoryItems.get(itemId);
            if (!item) throw new Error('Item not found');

            const change = newQuantity - item.quantity;
            const newStatus = computeStockStatus(newQuantity, item.minimumThreshold);

            await db.inventoryItems.update(itemId, {
              quantity: newQuantity,
              stockStatus: newStatus,
              updatedAt: now,
              syncStatus: 'pending',
            });

            await db.stockMovements.add({
              id: generateId(),
              inventoryItemId: itemId,
              movementType: 'manual_adjustment',
              quantityChange: change,
              reason,
              performedBy,
              syncId: generateId(),
              syncStatus: 'pending',
              createdAt: now,
              updatedAt: now,
            });
          });

          const items = await db.inventoryItems.toArray();
          set({ inventoryItems: items });
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      checkThreshold: async (itemId) => {
        const item = await db.inventoryItems.get(itemId);
        if (!item || !item.minimumThreshold) return false;
        return item.quantity <= item.minimumThreshold;
      },

      getMovementHistory: async (itemId) => {
        return await db.stockMovements
          .where('inventoryItemId')
          .equals(itemId)
          .reverse()
          .sortBy('createdAt');
      },

      loadMovements: async (itemId) => {
        try {
          const movements = await db.stockMovements
            .where('inventoryItemId')
            .equals(itemId)
            .reverse()
            .sortBy('createdAt');
          set({ stockMovements: movements });
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },
    }),
    {
      name: 'inventory-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        inventoryItems: state.inventoryItems,
      }),
    }
  )
);
