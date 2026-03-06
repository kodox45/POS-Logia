// ============================================================
// Payment Store — Domain: payment
// DB tables: transactions, voidRecords
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';
import type { Transaction, VoidRecord, EwalletProvider, Order, Discount } from '@/types';
import type { PaymentMethod, VoidReason, VoidType } from '@/types/enums';
import { notifySync } from '@/sync/sync-trigger';

function genId(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
}

function generateTransactionNumber(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `TXN-${dateStr}-${rand}`;
}

function generateVoidNumber(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `VD-${dateStr}-${rand}`;
}

export interface ProcessPaymentInput {
  orderId: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  digitalPaymentRef?: string;
  transferProofPhotoUrl?: string;
  discountId?: string;
  shiftId: string;
  cashierId: string;
  tableNumber: number;
  subtotalAmount: number;
  discountName?: string;
  discountAmount: number;
  ppnRate: number;
}

export interface ProcessVoidInput {
  orderId: string;
  voidType: VoidType;
  voidReason: VoidReason;
  voidNotes?: string;
  voidedBy: string;
  shiftId: string;
  voidAmount: number;
  pinVerifiedAt: string;
}

export interface PaymentState {
  // State
  transactions: Transaction[];
  ewalletProviders: EwalletProvider[];
  loading: boolean;
  error: string | null;

  // Actions
  loadTransactions: () => Promise<void>;
  loadEwalletProviders: () => Promise<void>;
  processPayment: (input: ProcessPaymentInput) => Promise<Transaction>;
  calculatePPN: (subtotal: number, discountAmount: number, ppnRate: number) => number;
  calculateGrandTotal: (subtotal: number, discountAmount: number, ppnAmount: number) => number;
  applyDiscount: (orderId: string, discount: Discount, currentOrder: Order) => Promise<{ discountAmount: number; newPpnAmount: number; newGrandTotal: number }>;
  processVoid: (input: ProcessVoidInput) => Promise<VoidRecord>;
  getTransactionHistory: (shiftId?: string) => Transaction[];
  getTransactionByOrderId: (orderId: string) => Transaction | undefined;
}

