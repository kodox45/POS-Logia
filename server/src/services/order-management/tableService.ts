import prisma from '../../prisma';
import { Prisma, TableStatus } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';

export async function listTables(filters: { status?: TableStatus }) {
  const where: Prisma.RestaurantTableWhereInput = {};
  if (filters.status) where.status = filters.status;

  const tables = await prisma.restaurantTable.findMany({
    where,
    orderBy: { tableNumber: 'asc' },
    include: {
      orders: {
        where: { orderStatus: { notIn: ['cancelled', 'voided', 'paid'] } },
        select: { id: true, orderNumber: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const availableCount = tables.filter((t) => t.status === 'available').length;
  const occupiedCount = tables.filter((t) => t.status !== 'available').length;

  return {
    tables: tables.map((t) => ({
      id: t.id,
      tableName: t.tableName,
      tableNumber: t.tableNumber,
      capacity: t.capacity,
      status: t.status,
      activeOrderId: t.activeOrderId,
      activeOrderNumber: t.orders[0]?.orderNumber || null,
    })),
    total: tables.length,
    availableCount,
    occupiedCount,
  };
}

export async function getTable(id: string) {
  const table = await prisma.restaurantTable.findUnique({
    where: { id },
  });
  if (!table) {
    throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found');
  }

  let activeOrderSummary = null;
  if (table.activeOrderId) {
    const order = await prisma.order.findUnique({
      where: { id: table.activeOrderId },
      include: { items: { select: { id: true } } },
    });
    if (order) {
      activeOrderSummary = {
        orderNumber: order.orderNumber,
        itemCount: order.items.length,
        grandTotal: order.grandTotal,
        orderStatus: order.orderStatus,
      };
    }
  }

  return {
    id: table.id,
    tableName: table.tableName,
    tableNumber: table.tableNumber,
    capacity: table.capacity,
    status: table.status,
    activeOrderId: table.activeOrderId,
    activeOrderSummary,
  };
}

export async function createTable(data: {
  tableName: string;
  tableNumber: number;
  capacity?: number;
}) {
  const existing = await prisma.restaurantTable.findUnique({
    where: { tableNumber: data.tableNumber },
  });
  if (existing) {
    throw new AppError(409, 'TABLE_NUMBER_EXISTS', 'Table number already exists');
  }

  const table = await prisma.restaurantTable.create({
    data: {
      tableName: data.tableName,
      tableNumber: data.tableNumber,
      capacity: data.capacity ?? 4,
      status: 'available',
    },
  });

  return {
    id: table.id,
    tableName: table.tableName,
    tableNumber: table.tableNumber,
    capacity: table.capacity,
    status: table.status,
    createdAt: table.createdAt.toISOString(),
  };
}

export async function updateTable(
  id: string,
  data: { tableName?: string; capacity?: number },
) {
  const table = await prisma.restaurantTable.findUnique({ where: { id } });
  if (!table) {
    throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found');
  }

  const updateData: Prisma.RestaurantTableUpdateInput = {};
  if (data.tableName !== undefined) updateData.tableName = data.tableName;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;

  const updated = await prisma.restaurantTable.update({
    where: { id },
    data: updateData,
  });

  return {
    id: updated.id,
    tableName: updated.tableName,
    capacity: updated.capacity,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteTable(id: string) {
  const table = await prisma.restaurantTable.findUnique({ where: { id } });
  if (!table) {
    throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found');
  }

  if (table.status !== 'available') {
    throw new AppError(409, 'TABLE_OCCUPIED', 'Cannot delete table with active orders');
  }

  const activeOrders = await prisma.order.count({
    where: {
      tableId: id,
      orderStatus: { notIn: ['cancelled', 'voided', 'paid'] },
    },
  });
  if (activeOrders > 0) {
    throw new AppError(409, 'TABLE_OCCUPIED', 'Cannot delete table with active orders');
  }

  await prisma.restaurantTable.delete({ where: { id } });
  return { message: 'Table deleted successfully' };
}
