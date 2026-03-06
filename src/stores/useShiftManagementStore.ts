// ============================================================
// Shift Management Store — Domain: shift-management
// DB tables: shifts, voidRecords
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';
import type { Shift, VoidRecord, Transaction } from '@/types';
import { notifySync } from '@/sync/sync-trigger';

export interface ShiftManagementState {
  // State
  shifts: Shift[];
  activeShift: Shift | null;
  voidRecords: VoidRecord[];
  shiftTransactions: Transaction[];
  loading: boolean;
  error: string | null;

  // Actions
  loadShifts: () => Promise<void>;
  openShift: (cashierId: string, openingBalance: number) => Promise<void>;
  closeShift: (shiftId: string, actualCash: number, closingNotes?: string) => Promise<void>;
  getActiveShift: () => Shift | null;
  calculateExpectedCash: (shiftId: string) => Promise<number>;
  recordDiscrepancy: (shiftId: string, actualCash: number, notes: string) => Promise<void>;
  loadShiftTransactions: (shiftId: string) => Promise<void>;
}

export const useShiftManagementStore = create<ShiftManagementState>()(
  persist(
    (set, get) => ({
      shifts: [],
      activeShift: null,
      voidRecords: [],
      shiftTransactions: [],
      loading: false,
      error: null,

      loadShifts: async () => {
        set({ loading: true, error: null });
        try {
          const shifts = await db.shifts.orderBy('shiftStartTime').reverse().toArray();
          const active = shifts.find((s) => s.shiftStatus === 'open') ?? null;
          set({ shifts, activeShift: active, loading: false });
        } catch {
          set({ loading: false, error: 'Gagal memuat data shift' });
        }
      },

      openShift: async (cashierId: string, openingBalance: number) => {
        set({ loading: true, error: null });
        try {
          // Check if there's already an active shift for this cashier
          const existing = await db.shifts
            .where('picCashierId')
            .equals(cashierId)
            .filter((s) => s.shiftStatus === 'open')
            .first();

          if (existing) {
            set({ loading: false, error: 'Sudah ada shift aktif untuk kasir ini' });
            return;
          }

          const now = new Date().toISOString();
          const shiftCount = await db.shifts.count();
          const shiftNumber = `SH-${String(shiftCount + 1).padStart(4, '0')}`;

          const newShift: Shift = {
            id: crypto.randomUUID(),
            shiftNumber,
            picCashierId: cashierId,
            pinVerified: true,
            pinVerifiedAt: now,
            openingBalance,
            shiftStartTime: now,
            expectedCash: openingBalance,
            digitalSalesTotal: 0,
            cashSalesTotal: 0,
            totalRevenue: 0,
            totalTransactions: 0,
            voidCount: 0,
            voidTotalAmount: 0,
            discountTotalGiven: 0,
            shiftStatus: 'open',
            syncId: crypto.randomUUID(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };

          await db.shifts.add(newShift);
          set({ activeShift: newShift, loading: false, error: null });
          notifySync();
        } catch {
          set({ loading: false, error: 'Gagal membuka shift' });
        }
      },

      closeShift: async (shiftId: string, actualCash: number, closingNotes?: string) => {
        set({ loading: true, error: null });
        try {
          const shift = await db.shifts.get(shiftId);
          if (!shift) {
            set({ loading: false, error: 'Shift tidak ditemukan' });
            return;
          }

          if (shift.shiftStatus === 'closed') {
            set({ loading: false, error: 'Shift sudah ditutup' });
            return;
          }

          // Calculate expected cash: opening + cashSales - voidAmount
          const expectedCash = shift.openingBalance + shift.cashSalesTotal - shift.voidTotalAmount;
          const discrepancy = actualCash - expectedCash;

          // If discrepancy exists, notes are mandatory
          if (discrepancy !== 0 && (!closingNotes || closingNotes.trim() === '')) {
            set({ loading: false, error: 'Catatan wajib diisi jika ada selisih kas' });
            return;
          }

          const now = new Date().toISOString();

          await db.shifts.update(shiftId, {
            shiftStatus: 'closed',
            shiftEndTime: now,
            expectedCash,
            actualCash,
            discrepancy,
            closingNotes: closingNotes || undefined,
            updatedAt: now,
          });

          set({ activeShift: null, loading: false, error: null });
          notifySync();
        } catch {
          set({ loading: false, error: 'Gagal menutup shift' });
        }
      },

      getActiveShift: () => {
        return get().activeShift;
      },

      calculateExpectedCash: async (shiftId: string) => {
        const shift = await db.shifts.get(shiftId);
        if (!shift) return 0;
        // Expected cash = opening_balance + cash_sales - cash_refunds_from_voids
        return shift.openingBalance + shift.cashSalesTotal - shift.voidTotalAmount;
      },

      recordDiscrepancy: async (shiftId: string, actualCash: number, notes: string) => {
        const shift = await db.shifts.get(shiftId);
        if (!shift) return;
        const expectedCash = shift.openingBalance + shift.cashSalesTotal - shift.voidTotalAmount;
        const discrepancy = actualCash - expectedCash;
        await db.shifts.update(shiftId, {
          actualCash,
          discrepancy,
          closingNotes: notes,
          updatedAt: new Date().toISOString(),
        });
        notifySync();
      },

      loadShiftTransactions: async (shiftId: string) => {
        try {
          const transactions = await db.transactions
            .where('shiftId')
            .equals(shiftId)
            .toArray();
          const voidRecords = await db.voidRecords
            .where('shiftId')
            .equals(shiftId)
            .toArray();
          set({ shiftTransactions: transactions, voidRecords });
        } catch {
          set({ error: 'Gagal memuat transaksi shift' });
        }
      },
    }),
    {
      name: 'shift-management-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        activeShift: state.activeShift,
      }),
    }
  )
);
