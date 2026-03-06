// ============================================================
// Kitchen Store — Domain: kitchen
// DB tables: orders, kitchenNotifications
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';
import type { Order, KitchenNotification, OrderItem } from '@/types';
import { notifySync } from '@/sync/sync-trigger';

const LATE_THRESHOLD_MINUTES = 15;

function generateId(): string {
  return crypto.randomUUID();
}

export interface KitchenOrderView extends Order {
  items: OrderItem[];
  tableNumber: number;
  elapsedMinutes: number;
  isLate: boolean;
}

export interface KitchenState {
  // State
  orderQueue: KitchenOrderView[];
  kitchenNotifications: KitchenNotification[];
  loading: boolean;
  error: string | null;

  // Actions
  getOrderQueue: () => Promise<void>;
  startCooking: (orderId: string) => Promise<void>;
  markReady: (orderId: string) => Promise<void>;
  confirmServed: (orderId: string) => Promise<void>;
  getReadyNotifications: () => KitchenNotification[];
  acknowledgeNotification: (notificationId: string) => Promise<void>;
  loadNotifications: () => Promise<void>;
}

function computeElapsedMinutes(order: Order): number {
  const start = order.cookingStartedAt
    ? new Date(order.cookingStartedAt).getTime()
    : new Date(order.createdAt).getTime();
  return Math.floor((Date.now() - start) / 60000);
}

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set, get) => ({
      orderQueue: [],
      kitchenNotifications: [],
      loading: false,
      error: null,

      getOrderQueue: async () => {
        set({ loading: true, error: null });
        try {
          const orders = await db.orders
            .where('orderStatus')
            .anyOf(['pending', 'cooking', 'ready'])
            .toArray();

          const orderViews: KitchenOrderView[] = await Promise.all(
            orders.map(async (order) => {
              const items = await db.orderItems
                .where('orderId')
                .equals(order.id)
                .toArray();

              const table = await db.restaurantTables.get(order.tableId);
              const elapsedMinutes = computeElapsedMinutes(order);

              return {
                ...order,
                items,
                tableNumber: table?.tableNumber ?? 0,
                elapsedMinutes,
                isLate: elapsedMinutes >= LATE_THRESHOLD_MINUTES,
              };
            })
          );

          orderViews.sort((a, b) => {
            const statusOrder = { pending: 0, cooking: 1, ready: 2 };
            const aOrder = statusOrder[a.orderStatus as keyof typeof statusOrder] ?? 3;
            const bOrder = statusOrder[b.orderStatus as keyof typeof statusOrder] ?? 3;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

          set({ orderQueue: orderViews, loading: false });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to load order queue', loading: false });
        }
      },

      startCooking: async (orderId: string) => {
        set({ error: null });
        try {
          const now = new Date().toISOString();
          await db.orders.update(orderId, {
            orderStatus: 'cooking',
            cookingStartedAt: now,
            updatedAt: now,
            syncStatus: 'pending',
          });
          await get().getOrderQueue();
          notifySync();
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to start cooking' });
        }
      },

      markReady: async (orderId: string) => {
        set({ error: null });
        try {
          const now = new Date().toISOString();
          await db.transaction('rw', [db.orders, db.kitchenNotifications, db.orderItems, db.restaurantTables], async () => {
            const order = await db.orders.get(orderId);
            if (!order) throw new Error('Order not found');

            await db.orders.update(orderId, {
              orderStatus: 'ready',
              readyAt: now,
              updatedAt: now,
              syncStatus: 'pending',
            });

            const table = await db.restaurantTables.get(order.tableId);
            const items = await db.orderItems
              .where('orderId')
              .equals(orderId)
              .toArray();
            const itemSummary = items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ');

            await db.kitchenNotifications.add({
              id: generateId(),
              orderId,
              tableNumber: table?.tableNumber ?? 0,
              items: itemSummary,
              isAcknowledged: false,
              syncId: generateId(),
              syncStatus: 'pending',
              createdAt: now,
              updatedAt: now,
            });
          });
          await get().getOrderQueue();
          await get().loadNotifications();
          notifySync();
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to mark ready' });
        }
      },

      confirmServed: async (orderId: string) => {
        set({ error: null });
        try {
          const now = new Date().toISOString();
          await db.transaction('rw', [db.orders, db.kitchenNotifications], async () => {
            await db.orders.update(orderId, {
              orderStatus: 'served',
              updatedAt: now,
              syncStatus: 'pending',
            });

            const notifications = await db.kitchenNotifications
              .where('orderId')
              .equals(orderId)
              .toArray();
            for (const n of notifications) {
              await db.kitchenNotifications.update(n.id, {
                isAcknowledged: true,
                updatedAt: now,
                syncStatus: 'pending',
              });
            }
          });
          await get().getOrderQueue();
          await get().loadNotifications();
          notifySync();
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to confirm served' });
        }
      },

      getReadyNotifications: () => {
        return get().kitchenNotifications.filter((n) => !n.isAcknowledged);
      },

      acknowledgeNotification: async (notificationId: string) => {
        set({ error: null });
        try {
          const now = new Date().toISOString();
          const notification = await db.kitchenNotifications.get(notificationId);
          if (!notification) throw new Error('Notification not found');

          await db.transaction('rw', [db.kitchenNotifications, db.orders], async () => {
            await db.kitchenNotifications.update(notificationId, {
              isAcknowledged: true,
              updatedAt: now,
              syncStatus: 'pending',
            });

            await db.orders.update(notification.orderId, {
              orderStatus: 'served',
              updatedAt: now,
              syncStatus: 'pending',
            });
          });

          await get().getOrderQueue();
          await get().loadNotifications();
          notifySync();
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to acknowledge notification' });
        }
      },

      loadNotifications: async () => {
        try {
          const notifications = await db.kitchenNotifications
            .where('isAcknowledged')
            .equals(0)
            .toArray();
          set({ kitchenNotifications: notifications });
        } catch {
          const allNotifications = await db.kitchenNotifications.toArray();
          set({ kitchenNotifications: allNotifications.filter((n) => !n.isAcknowledged) });
        }
      },
    }),
    {
      name: 'kitchen-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        orderQueue: state.orderQueue,
        kitchenNotifications: state.kitchenNotifications,
      }),
    }
  )
);
