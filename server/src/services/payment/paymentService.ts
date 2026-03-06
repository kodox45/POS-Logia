import prisma from '../../prisma';
import { Prisma, PaymentMethod } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { reverseStockForOrder } from '../inventory/inventoryService';

function generateTransactionNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TXN-${dateStr}-${rand}`;
}

function generateVoidNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `VD-${dateStr}-${rand}`;
}

const CASH_METHODS: PaymentMethod[] = ['tunai'];

export async function processPayment(data: {
  orderId: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  digitalPaymentRef?: string;
  transferProofPhotoUrl?: string;
  discountId?: string;
}, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: {
      table: { select: { id: true, tableNumber: true } },
      items: true,
    },
  });
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  const payableStatuses = ['served', 'ready'];
  if (!payableStatuses.includes(order.orderStatus)) {
    throw new AppError(400, 'ORDER_NOT_PAYABLE', 'Order is not in a payable status (must be served or ready)');
  }

  const activeShift = await prisma.shift.findFirst({
    where: { picCashierId: userId, shiftStatus: 'open' },
  });
  if (!activeShift) {
    throw new AppError(400, 'NO_ACTIVE_SHIFT', 'Cashier must open a shift before processing any payment');
  }

  const settings = await prisma.posSettings.findFirst();
  const ppnRate = settings?.ppnEnabled ? settings.ppnRate : new Prisma.Decimal(0);

  let subtotalAmount = order.subtotalAmount;
  let discountAmount = order.discountAmount || new Prisma.Decimal(0);
  let discountName: string | null = null;

  if (data.discountId && !order.discountId) {
    const discount = await prisma.discount.findUnique({ where: { id: data.discountId } });
    if (discount && discount.isActive) {
      discountName = discount.discountName;
      if (discount.discountType === 'percentage') {
        discountAmount = subtotalAmount.mul(discount.discountValue).div(100);
      } else {
        discountAmount = discount.discountValue;
      }

      await prisma.order.update({
        where: { id: data.orderId },
        data: { discountId: data.discountId, discountAmount },
      });
    }
  } else if (order.discountId) {
    const discount = await prisma.discount.findUnique({ where: { id: order.discountId } });
    discountName = discount?.discountName || null;
  }

  const taxableAmount = subtotalAmount.sub(discountAmount);
  const ppnAmount = taxableAmount.mul(ppnRate).div(100);
  const grandTotal = taxableAmount.add(ppnAmount);

  const amountPaid = new Prisma.Decimal(data.amountPaid);
  if (amountPaid.lt(grandTotal)) {
    throw new AppError(400, 'INSUFFICIENT_AMOUNT', 'Payment cannot be processed if amount paid is less than grand total');
  }

  const isCash = CASH_METHODS.includes(data.paymentMethod);
  const changeAmount = isCash ? amountPaid.sub(grandTotal) : new Prisma.Decimal(0);

  const transactionNumber = generateTransactionNumber();

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        transactionNumber,
        orderId: data.orderId,
        shiftId: activeShift.id,
        cashierId: userId,
        tableNumber: order.table.tableNumber,
        subtotalAmount,
        discountName,
        discountAmount,
        ppnRate,
        ppnAmount,
        grandTotal,
        paymentMethod: data.paymentMethod,
        digitalPaymentRef: data.digitalPaymentRef || null,
        transferProofPhotoUrl: data.transferProofPhotoUrl || null,
        amountPaid,
        changeAmount,
        transactionStatus: 'completed',
      },
    });

    await tx.order.update({
      where: { id: data.orderId },
      data: {
        orderStatus: 'paid',
        subtotalAmount,
        discountAmount,
        ppnRate,
        ppnAmount,
        grandTotal,
      },
    });

    await tx.restaurantTable.update({
      where: { id: order.table.id },
      data: { status: 'available', activeOrderId: null },
    });

    if (isCash) {
      await tx.shift.update({
        where: { id: activeShift.id },
        data: {
          cashSalesTotal: { increment: grandTotal },
          totalRevenue: { increment: grandTotal },
          totalTransactions: { increment: 1 },
          expectedCash: activeShift.openingBalance.add(activeShift.cashSalesTotal).add(grandTotal).sub(activeShift.voidTotalAmount),
          discountTotalGiven: { increment: discountAmount },
        },
      });
    } else {
      await tx.shift.update({
        where: { id: activeShift.id },
        data: {
          digitalSalesTotal: { increment: grandTotal },
          totalRevenue: { increment: grandTotal },
          totalTransactions: { increment: 1 },
          discountTotalGiven: { increment: discountAmount },
        },
      });
    }

    return transaction;
  });

  return {
    transaction: {
      id: result.id,
      transactionNumber: result.transactionNumber,
      orderId: result.orderId,
      shiftId: result.shiftId,
      tableNumber: result.tableNumber,
      subtotalAmount: result.subtotalAmount,
      discountName: result.discountName,
      discountAmount: result.discountAmount,
      ppnRate: result.ppnRate,
      ppnAmount: result.ppnAmount,
      grandTotal: result.grandTotal,
      paymentMethod: result.paymentMethod,
      amountPaid: result.amountPaid,
      changeAmount: result.changeAmount,
      createdAt: result.createdAt.toISOString(),
    },
    orderStatus: 'paid',
    tableStatus: 'available',
  };
}

export async function voidOrder(
  orderId: string,
  data: {
    voidType: string;
    voidReason: string;
    voidNotes?: string;
    voidedItems?: Array<{ orderItemId: string; quantity: number }>;
    pinVerified: boolean;
  },
  userId: string,
) {
  if (!data.pinVerified) {
    throw new AppError(400, 'PIN_NOT_VERIFIED', 'PIN verification required before void');
  }
  if (!data.voidReason) {
    throw new AppError(400, 'REASON_REQUIRED', 'Void reason is mandatory');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { transactions: { where: { transactionStatus: 'completed' } } },
  });
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }
  if (order.orderStatus !== 'paid') {
    throw new AppError(400, 'ORDER_NOT_PAID', 'Can only void a paid order');
  }

  const activeShift = await prisma.shift.findFirst({
    where: { picCashierId: userId, shiftStatus: 'open' },
  });
  if (!activeShift) {
    throw new AppError(400, 'NO_ACTIVE_SHIFT', 'Cashier must have an active shift');
  }

  const voidAmount = order.grandTotal;
  const voidNumber = generateVoidNumber();

  const result = await prisma.$transaction(async (tx) => {
    const voidRecord = await tx.voidRecord.create({
      data: {
        voidNumber,
        originalOrderId: orderId,
        shiftId: activeShift.id,
        voidType: data.voidType as any,
        voidReason: data.voidReason as any,
        voidNotes: data.voidNotes || null,
        voidedBy: userId,
        pinVerified: true,
        pinVerifiedAt: new Date(),
        voidAmount,
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: { orderStatus: 'voided' },
    });

    for (const txn of order.transactions) {
      await tx.transaction.update({
        where: { id: txn.id },
        data: { transactionStatus: 'voided' },
      });
    }

    const originalTransaction = order.transactions[0];
    const isCashPayment = originalTransaction && CASH_METHODS.includes(originalTransaction.paymentMethod);

    if (isCashPayment) {
      await tx.shift.update({
        where: { id: activeShift.id },
        data: {
          voidCount: { increment: 1 },
          voidTotalAmount: { increment: voidAmount },
          expectedCash: activeShift.openingBalance
            .add(activeShift.cashSalesTotal)
            .sub(activeShift.voidTotalAmount)
            .sub(voidAmount),
        },
      });
    } else {
      await tx.shift.update({
        where: { id: activeShift.id },
        data: {
          voidCount: { increment: 1 },
          voidTotalAmount: { increment: voidAmount },
        },
      });
    }

    return voidRecord;
  });

  await reverseStockForOrder(orderId, userId);

  return {
    voidRecord: {
      id: result.id,
      voidNumber: result.voidNumber,
      voidType: result.voidType,
      voidReason: result.voidReason,
      voidAmount: result.voidAmount,
      createdAt: result.createdAt.toISOString(),
    },
    orderStatus: 'voided',
    shiftExpectedCashAdjustment: voidAmount,
  };
}

export async function listTransactions(filters: {
  dateFrom?: string;
  dateTo?: string;
  transactionNumber?: string;
  cashierId?: string;
  shiftId?: string;
  paymentMethod?: string;
  totalMin?: string;
  totalMax?: string;
  transactionStatus?: string;
}) {
  const where: Prisma.TransactionWhereInput = {};

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }
  if (filters.transactionNumber) {
    where.transactionNumber = { contains: filters.transactionNumber, mode: 'insensitive' };
  }
  if (filters.cashierId) where.cashierId = filters.cashierId;
  if (filters.shiftId) where.shiftId = filters.shiftId;
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod as any;
  if (filters.transactionStatus) where.transactionStatus = filters.transactionStatus as any;
  if (filters.totalMin || filters.totalMax) {
    where.grandTotal = {};
    if (filters.totalMin) where.grandTotal.gte = new Prisma.Decimal(filters.totalMin);
    if (filters.totalMax) where.grandTotal.lte = new Prisma.Decimal(filters.totalMax);
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      shift: { select: { shiftNumber: true } },
      cashier: { select: { displayName: true } },
    },
  });

  const total = transactions.length;
  const totalRevenue = transactions
    .filter((t) => t.transactionStatus === 'completed')
    .reduce((sum, t) => sum.add(t.grandTotal), new Prisma.Decimal(0));
  const cashTotal = transactions
    .filter((t) => t.transactionStatus === 'completed' && CASH_METHODS.includes(t.paymentMethod))
    .reduce((sum, t) => sum.add(t.grandTotal), new Prisma.Decimal(0));
  const digitalTotal = totalRevenue.sub(cashTotal);

  return {
    transactions: transactions.map((t) => ({
      id: t.id,
      transactionNumber: t.transactionNumber,
      orderId: t.orderId,
      tableNumber: t.tableNumber,
      shiftId: t.shiftId,
      shiftNumber: t.shift.shiftNumber,
      cashierId: t.cashierId,
      cashierName: t.cashier.displayName,
      subtotalAmount: t.subtotalAmount,
      discountAmount: t.discountAmount,
      ppnRate: t.ppnRate,
      ppnAmount: t.ppnAmount,
      grandTotal: t.grandTotal,
      paymentMethod: t.paymentMethod,
      transactionStatus: t.transactionStatus,
      createdAt: t.createdAt.toISOString(),
    })),
    total,
    summaryStats: {
      count: total,
      totalRevenue,
      cashTotal,
      digitalTotal,
    },
  };
}

export async function getTransactionDetail(id: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          orderNumber: true,
          items: {
            select: { itemName: true, quantity: true, unitPrice: true, lineTotal: true },
          },
        },
      },
      shift: { select: { shiftNumber: true } },
      cashier: { select: { displayName: true } },
    },
  });

  if (!transaction) {
    throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
  }

  return {
    id: transaction.id,
    transactionNumber: transaction.transactionNumber,
    orderId: transaction.orderId,
    orderNumber: transaction.order.orderNumber,
    tableNumber: transaction.tableNumber,
    shiftId: transaction.shiftId,
    shiftNumber: transaction.shift.shiftNumber,
    cashierId: transaction.cashierId,
    cashierName: transaction.cashier.displayName,
    items: transaction.order.items.map((i) => ({
      itemName: i.itemName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    subtotalAmount: transaction.subtotalAmount,
    discountName: transaction.discountName,
    discountAmount: transaction.discountAmount,
    ppnRate: transaction.ppnRate,
    ppnAmount: transaction.ppnAmount,
    grandTotal: transaction.grandTotal,
    paymentMethod: transaction.paymentMethod,
    digitalPaymentRef: transaction.digitalPaymentRef,
    amountPaid: transaction.amountPaid,
    changeAmount: transaction.changeAmount,
    transactionStatus: transaction.transactionStatus,
    createdAt: transaction.createdAt.toISOString(),
  };
}

export async function exportTransactions(filters: {
  dateFrom?: string;
  dateTo?: string;
  cashierId?: string;
  shiftId?: string;
  paymentMethod?: string;
}) {
  const where: Prisma.TransactionWhereInput = {};
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }
  if (filters.cashierId) where.cashierId = filters.cashierId;
  if (filters.shiftId) where.shiftId = filters.shiftId;
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod as any;

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      shift: { select: { shiftNumber: true } },
      cashier: { select: { displayName: true } },
    },
  });

  const csvRows = [
    'Date,Transaction ID,Table,Shift,PIC,Subtotal,Discount,PPN,Grand Total,Payment Method,Status',
  ];

  for (const t of transactions) {
    csvRows.push(
      [
        t.createdAt.toISOString(),
        t.transactionNumber,
        t.tableNumber,
        t.shift.shiftNumber,
        t.cashier.displayName,
        t.subtotalAmount,
        t.discountAmount,
        t.ppnAmount,
        t.grandTotal,
        t.paymentMethod,
        t.transactionStatus,
      ].join(','),
    );
  }

  const fileName = `transactions-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return {
    fileUrl: `/api/exports/${fileName}`,
    fileName,
    recordCount: transactions.length,
    csvContent: csvRows.join('\n'),
  };
}

export async function listVoidRecords(filters: {
  shiftId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Prisma.VoidRecordWhereInput = {};
  if (filters.shiftId) where.shiftId = filters.shiftId;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }

  const voidRecords = await prisma.voidRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      originalOrder: { select: { orderNumber: true } },
      performer: { select: { displayName: true } },
    },
  });

  const totalVoidAmount = voidRecords.reduce(
    (sum, vr) => sum.add(vr.voidAmount),
    new Prisma.Decimal(0),
  );

  return {
    voidRecords: voidRecords.map((vr) => ({
      id: vr.id,
      voidNumber: vr.voidNumber,
      originalOrderId: vr.originalOrderId,
      orderNumber: vr.originalOrder.orderNumber,
      voidType: vr.voidType,
      voidReason: vr.voidReason,
      voidNotes: vr.voidNotes,
      voidAmount: vr.voidAmount,
      voidedByName: vr.performer.displayName,
      createdAt: vr.createdAt.toISOString(),
    })),
    total: voidRecords.length,
    totalVoidAmount,
  };
}
