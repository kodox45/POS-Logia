import prisma from '../../prisma';
import { OrderStatus } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';

const LATE_ORDER_THRESHOLD_MINUTES = 15;

export async function getKitchenOrders(filters: { status?: string }) {
  const statusFilter: OrderStatus[] = [];
  if (filters.status) {
    statusFilter.push(filters.status as OrderStatus);
  } else {
    statusFilter.push('pending', 'cooking', 'ready');
  }

  const orders = await prisma.order.findMany({
    where: { orderStatus: { in: statusFilter } },
    orderBy: { createdAt: 'asc' },
    include: {
      table: { select: { tableNumber: true } },
      items: {
        select: {
          id: true,
          itemName: true,
          quantity: true,
          specialNotes: true,
          cookingStatus: true,
          isAdditional: true,
          menuItemId: true,
        },
      },
    },
  });

  const now = new Date();

  const enrichedOrders = await Promise.all(
    orders.map(async (order) => {
      const elapsedMs = now.getTime() - order.createdAt.getTime();
      const elapsedMinutes = Math.floor(elapsedMs / 60000);

      const itemsWithRecipe = await Promise.all(
        order.items.map(async (item) => {
          const recipe = await prisma.recipe.findFirst({
            where: { menuItemId: item.menuItemId },
            select: { id: true },
          });
          return {
            id: item.id,
            itemName: item.itemName,
            quantity: item.quantity,
            specialNotes: item.specialNotes,
            cookingStatus: item.cookingStatus,
            isAdditional: item.isAdditional,
            recipeId: recipe?.id || null,
          };
        }),
      );

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        tableNumber: order.table.tableNumber,
        orderStatus: order.orderStatus,
        specialNotes: order.specialNotes,
        items: itemsWithRecipe,
        elapsedMinutes,
        isLate: elapsedMinutes > LATE_ORDER_THRESHOLD_MINUTES,
        cookingStartedAt: order.cookingStartedAt?.toISOString() || null,
        createdAt: order.createdAt.toISOString(),
      };
    }),
  );

  return {
    orders: enrichedOrders,
    pendingCount: enrichedOrders.filter((o) => o.orderStatus === 'pending').length,
    cookingCount: enrichedOrders.filter((o) => o.orderStatus === 'cooking').length,
    readyCount: enrichedOrders.filter((o) => o.orderStatus === 'ready').length,
  };
}

export async function startCooking(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }
  if (order.orderStatus !== 'pending') {
    throw new AppError(400, 'INVALID_TRANSITION', 'Order is not in pending status');
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      orderStatus: 'cooking',
      cookingStartedAt: new Date(),
    },
  });

  return {
    id: updated.id,
    orderStatus: updated.orderStatus,
    cookingStartedAt: updated.cookingStartedAt!.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function markReady(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      table: { select: { tableNumber: true } },
      items: { select: { itemName: true, quantity: true } },
    },
  });
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }
  if (order.orderStatus !== 'cooking') {
    throw new AppError(400, 'INVALID_TRANSITION', 'Order is not in cooking status');
  }

  const itemsSummary = order.items
    .map((i) => `${i.itemName} x${i.quantity}`)
    .join(', ');

  const [updatedOrder, notification] = await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'ready',
        readyAt: new Date(),
      },
    }),
    prisma.kitchenNotification.create({
      data: {
        orderId,
        tableNumber: order.table.tableNumber,
        items: itemsSummary,
        isAcknowledged: false,
      },
    }),
  ]);

  return {
    id: updatedOrder.id,
    orderStatus: updatedOrder.orderStatus,
    readyAt: updatedOrder.readyAt!.toISOString(),
    notification: {
      id: notification.id,
      tableNumber: notification.tableNumber,
      items: notification.items,
    },
    updatedAt: updatedOrder.updatedAt.toISOString(),
  };
}

export async function getNotifications() {
  const notifications = await prisma.kitchenNotification.findMany({
    where: { isAcknowledged: false },
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { orderNumber: true } },
    },
  });

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      orderId: n.orderId,
      orderNumber: n.order.orderNumber,
      tableNumber: n.tableNumber,
      items: n.items,
      createdAt: n.createdAt.toISOString(),
    })),
    count: notifications.length,
  };
}

export async function acknowledgeNotification(notificationId: string) {
  const notification = await prisma.kitchenNotification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  }

  const [updatedNotification, updatedOrder] = await prisma.$transaction([
    prisma.kitchenNotification.update({
      where: { id: notificationId },
      data: { isAcknowledged: true },
    }),
    prisma.order.update({
      where: { id: notification.orderId },
      data: { orderStatus: 'served' },
    }),
  ]);

  return {
    notificationId: updatedNotification.id,
    orderId: updatedOrder.id,
    orderStatus: updatedOrder.orderStatus,
    acknowledged: true,
    updatedAt: updatedOrder.updatedAt.toISOString(),
  };
}
