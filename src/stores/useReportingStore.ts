// ============================================================
// Reporting Store — Domain: reporting
// Computed from: transactions, orders, inventoryItems, shifts
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';

export interface DailySummary {
  date: string;
  totalRevenue: number;
  totalTransactions: number;
  cashTotal: number;
  digitalTotal: number;
  voidCount: number;
  voidAmount: number;
  discountTotal: number;
  averageOrderValue: number;
}

export interface TopSellingItem {
  menuItemId: string;
  itemName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
  percentage: number;
}

export interface ShiftPerformance {
  shiftId: string;
  shiftNumber: string;
  cashierName: string;
  date: string;
  duration: string;
  transactionCount: number;
  revenue: number;
  discrepancy: number;
}

export interface ReportingState {
  // State
  dailySummary: DailySummary | null;
  topSellingItems: TopSellingItem[];
  paymentBreakdown: PaymentBreakdown[];
  revenueByDateRange: { date: string; revenue: number; orderCount: number }[];
  peakHours: { hour: number; orderCount: number; revenue: number }[];
  shiftPerformance: ShiftPerformance[];
  lowStockCount: number;
  loading: boolean;
  error: string | null;

  // Actions
  getDailySummary: (date: string) => Promise<void>;
  getRevenueByDateRange: (startDate: string, endDate: string) => Promise<void>;
  getTopSellingItems: (startDate: string, endDate: string) => Promise<void>;
  getPeakHours: (date: string) => Promise<void>;
  getPaymentBreakdown: (startDate: string, endDate: string) => Promise<void>;
  getShiftPerformance: (startDate: string, endDate: string) => Promise<void>;
  getLowStockCount: () => Promise<void>;
  loadDashboardData: (startDate: string, endDate: string) => Promise<void>;
}