export const usePaymentStore = create<PaymentState>()(
  persist(
    (set, get) => ({
      transactions: [],
      ewalletProviders: [],
      loading: false,
      error: null,

      loadTransactions: async () => {
        set({ loading: true, error: null });
        try {
          const transactions = await db.transactions.toArray();
          set({ transactions, loading: false });
        } catch (err) {
          set({ error: (err as Error).message, loading: false });
        }
      },

      loadEwalletProviders: async () => {
        try {
          const ewalletProviders = await db.ewalletProviders.filter((p) => p.isEnabled).toArray();
          set({ ewalletProviders });
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },

      processPayment: async (input: ProcessPaymentInput) => {
        set({ loading: true, error: null });
        try {
          const now = nowISO();
          const ppnAmount = (input.subtotalAmount - input.discountAmount) * (input.ppnRate / 100);
          const grandTotal = (input.subtotalAmount - input.discountAmount) + ppnAmount;

          if (input.amountPaid < grandTotal) {
            throw new Error('Jumlah pembayaran kurang dari total');
          }

          const changeAmount = input.paymentMethod === 'tunai'
            ? input.amountPaid - grandTotal
            : 0;

          const transaction: Transaction = {
            id: genId(),
            transactionNumber: generateTransactionNumber(),
            orderId: input.orderId,
            shiftId: input.shiftId,
            cashierId: input.cashierId,
            tableNumber: input.tableNumber,
            subtotalAmount: input.subtotalAmount,
            discountName: input.discountName,
            discountAmount: input.discountAmount,
            ppnRate: input.ppnRate,
            ppnAmount,
            grandTotal,
            paymentMethod: input.paymentMethod,
            digitalPaymentRef: input.digitalPaymentRef,
            transferProofPhotoUrl: input.transferProofPhotoUrl,
            amountPaid: input.amountPaid,
            changeAmount,
            transactionStatus: 'completed',
            syncId: genId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };

          await db.transaction('rw', [db.transactions, db.orders, db.restaurantTables], async () => {
            await db.transactions.add(transaction);
            await db.orders.update(input.orderId, {
              orderStatus: 'paid',
              updatedAt: now,
            });
            // Find the order to get tableId for releasing the table
            const order = await db.orders.get(input.orderId);
            if (order) {
              await db.restaurantTables.update(order.tableId, {
                status: 'available',
                activeOrderId: undefined,
                updatedAt: now,
              });
            }
          });

          set((state) => ({
            transactions: [...state.transactions, transaction],
            loading: false,
          }));
          notifySync();

          return transaction;
        } catch (err) {
          set({ error: (err as Error).message, loading: false });
          throw err;
        }
      },

      calculatePPN: (subtotal: number, discountAmount: number, ppnRate: number): number => {
        return (subtotal - discountAmount) * (ppnRate / 100);
      },

      calculateGrandTotal: (subtotal: number, discountAmount: number, ppnAmount: number): number => {
        return (subtotal - discountAmount) + ppnAmount;
      },

      applyDiscount: async (orderId: string, discount: Discount, currentOrder: Order) => {
        let discountAmount = 0;
        if (discount.discountType === 'percentage') {
          discountAmount = currentOrder.subtotalAmount * (discount.discountValue / 100);
        } else {
          discountAmount = discount.discountValue;
        }

        const newPpnAmount = (currentOrder.subtotalAmount - discountAmount) * (currentOrder.ppnRate / 100);
        const newGrandTotal = (currentOrder.subtotalAmount - discountAmount) + newPpnAmount;

        await db.orders.update(orderId, {
          discountId: discount.id,
          discountAmount,
          ppnAmount: newPpnAmount,
          grandTotal: newGrandTotal,
          updatedAt: nowISO(),
        });

        notifySync();
        return { discountAmount, newPpnAmount, newGrandTotal };
      },

      processVoid: async (input: ProcessVoidInput) => {
        set({ loading: true, error: null });
        try {
          const now = nowISO();

          const voidRecord: VoidRecord = {
            id: genId(),
            voidNumber: generateVoidNumber(),
            originalOrderId: input.orderId,
            shiftId: input.shiftId,
            voidType: input.voidType,
            voidReason: input.voidReason,
            voidNotes: input.voidNotes,
            voidedBy: input.voidedBy,
            pinVerified: true,
            pinVerifiedAt: input.pinVerifiedAt,
            voidAmount: input.voidAmount,
            syncId: genId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };

          await db.transaction('rw', [db.voidRecords, db.orders, db.transactions, db.restaurantTables], async () => {
            await db.voidRecords.add(voidRecord);
            await db.orders.update(input.orderId, {
              orderStatus: 'voided',
              updatedAt: now,
            });
            // Mark the related transaction as voided
            const txn = await db.transactions.where('orderId').equals(input.orderId).first();
            if (txn) {
              await db.transactions.update(txn.id, {
                transactionStatus: 'voided',
                updatedAt: now,
              });
            }
          });

          set((state) => ({
            transactions: state.transactions.map((t) =>
              t.orderId === input.orderId
                ? { ...t, transactionStatus: 'voided' as const, updatedAt: now }
                : t
            ),
            loading: false,
          }));
          notifySync();

          return voidRecord;
        } catch (err) {
          set({ error: (err as Error).message, loading: false });
          throw err;
        }
      },

      getTransactionHistory: (shiftId?: string) => {
        const txns = get().transactions;
        if (!shiftId) return txns;
        return txns.filter((t) => t.shiftId === shiftId);
      },

      getTransactionByOrderId: (orderId: string) => {
        return get().transactions.find((t) => t.orderId === orderId);
      },
    }),
    {
      name: 'payment-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        transactions: state.transactions,
        ewalletProviders: state.ewalletProviders,
      }),
    }
  )
);
