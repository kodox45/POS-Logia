import prisma from '../../prisma';
import { Prisma } from '@prisma/client';

const CASH_METHODS = ['tunai'];

export async function getDashboard(filters: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);

  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : todayStart;
  const dateTo = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59.999Z') : todayEnd;

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      transactionStatus: 'completed',
    },
    include: {
      order: {
        select: {
          items: {
            select: {
              menuItemId: true,
              itemName: true,
              quantity: true,
              lineTotal: true,
            },
          },
        },
      },
    },
  });

  const totalRevenue = transactions.reduce(
    (sum, t) => sum.add(t.grandTotal),
    new Prisma.Decimal(0),
  );
  const totalOrders = transactions.length;
  const averageOrderValue = totalOrders > 0
    ? totalRevenue.div(totalOrders)
    : new Prisma.Decimal(0);

  // Top selling items
  const itemMap = new Map<string, { menuItemId: string; itemName: string; quantitySold: number; revenue: Prisma.Decimal }>();
  for (const t of transactions) {
    for (const item of t.order.items) {
      const existing = itemMap.get(item.menuItemId);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue = existing.revenue.add(item.lineTotal);
      } else {
        itemMap.set(item.menuItemId, {
          menuItemId: item.menuItemId,
          itemName: item.itemName,
          quantitySold: item.quantity,
          revenue: item.lineTotal,
        });
      }
    }
  }
  const topSellingItems = Array.from(itemMap.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10);

  // Payment method breakdown
  const methodMap = new Map<string, { count: number; total: Prisma.Decimal }>();
  for (const t of transactions) {
    const existing = methodMap.get(t.paymentMethod);
    if (existing) {
      existing.count += 1;
      existing.total = existing.total.add(t.grandTotal);
    } else {
      methodMap.set(t.paymentMethod, { count: 1, total: t.grandTotal });
    }
  }
  const paymentMethodBreakdown = Array.from(methodMap.entries()).map(([method, data]) => ({
    method,
    count: data.count,
    total: data.total,
    percentage: totalOrders > 0
      ? new Prisma.Decimal(data.count).div(totalOrders).mul(100)
      : new Prisma.Decimal(0),
  }));

  // Revenue by hour
  const hourMap = new Map<number, { revenue: Prisma.Decimal; orderCount: number }>();
  for (const t of transactions) {
    const hour = t.createdAt.getHours();
    const existing = hourMap.get(hour);
    if (existing) {
      existing.revenue = existing.revenue.add(t.grandTotal);
      existing.orderCount += 1;
    } else {
      hourMap.set(hour, { revenue: t.grandTotal, orderCount: 1 });
    }
  }
  const revenueByHour = Array.from(hourMap.entries())
    .map(([hour, data]) => ({ hour, revenue: data.revenue, orderCount: data.orderCount }))
    .sort((a, b) => a.hour - b.hour);

  // Low stock count
  const lowStockCount = await prisma.inventoryItem.count({
    where: {
      isDeleted: false,
      stockStatus: { in: ['low', 'critical'] },
    },
  });

  return {
    period: {
      from: dateFrom.toISOString().slice(0, 10),
      to: dateTo.toISOString().slice(0, 10),
    },
    totalRevenue,
    totalOrders,
    averageOrderValue,
    topSellingItems,
    paymentMethodBreakdown,
    revenueByHour,
    lowStockAlertCount: lowStockCount,
  };
}

export async function getSalesSummary(filters: {
  dateFrom: string;
  dateTo: string;
  groupBy?: string;
}) {
  const dateFrom = new Date(filters.dateFrom);
  const dateTo = new Date(filters.dateTo + 'T23:59:59.999Z');

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      transactionStatus: 'completed',
    },
    orderBy: { createdAt: 'asc' },
  });

  const voidRecords = await prisma.voidRecord.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
    },
  });

  const totalRevenue = transactions.reduce((sum, t) => sum.add(t.grandTotal), new Prisma.Decimal(0));
  const totalOrders = transactions.length;
  const totalDiscountGiven = transactions.reduce((sum, t) => sum.add(t.discountAmount), new Prisma.Decimal(0));
  const totalPpnCollected = transactions.reduce((sum, t) => sum.add(t.ppnAmount), new Prisma.Decimal(0));

  const cashRevenue = transactions
    .filter((t) => CASH_METHODS.includes(t.paymentMethod))
    .reduce((sum, t) => sum.add(t.grandTotal), new Prisma.Decimal(0));
  const digitalRevenue = totalRevenue.sub(cashRevenue);

  const voidTotal = voidRecords.reduce((sum, vr) => sum.add(vr.voidAmount), new Prisma.Decimal(0));
  const netRevenue = totalRevenue.sub(voidTotal);

  // Daily breakdown
  const dayMap = new Map<string, { revenue: Prisma.Decimal; orderCount: number }>();
  for (const t of transactions) {
    const dateKey = t.createdAt.toISOString().slice(0, 10);
    const existing = dayMap.get(dateKey);
    if (existing) {
      existing.revenue = existing.revenue.add(t.grandTotal);
      existing.orderCount += 1;
    } else {
      dayMap.set(dateKey, { revenue: t.grandTotal, orderCount: 1 });
    }
  }
  const dailyBreakdown = Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, revenue: data.revenue, orderCount: data.orderCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    period: {
      from: filters.dateFrom,
      to: filters.dateTo,
    },
    totalRevenue,
    totalOrders,
    totalDiscountGiven,
    totalPpnCollected,
    cashRevenue,
    digitalRevenue,
    voidTotal,
    netRevenue,
    dailyBreakdown,
  };
}