export const useReportingStore = create<ReportingState>()(
  persist(
    (set) => ({
      dailySummary: null,
      topSellingItems: [],
      paymentBreakdown: [],
      revenueByDateRange: [],
      peakHours: [],
      shiftPerformance: [],
      lowStockCount: 0,
      loading: false,
      error: null,

      getDailySummary: async (date: string) => {
        try {
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);

          const transactions = await db.transactions
            .where('createdAt')
            .between(dayStart.toISOString(), dayEnd.toISOString(), true, true)
            .toArray();

          const completed = transactions.filter((t) => t.transactionStatus === 'completed');
          const totalRevenue = completed.reduce((sum, t) => sum + t.grandTotal, 0);
          const cashTotal = completed.filter((t) => t.paymentMethod === 'tunai').reduce((sum, t) => sum + t.grandTotal, 0);
          const digitalTotal = totalRevenue - cashTotal;
          const discountTotal = completed.reduce((sum, t) => sum + (t.discountAmount ?? 0), 0);

          const voidRecords = await db.voidRecords
            .where('createdAt')
            .between(dayStart.toISOString(), dayEnd.toISOString(), true, true)
            .toArray();

          const summary: DailySummary = {
            date,
            totalRevenue,
            totalTransactions: completed.length,
            cashTotal,
            digitalTotal,
            voidCount: voidRecords.length,
            voidAmount: voidRecords.reduce((sum, v) => sum + v.voidAmount, 0),
            discountTotal,
            averageOrderValue: completed.length > 0 ? totalRevenue / completed.length : 0,
          };

          set({ dailySummary: summary });
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      getRevenueByDateRange: async (startDate: string, endDate: string) => {
        try {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          const transactions = await db.transactions
            .where('createdAt')
            .between(start.toISOString(), end.toISOString(), true, true)
            .toArray();

          const completed = transactions.filter((t) => t.transactionStatus === 'completed');
          const byDate = new Map<string, { revenue: number; orderCount: number }>();

          completed.forEach((t) => {
            const dateKey = t.createdAt.substring(0, 10);
            const existing = byDate.get(dateKey) || { revenue: 0, orderCount: 0 };
            existing.revenue += t.grandTotal;
            existing.orderCount += 1;
            byDate.set(dateKey, existing);
          });

          const result = Array.from(byDate.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

          set({ revenueByDateRange: result });
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      getTopSellingItems: async (startDate: string, endDate: string) => {
        try {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          const orders = await db.orders
            .where('createdAt')
            .between(start.toISOString(), end.toISOString(), true, true)
            .toArray();

          const paidOrderIds = new Set(
            orders.filter((o) => o.orderStatus === 'paid').map((o) => o.id)
          );

          const allOrderItems = await db.orderItems.toArray();
          const paidItems = allOrderItems.filter((item) => paidOrderIds.has(item.orderId));

          const itemMap = new Map<string, { itemName: string; totalQuantity: number; totalRevenue: number }>();
          paidItems.forEach((item) => {
            const existing = itemMap.get(item.menuItemId) || {
              itemName: item.itemName,
              totalQuantity: 0,
              totalRevenue: 0,
            };
            existing.totalQuantity += item.quantity;
            existing.totalRevenue += item.lineTotal;
            itemMap.set(item.menuItemId, existing);
          });

          const topItems: TopSellingItem[] = Array.from(itemMap.entries())
            .map(([menuItemId, data]) => ({ menuItemId, ...data }))
            .sort((a, b) => b.totalQuantity - a.totalQuantity)
            .slice(0, 10);

          set({ topSellingItems: topItems });
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      getPeakHours: async (date: string) => {
        try {
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);

          const transactions = await db.transactions
            .where('createdAt')
            .between(dayStart.toISOString(), dayEnd.toISOString(), true, true)
            .toArray();

          const completed = transactions.filter((t) => t.transactionStatus === 'completed');
          const hourMap = new Map<number, { orderCount: number; revenue: number }>();

          completed.forEach((t) => {
            const hour = new Date(t.createdAt).getHours();
            const existing = hourMap.get(hour) || { orderCount: 0, revenue: 0 };
            existing.orderCount += 1;
            existing.revenue += t.grandTotal;
            hourMap.set(hour, existing);
          });

          const result = Array.from(hourMap.entries())
            .map(([hour, data]) => ({ hour, ...data }))
            .sort((a, b) => a.hour - b.hour);

          set({ peakHours: result });
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      getPaymentBreakdown: async (startDate: string, endDate: string) => {
        try {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          const transactions = await db.transactions
            .where('createdAt')
            .between(start.toISOString(), end.toISOString(), true, true)
            .toArray();

          const completed = transactions.filter((t) => t.transactionStatus === 'completed');
          const methodMap = new Map<string, { count: number; total: number }>();

          completed.forEach((t) => {
            const existing = methodMap.get(t.paymentMethod) || { count: 0, total: 0 };
            existing.count += 1;
            existing.total += t.grandTotal;
            methodMap.set(t.paymentMethod, existing);
          });

          const totalCount = completed.length;
          const breakdown: PaymentBreakdown[] = Array.from(methodMap.entries())
            .map(([method, data]) => ({
              method,
              ...data,
              percentage: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
            }))
            .sort((a, b) => b.total - a.total);

          set({ paymentBreakdown: breakdown });
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      getShiftPerformance: async (startDate: string, endDate: string) => {
        try {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          const shifts = await db.shifts
            .where('shiftStartTime')
            .between(start.toISOString(), end.toISOString(), true, true)
            .toArray();

          const users = await db.users.toArray();
          const userMap = new Map(users.map((u) => [u.id, u.displayName]));

          const performance: ShiftPerformance[] = shifts.map((shift) => {
            const startTime = new Date(shift.shiftStartTime);
            const endTime = shift.shiftEndTime ? new Date(shift.shiftEndTime) : new Date();
            const durationMs = endTime.getTime() - startTime.getTime();
            const hours = Math.floor(durationMs / 3600000);
            const minutes = Math.floor((durationMs % 3600000) / 60000);

            return {
              shiftId: shift.id,
              shiftNumber: shift.shiftNumber,
              cashierName: userMap.get(shift.picCashierId) || 'Unknown',
              date: shift.shiftStartTime.substring(0, 10),
              duration: `${hours}j ${minutes}m`,
              transactionCount: shift.totalTransactions,
              revenue: shift.totalRevenue,
              discrepancy: shift.discrepancy ?? 0,
            };
          });

          set({ shiftPerformance: performance });
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      getLowStockCount: async () => {
        try {
          const lowStockItems = await db.inventoryItems
            .where('stockStatus')
            .anyOf(['low', 'critical'])
            .count();
          set({ lowStockCount: lowStockItems });
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      loadDashboardData: async (startDate: string, endDate: string) => {
        set({ loading: true, error: null });
        try {
          const store = useReportingStore.getState();
          await Promise.all([
            store.getDailySummary(startDate),
            store.getRevenueByDateRange(startDate, endDate),
            store.getTopSellingItems(startDate, endDate),
            store.getPeakHours(startDate),
            store.getPaymentBreakdown(startDate, endDate),
            store.getShiftPerformance(startDate, endDate),
            store.getLowStockCount(),
          ]);
          set({ loading: false });
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },
    }),
    {
      name: 'reporting-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        dailySummary: state.dailySummary,
      }),
    }
  )
);
