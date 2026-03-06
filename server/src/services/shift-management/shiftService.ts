import prisma from '../../prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';

function generateShiftNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SHF-${dateStr}-${rand}`;
}

export async function openShift(data: {
  openingBalance: number;
  pinVerified: boolean;
}, userId: string) {
  if (!data.pinVerified) {
    throw new AppError(400, 'PIN_NOT_VERIFIED', 'PIN verification required before opening shift');
  }

  const existingShift = await prisma.shift.findFirst({
    where: { picCashierId: userId, shiftStatus: 'open' },
  });
  if (existingShift) {
    throw new AppError(400, 'SHIFT_ALREADY_OPEN', 'Only one active shift per cashier at a time');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });

  const shiftNumber = generateShiftNumber();
  const openingBalance = new Prisma.Decimal(data.openingBalance);

  const shift = await prisma.shift.create({
    data: {
      shiftNumber,
      picCashierId: userId,
      pinVerified: true,
      pinVerifiedAt: new Date(),
      openingBalance,
      shiftStartTime: new Date(),
      expectedCash: openingBalance,
      shiftStatus: 'open',
    },
  });

  return {
    id: shift.id,
    shiftNumber: shift.shiftNumber,
    picCashierId: shift.picCashierId,
    picCashierName: user?.displayName || '',
    openingBalance: shift.openingBalance,
    shiftStartTime: shift.shiftStartTime.toISOString(),
    shiftStatus: shift.shiftStatus,
  };
}

export async function getActiveShift(userId: string) {
  const shift = await prisma.shift.findFirst({
    where: { picCashierId: userId, shiftStatus: 'open' },
  });

  if (!shift) {
    return { shift: null };
  }

  return {
    shift: {
      id: shift.id,
      shiftNumber: shift.shiftNumber,
      openingBalance: shift.openingBalance,
      shiftStartTime: shift.shiftStartTime.toISOString(),
      cashSalesTotal: shift.cashSalesTotal,
      digitalSalesTotal: shift.digitalSalesTotal,
      totalRevenue: shift.totalRevenue,
      totalTransactions: shift.totalTransactions,
      voidCount: shift.voidCount,
      voidTotalAmount: shift.voidTotalAmount,
      expectedCash: shift.expectedCash,
      shiftStatus: shift.shiftStatus,
    },
  };
}

export async function getShiftSummary(shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      picCashier: { select: { displayName: true } },
    },
  });
  if (!shift) {
    throw new AppError(404, 'SHIFT_NOT_FOUND', 'Shift not found');
  }

  const now = new Date();
  const durationMs = now.getTime() - shift.shiftStartTime.getTime();
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  const duration = `${hours}h ${minutes}m`;

  const transactions = await prisma.transaction.findMany({
    where: { shiftId },
    orderBy: { createdAt: 'asc' },
    include: {
      order: {
        select: {
          orderNumber: true,
          items: { select: { itemName: true, quantity: true } },
        },
      },
    },
  });

  return {
    id: shift.id,
    shiftNumber: shift.shiftNumber,
    picCashierName: shift.picCashier.displayName,
    shiftStartTime: shift.shiftStartTime.toISOString(),
    duration,
    openingBalance: shift.openingBalance,
    cashSalesTotal: shift.cashSalesTotal,
    digitalSalesTotal: shift.digitalSalesTotal,
    totalRevenue: shift.totalRevenue,
    totalTransactions: shift.totalTransactions,
    voidCount: shift.voidCount,
    voidTotalAmount: shift.voidTotalAmount,
    discountTotalGiven: shift.discountTotalGiven,
    expectedCash: shift.expectedCash,
    transactions: transactions.map((t) => ({
      id: t.id,
      transactionNumber: t.transactionNumber,
      time: t.createdAt.toISOString(),
      orderNumber: t.order.orderNumber,
      items: t.order.items.map((i) => `${i.itemName} x${i.quantity}`).join(', '),
      grandTotal: t.grandTotal,
      paymentMethod: t.paymentMethod,
    })),
  };
}

export async function closeShift(shiftId: string, data: {
  actualCash: number;
  closingNotes?: string;
}) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) {
    throw new AppError(404, 'SHIFT_NOT_FOUND', 'Shift not found');
  }
  if (shift.shiftStatus !== 'open') {
    throw new AppError(400, 'SHIFT_ALREADY_CLOSED', 'Shift is already closed');
  }

  const actualCash = new Prisma.Decimal(data.actualCash);
  const discrepancy = actualCash.sub(shift.expectedCash);

  if (!discrepancy.isZero() && !data.closingNotes) {
    throw new AppError(400, 'NOTES_REQUIRED', 'Closing notes are mandatory when discrepancy exists');
  }

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      shiftStatus: 'closed',
      shiftEndTime: new Date(),
      actualCash,
      discrepancy,
      closingNotes: data.closingNotes || null,
    },
  });

  return {
    id: updated.id,
    shiftNumber: updated.shiftNumber,
    shiftStatus: updated.shiftStatus,
    shiftEndTime: updated.shiftEndTime!.toISOString(),
    expectedCash: updated.expectedCash,
    actualCash: updated.actualCash,
    discrepancy: updated.discrepancy,
    closingNotes: updated.closingNotes,
  };
}

export async function listShifts(filters: {
  shiftStatus?: string;
  picCashierId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasDiscrepancy?: string;
}) {
  const where: Prisma.ShiftWhereInput = {};

  if (filters.shiftStatus) where.shiftStatus = filters.shiftStatus as any;
  if (filters.picCashierId) where.picCashierId = filters.picCashierId;
  if (filters.dateFrom || filters.dateTo) {
    where.shiftStartTime = {};
    if (filters.dateFrom) where.shiftStartTime.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.shiftStartTime.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }
  if (filters.hasDiscrepancy === 'true') {
    where.discrepancy = { not: new Prisma.Decimal(0) };
  }

  const shifts = await prisma.shift.findMany({
    where,
    orderBy: { shiftStartTime: 'desc' },
    include: {
      picCashier: { select: { displayName: true } },
    },
  });

  return {
    shifts: shifts.map((s) => ({
      id: s.id,
      shiftNumber: s.shiftNumber,
      picCashierName: s.picCashier.displayName,
      shiftStartTime: s.shiftStartTime.toISOString(),
      shiftEndTime: s.shiftEndTime?.toISOString() || null,
      shiftStatus: s.shiftStatus,
      openingBalance: s.openingBalance,
      totalRevenue: s.totalRevenue,
      expectedCash: s.expectedCash,
      actualCash: s.actualCash,
      discrepancy: s.discrepancy,
      voidCount: s.voidCount,
      totalTransactions: s.totalTransactions,
    })),
    total: shifts.length,
  };
}

export async function getShiftDetail(shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      picCashier: { select: { displayName: true } },
    },
  });
  if (!shift) {
    throw new AppError(404, 'SHIFT_NOT_FOUND', 'Shift not found');
  }

  return {
    id: shift.id,
    shiftNumber: shift.shiftNumber,
    picCashierId: shift.picCashierId,
    picCashierName: shift.picCashier.displayName,
    pinVerified: shift.pinVerified,
    pinVerifiedAt: shift.pinVerifiedAt?.toISOString() || null,
    openingBalance: shift.openingBalance,
    shiftStartTime: shift.shiftStartTime.toISOString(),
    shiftEndTime: shift.shiftEndTime?.toISOString() || null,
    expectedCash: shift.expectedCash,
    actualCash: shift.actualCash,
    discrepancy: shift.discrepancy,
    digitalSalesTotal: shift.digitalSalesTotal,
    cashSalesTotal: shift.cashSalesTotal,
    totalRevenue: shift.totalRevenue,
    totalTransactions: shift.totalTransactions,
    voidCount: shift.voidCount,
    voidTotalAmount: shift.voidTotalAmount,
    discountTotalGiven: shift.discountTotalGiven,
    shiftStatus: shift.shiftStatus,
    closingNotes: shift.closingNotes,
    createdAt: shift.createdAt.toISOString(),
  };
}
