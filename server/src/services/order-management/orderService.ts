import prisma from '../../prisma';
import { Prisma, OrderStatus } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { deductStockForOrder, reverseStockForOrder } from '../inventory/inventoryService';

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['cooking', 'cancelled'],
  cooking: ['ready'],
  ready: ['served'],
  served: ['paid'],
  paid: ['voided'],
  cancelled: [],
  voided: [],
};

function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${dateStr}-${rand}`;
}

export async function listOrders(filters: {
  orderStatus?: OrderStatus;
  tableId?: string;
  shiftId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Prisma.OrderWhereInput = {};
  if (filters.orderStatus) where.orderStatus = filters.orderStatus;
  if (filters.tableId) where.tableId = filters.tableId;
  if (filters.shiftId) where.shiftId = filters.shiftId;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      table: { select: { tableNumber: true } },
      waiter: { select: { displayName: true } },
      items: { select: { id: true } },
      kitchenNotifications: {
        where: { isAcknowledged: false },
        select: { id: true },
        take: 1,
      },
    },
  });

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      tableId: o.tableId,
      tableNumber: o.table.tableNumber,
      orderStatus: o.orderStatus,
      itemCount: o.items.length,
      subtotalAmount: o.subtotalAmount,
      grandTotal: o.grandTotal,
      waiterId: o.waiterId,
      waiterName: o.waiter.displayName,
      hasKitchenNotification: o.kitchenNotifications.length > 0,
      createdAt: o.createdAt.toISOString(),
    })),
    total: orders.length,
  };
}

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      table: { select: { tableNumber: true } },
      waiter: { select: { displayName: true } },
      discount: { select: { discountName: true } },
      items: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tableId: order.tableId,
    tableNumber: order.table.tableNumber,
    waiterId: order.waiterId,
    waiterName: order.waiter.displayName,
    shiftId: order.shiftId,
    orderStatus: order.orderStatus,
    specialNotes: order.specialNotes,
    isAdditional: order.isAdditional,
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      specialNotes: item.specialNotes,
      isAdditional: item.isAdditional,
      cookingStatus: item.cookingStatus,
    })),
    discountId: order.discountId,
    discountName: order.discount?.discountName || null,
    discountAmount: order.discountAmount,
    subtotalAmount: order.subtotalAmount,
    ppnRate: order.ppnRate,
    ppnAmount: order.ppnAmount,
    grandTotal: order.grandTotal,
    cookingStartedAt: order.cookingStartedAt?.toISOString() || null,
    readyAt: order.readyAt?.toISOString() || null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export async function createOrder(
  data: {
    tableId: string;
    items: Array<{ menuItemId: string; quantity: number; specialNotes?: string | null }>;
    specialNotes?: string;
    discountId?: string;
  },
  userId: string,
) {
  if (!data.items || data.items.length === 0) {
    throw new AppError(400, 'NO_ITEMS', 'Order must have at least one menu item');
  }

  const table = await prisma.restaurantTable.findUnique({ where: { id: data.tableId } });
  if (!table) {
    throw new AppError(400, 'TABLE_NOT_FOUND', 'Table does not exist');
  }

  const menuItemIds = data.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });

  const menuItemMap = new Map(menuItems.map((mi) => [mi.id, mi]));
  for (const item of data.items) {
    const mi = menuItemMap.get(item.menuItemId);
    if (!mi) {
      throw new AppError(400, 'ITEM_UNAVAILABLE', 'One or more menu items are unavailable');
    }
    if (!mi.isAvailable) {
      throw new AppError(400, 'ITEM_UNAVAILABLE', 'One or more menu items are unavailable');
    }
  }

  const settings = await prisma.posSettings.findFirst();
  const ppnRate = settings?.ppnEnabled ? settings.ppnRate : new Prisma.Decimal(0);

  let discountAmount = new Prisma.Decimal(0);
  if (data.discountId) {
    const discount = await prisma.discount.findUnique({ where: { id: data.discountId } });
    if (discount && discount.isActive) {
      const subtotalForDiscount = data.items.reduce((sum, item) => {
        const mi = menuItemMap.get(item.menuItemId)!;
        return sum.add(mi.price.mul(item.quantity));
      }, new Prisma.Decimal(0));

      if (discount.discountType === 'percentage') {
        discountAmount = subtotalForDiscount.mul(discount.discountValue).div(100);
      } else {
        discountAmount = discount.discountValue;
      }
    }
  }

  const orderNumber = generateOrderNumber();

  const orderItems = data.items.map((item) => {
    const mi = menuItemMap.get(item.menuItemId)!;
    const lineTotal = mi.price.mul(item.quantity);
    return {
      menuItemId: item.menuItemId,
      itemName: mi.itemName,
      quantity: item.quantity,
      unitPrice: mi.price,
      lineTotal,
      specialNotes: item.specialNotes || null,
      isAdditional: false,
      cookingStatus: 'pending' as const,
    };
  });

  const subtotalAmount = orderItems.reduce(
    (sum, item) => sum.add(item.lineTotal),
    new Prisma.Decimal(0),
  );
  const taxableAmount = subtotalAmount.sub(discountAmount);
  const ppnAmount = taxableAmount.mul(ppnRate).div(100);
  const grandTotal = taxableAmount.add(ppnAmount);

  const order = await prisma.order.create({
    data: {
      orderNumber,
      tableId: data.tableId,
      waiterId: userId,
      orderStatus: 'pending',
      specialNotes: data.specialNotes || null,
      isAdditional: false,
      discountId: data.discountId || null,
      discountAmount,
      subtotalAmount,
      ppnRate,
      ppnAmount,
      grandTotal,
      items: {
        create: orderItems,
      },
    },
    include: {
      items: true,
    },
  });

  await prisma.restaurantTable.update({
    where: { id: data.tableId },
    data: { status: 'occupied', activeOrderId: order.id },
  });

  const stockWarnings = await deductStockForOrder(
    order.id,
    data.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    userId,
  );

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tableId: order.tableId,
    orderStatus: order.orderStatus,
    items: order.items.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotalAmount: order.subtotalAmount,
    grandTotal: order.grandTotal,
    stockWarnings,
    createdAt: order.createdAt.toISOString(),
  };
}

export async function addItemsToOrder(
  orderId: string,
  data: { items: Array<{ menuItemId: string; quantity: number; specialNotes?: string | null }> },
  userId: string,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  const activeStatuses: OrderStatus[] = ['pending', 'cooking', 'ready', 'served'];
  if (!activeStatuses.includes(order.orderStatus)) {
    throw new AppError(400, 'ORDER_NOT_ACTIVE', 'Cannot add items to a paid/cancelled/voided order');
  }

  const menuItemIds = data.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });
  const menuItemMap = new Map(menuItems.map((mi) => [mi.id, mi]));

  const newItems = data.items.map((item) => {
    const mi = menuItemMap.get(item.menuItemId)!;
    const lineTotal = mi.price.mul(item.quantity);
    return {
      orderId,
      menuItemId: item.menuItemId,
      itemName: mi.itemName,
      quantity: item.quantity,
      unitPrice: mi.price,
      lineTotal,
      specialNotes: item.specialNotes || null,
      isAdditional: true,
      cookingStatus: 'pending' as const,
    };
  });

  const createdItems = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const item of newItems) {
      const c = await tx.orderItem.create({ data: item });
      created.push(c);
    }

    const allItems = await tx.orderItem.findMany({ where: { orderId } });
    const newSubtotal = allItems.reduce(
      (sum, item) => sum.add(item.lineTotal),
      new Prisma.Decimal(0),
    );

    const taxableAmount = newSubtotal.sub(order.discountAmount || new Prisma.Decimal(0));
    const ppnAmount = taxableAmount.mul(order.ppnRate).div(100);
    const newGrandTotal = taxableAmount.add(ppnAmount);

    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotalAmount: newSubtotal,
        ppnAmount,
        grandTotal: newGrandTotal,
        isAdditional: true,
      },
    });

    return { created, newSubtotal, newGrandTotal };
  });

  await deductStockForOrder(
    orderId,
    data.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    userId,
  );

  return {
    orderId,
    addedItems: createdItems.created.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      isAdditional: true,
    })),
    newSubtotal: createdItems.newSubtotal,
    newGrandTotal: createdItems.newGrandTotal,
    updatedAt: new Date().toISOString(),
  };
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  userId: string,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.orderStatus];
  if (!allowedTransitions.includes(newStatus)) {
    throw new AppError(
      400,
      'INVALID_TRANSITION',
      `Cannot transition from ${order.orderStatus} to ${newStatus}`,
    );
  }

  const updateData: Prisma.OrderUpdateInput = { orderStatus: newStatus };

  if (newStatus === 'cooking') {
    updateData.cookingStartedAt = new Date();
  }
  if (newStatus === 'ready') {
    updateData.readyAt = new Date();
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });

  if (newStatus === 'cancelled') {
    await reverseStockForOrder(orderId, userId);

    const otherActiveOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        id: { not: orderId },
        orderStatus: { notIn: ['cancelled', 'voided', 'paid'] },
      },
    });

    if (otherActiveOrders === 0) {
      await prisma.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: 'available', activeOrderId: null },
      });
    }
  }

  return {
    id: updatedOrder.id,
    orderStatus: updatedOrder.orderStatus,
    cookingStartedAt: updatedOrder.cookingStartedAt?.toISOString() || null,
    readyAt: updatedOrder.readyAt?.toISOString() || null,
    updatedAt: updatedOrder.updatedAt.toISOString(),
  };
}
