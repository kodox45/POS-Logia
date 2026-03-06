// ============================================================
// Order Management Store — Domain: order-management
// DB tables: orders, orderItems, tables
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';
import type { Order, OrderItem, Table } from '@/types';
import type { OrderStatus } from '@/types/enums';
import { notifySync } from '@/sync/sync-trigger';

function genId(): string {
  return crypto.randomUUID();
}

function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `ORD-${dateStr}-${rand}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export interface CreateOrderInput {
  tableId: string;
  waiterId: string;
  shiftId?: string;
  items: Array<{
    menuItemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    specialNotes?: string;
  }>;
  specialNotes?: string;
  discountId?: string;
  discountAmount?: number;
  ppnRate: number;
}

export interface OrderManagementState {
  // State
  orders: Order[];
  orderItems: OrderItem[];
  tables: Table[];
  loading: boolean;
  error: string | null;

  // Actions
  loadOrders: () => Promise<void>;
  loadTables: () => Promise<void>;
  createOrder: (input: CreateOrderInput) => Promise<Order>;
  addItemsToOrder: (orderId: string, items: Array<{
    menuItemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    specialNotes?: string;
  }>) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  getActiveOrders: () => Order[];
  getOrderById: (orderId: string) => Order | undefined;
  getOrderItems: (orderId: string) => OrderItem[];
  getTableById: (tableId: string) => Table | undefined;
  getActiveOrderForTable: (tableId: string) => Order | undefined;
}

export const useOrderManagementStore = create<OrderManagementState>()(
  persist(
    (set, get) => ({
      orders: [],
      orderItems: [],
      tables: [],
      loading: false,
      error: null,

      loadOrders: async () => {
        set({ loading: true, error: null });
        try {
          const orders = await db.orders.toArray();
          const orderItems = await db.orderItems.toArray();
          set({ orders, orderItems, loading: false });
        } catch (err) {
          set({ error: (err as Error).message, loading: false });
        }
      },

      loadTables: async () => {
        set({ loading: true, error: null });
        try {
          const tables = await db.restaurantTables.orderBy('tableNumber').toArray();
          set({ tables, loading: false });
        } catch (err) {
          set({ error: (err as Error).message, loading: false });
        }
      },

      createOrder: async (input: CreateOrderInput) => {
        set({ loading: true, error: null });
        try {
          const orderId = genId();
          const now = nowISO();

          const orderItemRecords: OrderItem[] = input.items.map((item) => ({
            id: genId(),
            orderId,
            menuItemId: item.menuItemId,
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.unitPrice * item.quantity,
            specialNotes: item.specialNotes,
            isAdditional: false,
            cookingStatus: 'pending' as const,
            syncId: genId(),
            syncStatus: 'pending' as const,
            createdAt: now,
            updatedAt: now,
          }));

          const subtotalAmount = orderItemRecords.reduce((sum, i) => sum + i.lineTotal, 0);
          const discountAmount = input.discountAmount ?? 0;
          const ppnAmount = (subtotalAmount - discountAmount) * (input.ppnRate / 100);
          const grandTotal = (subtotalAmount - discountAmount) + ppnAmount;

          const order: Order = {
            id: orderId,
            orderNumber: generateOrderNumber(),
            tableId: input.tableId,
            waiterId: input.waiterId,
            shiftId: input.shiftId,
            orderStatus: 'pending',
            specialNotes: input.specialNotes,
            isAdditional: false,
            discountId: input.discountId,
            discountAmount,
            subtotalAmount,
            ppnRate: input.ppnRate,
            ppnAmount,
            grandTotal,
            syncId: genId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };

          await db.transaction('rw', [db.orders, db.orderItems, db.restaurantTables], async () => {
            await db.orders.add(order);
            await db.orderItems.bulkAdd(orderItemRecords);
            await db.restaurantTables.update(input.tableId, {
              status: 'occupied',
              activeOrderId: orderId,
              updatedAt: now,
            });
          });

          set((state) => ({
            orders: [...state.orders, order],
            orderItems: [...state.orderItems, ...orderItemRecords],
            tables: state.tables.map((t) =>
              t.id === input.tableId
                ? { ...t, status: 'occupied' as const, activeOrderId: orderId, updatedAt: now }
                : t
            ),
            loading: false,
          }));
          notifySync();

          return order;
        } catch (err) {
          set({ error: (err as Error).message, loading: false });
          throw err;
        }
      },

      addItemsToOrder: async (orderId: string, items) => {
        set({ loading: true, error: null });
        try {
          const now = nowISO();
          const existingOrder = get().orders.find((o) => o.id === orderId);
          if (!existingOrder) throw new Error('Order not found');
          if (['paid', 'cancelled', 'voided'].includes(existingOrder.orderStatus)) {
            throw new Error('Cannot add items to a paid/cancelled/voided order');
          }

          const newItems: OrderItem[] = items.map((item) => ({
            id: genId(),
            orderId,
            menuItemId: item.menuItemId,
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.unitPrice * item.quantity,
            specialNotes: item.specialNotes,
            isAdditional: true,
            cookingStatus: 'pending' as const,
            syncId: genId(),
            syncStatus: 'pending' as const,
            createdAt: now,
            updatedAt: now,
          }));

          const additionalSubtotal = newItems.reduce((sum, i) => sum + i.lineTotal, 0);
          const newSubtotal = existingOrder.subtotalAmount + additionalSubtotal;
          const discountAmount = existingOrder.discountAmount ?? 0;
          const ppnAmount = (newSubtotal - discountAmount) * (existingOrder.ppnRate / 100);
          const grandTotal = (newSubtotal - discountAmount) + ppnAmount;

          await db.transaction('rw', [db.orders, db.orderItems], async () => {
            await db.orderItems.bulkAdd(newItems);
            await db.orders.update(orderId, {
              subtotalAmount: newSubtotal,
              ppnAmount,
              grandTotal,
              isAdditional: true,
              updatedAt: now,
            });
          });

          set((state) => ({
            orderItems: [...state.orderItems, ...newItems],
            orders: state.orders.map((o) =>
              o.id === orderId
                ? { ...o, subtotalAmount: newSubtotal, ppnAmount, grandTotal, isAdditional: true, updatedAt: now }
                : o
            ),
            loading: false,
          }));
          notifySync();
        } catch (err) {
          set({ error: (err as Error).message, loading: false });
          throw err;
        }
      },

      updateOrderStatus: async (orderId: string, status: OrderStatus) => {
        set({ loading: true, error: null });
        try {
          const now = nowISO();
          const updates: Partial<Order> = { orderStatus: status, updatedAt: now };

          if (status === 'cooking') updates.cookingStartedAt = now;
          if (status === 'ready') updates.readyAt = now;

          await db.orders.update(orderId, updates);

          // If paid or cancelled, release the table
          if (status === 'paid' || status === 'cancelled') {
            const order = get().orders.find((o) => o.id === orderId);
            if (order) {
              await db.restaurantTables.update(order.tableId, {
                status: 'available',
                activeOrderId: undefined,
                updatedAt: now,
              });
              set((state) => ({
                tables: state.tables.map((t) =>
                  t.id === order.tableId
                    ? { ...t, status: 'available' as const, activeOrderId: undefined, updatedAt: now }
                    : t
                ),
              }));
            }
          }

          set((state) => ({
            orders: state.orders.map((o) =>
              o.id === orderId ? { ...o, ...updates } : o
            ),
            loading: false,
          }));
          notifySync();
        } catch (err) {
          set({ error: (err as Error).message, loading: false });
          throw err;
        }
      },

      cancelOrder: async (orderId: string) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) throw new Error('Order not found');
        if (['paid', 'cancelled', 'voided'].includes(order.orderStatus)) {
          throw new Error('Cannot cancel a paid/cancelled/voided order');
        }
        await get().updateOrderStatus(orderId, 'cancelled');
      },

      getActiveOrders: () => {
        return get().orders.filter(
          (o) => !['paid', 'cancelled', 'voided'].includes(o.orderStatus)
        );
      },

      getOrderById: (orderId: string) => {
        return get().orders.find((o) => o.id === orderId);
      },

      getOrderItems: (orderId: string) => {
        return get().orderItems.filter((i) => i.orderId === orderId);
      },

      getTableById: (tableId: string) => {
        return get().tables.find((t) => t.id === tableId);
      },

      getActiveOrderForTable: (tableId: string) => {
        return get().orders.find(
          (o) => o.tableId === tableId && !['paid', 'cancelled', 'voided'].includes(o.orderStatus)
        );
      },
    }),
    {
      name: 'order-management-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        orders: state.orders,
        orderItems: state.orderItems,
        tables: state.tables,
      }),
    }
  )
);
