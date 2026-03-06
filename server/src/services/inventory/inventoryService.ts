import prisma from '../../prisma';
import { Prisma, StockStatus } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';

function computeStockStatus(quantity: Prisma.Decimal, minimumThreshold: Prisma.Decimal | null): StockStatus {
  const qty = quantity.toNumber();
  if (minimumThreshold === null) return 'ok';
  const threshold = minimumThreshold.toNumber();
  if (qty <= 0) return 'critical';
  if (qty <= threshold) return 'low';
  return 'ok';
}

export async function listInventoryItems(filters: {
  stockStatus?: StockStatus;
  search?: string;
}) {
  const where: Prisma.InventoryItemWhereInput = {};
  if (filters.stockStatus) {
    where.stockStatus = filters.stockStatus;
  }
  if (filters.search) {
    where.itemName = { contains: filters.search, mode: 'insensitive' };
  }

  const [inventoryItems, total, lowStockCount, criticalStockCount] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { itemName: 'asc' },
    }),
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.count({ where: { stockStatus: 'low' } }),
    prisma.inventoryItem.count({ where: { stockStatus: 'critical' } }),
  ]);

  return {
    inventoryItems: inventoryItems.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      minimumThreshold: item.minimumThreshold,
      stockStatus: item.stockStatus,
    })),
    total,
    lowStockCount,
    criticalStockCount,
  };
}

export async function getInventoryItem(id: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Inventory item not found');
  }

  const recentMovements = await prisma.stockMovement.findMany({
    where: { inventoryItemId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      performer: { select: { displayName: true } },
    },
  });

  return {
    id: item.id,
    itemName: item.itemName,
    quantity: item.quantity,
    unit: item.unit,
    minimumThreshold: item.minimumThreshold,
    stockStatus: item.stockStatus,
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      movementType: m.movementType,
      quantityChange: m.quantityChange,
      reason: m.reason,
      performedBy: m.performer.displayName,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function createInventoryItem(data: {
  itemName: string;
  quantity: number;
  unit: string;
  minimumThreshold?: number;
}) {
  const existing = await prisma.inventoryItem.findUnique({
    where: { itemName: data.itemName },
  });
  if (existing) {
    throw new AppError(409, 'ITEM_NAME_EXISTS', 'Inventory item with this name already exists');
  }

  const threshold = data.minimumThreshold !== undefined ? new Prisma.Decimal(data.minimumThreshold) : null;
  const quantity = new Prisma.Decimal(data.quantity);
  const stockStatus = computeStockStatus(quantity, threshold);

  const item = await prisma.inventoryItem.create({
    data: {
      itemName: data.itemName,
      quantity,
      unit: data.unit,
      minimumThreshold: threshold,
      stockStatus,
    },
  });

  return {
    id: item.id,
    itemName: item.itemName,
    quantity: item.quantity,
    unit: item.unit,
    stockStatus: item.stockStatus,
    createdAt: item.createdAt.toISOString(),
  };
}

export async function updateInventoryItem(
  id: string,
  data: { itemName?: string; unit?: string; minimumThreshold?: number },
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Inventory item not found');
  }

  const updateData: Prisma.InventoryItemUpdateInput = {};
  if (data.itemName !== undefined) updateData.itemName = data.itemName;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.minimumThreshold !== undefined) {
    const newThreshold = new Prisma.Decimal(data.minimumThreshold);
    updateData.minimumThreshold = newThreshold;
    updateData.stockStatus = computeStockStatus(item.quantity, newThreshold);
  }

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: updateData,
  });

  return {
    id: updated.id,
    itemName: updated.itemName,
    unit: updated.unit,
    minimumThreshold: updated.minimumThreshold,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteInventoryItem(id: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { recipeIngredients: { take: 1 } },
  });
  if (!item) {
    throw new AppError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Inventory item not found');
  }
  if (item.recipeIngredients.length > 0) {
    throw new AppError(409, 'ITEM_IN_USE', 'Cannot delete inventory item referenced by recipes');
  }

  await prisma.inventoryItem.delete({ where: { id } });
  return { message: 'Inventory item deleted successfully' };
}

export async function restockInventoryItem(
  id: string,
  data: { quantity: number; reason?: string },
  performedBy: string,
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Inventory item not found');
  }

  const addQty = new Prisma.Decimal(data.quantity);
  const newQuantity = item.quantity.add(addQty);
  const newStatus = computeStockStatus(newQuantity, item.minimumThreshold);

  const [updatedItem, stockMovement] = await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { id },
      data: { quantity: newQuantity, stockStatus: newStatus },
    }),
    prisma.stockMovement.create({
      data: {
        inventoryItemId: id,
        movementType: 'restock',
        quantityChange: addQty,
        reason: data.reason || null,
        performedBy,
      },
    }),
  ]);

  return {
    inventoryItem: {
      id: updatedItem.id,
      quantity: updatedItem.quantity,
      stockStatus: updatedItem.stockStatus,
    },
    stockMovement: {
      id: stockMovement.id,
      movementType: stockMovement.movementType,
      quantityChange: stockMovement.quantityChange,
      createdAt: stockMovement.createdAt.toISOString(),
    },
  };
}

export async function adjustInventoryItem(
  id: string,
  data: { newQuantity: number; reason: string },
  performedBy: string,
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Inventory item not found');
  }

  const newQty = new Prisma.Decimal(data.newQuantity);
  const quantityChange = newQty.sub(item.quantity);
  const newStatus = computeStockStatus(newQty, item.minimumThreshold);

  const [updatedItem, stockMovement] = await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { id },
      data: { quantity: newQty, stockStatus: newStatus },
    }),
    prisma.stockMovement.create({
      data: {
        inventoryItemId: id,
        movementType: 'manual_adjustment',
        quantityChange,
        reason: data.reason,
        performedBy,
      },
    }),
  ]);

  return {
    inventoryItem: {
      id: updatedItem.id,
      quantity: updatedItem.quantity,
      stockStatus: updatedItem.stockStatus,
    },
    stockMovement: {
      id: stockMovement.id,
      movementType: stockMovement.movementType,
      quantityChange: stockMovement.quantityChange,
      reason: stockMovement.reason,
      createdAt: stockMovement.createdAt.toISOString(),
    },
  };
}

export async function getStockMovements(
  inventoryItemId: string,
  filters: { movementType?: string; dateFrom?: string; dateTo?: string },
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item) {
    throw new AppError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Inventory item not found');
  }

  const where: Prisma.StockMovementWhereInput = { inventoryItemId };
  if (filters.movementType) {
    where.movementType = filters.movementType as Prisma.EnumMovementTypeFilter['equals'];
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }

  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      performer: { select: { displayName: true } },
    },
  });

  return {
    movements: movements.map((m) => ({
      id: m.id,
      movementType: m.movementType,
      quantityChange: m.quantityChange,
      reason: m.reason,
      orderId: m.orderId,
      performedBy: m.performer.displayName,
      createdAt: m.createdAt.toISOString(),
    })),
    total: movements.length,
  };
}

export async function getLowStockItems() {
  const lowStockItems = await prisma.inventoryItem.findMany({
    where: {
      stockStatus: { in: ['low', 'critical'] },
    },
    orderBy: { stockStatus: 'asc' },
  });

  return {
    lowStockItems: lowStockItems.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      minimumThreshold: item.minimumThreshold,
      stockStatus: item.stockStatus,
    })),
    count: lowStockItems.length,
  };
}

export async function checkStock(items: Array<{ menuItemId: string; quantity: number }>) {
  const insufficientItems: Array<{
    menuItemId: string;
    menuItemName: string;
    ingredient: string;
    required: number;
    available: number;
    unit: string;
  }> = [];

  for (const orderItem of items) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: orderItem.menuItemId },
      select: { id: true, itemName: true },
    });
    if (!menuItem) continue;

    const recipes = await prisma.recipe.findMany({
      where: { menuItemId: orderItem.menuItemId },
      include: {
        ingredients: {
          include: {
            inventoryItem: { select: { id: true, itemName: true, quantity: true, unit: true } },
          },
        },
      },
    });

    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients) {
        const requiredQty = ingredient.quantityRequired.toNumber() * orderItem.quantity;
        const availableQty = ingredient.inventoryItem.quantity.toNumber();

        if (requiredQty > availableQty) {
          insufficientItems.push({
            menuItemId: menuItem.id,
            menuItemName: menuItem.itemName,
            ingredient: ingredient.inventoryItem.itemName,
            required: requiredQty,
            available: availableQty,
            unit: ingredient.inventoryItem.unit,
          });
        }
      }
    }
  }

  return {
    sufficient: insufficientItems.length === 0,
    insufficientItems,
  };
}

export async function deductStockForOrder(
  orderId: string,
  orderItems: Array<{ menuItemId: string; quantity: number }>,
  performedBy: string,
): Promise<Array<{ menuItemId: string; menuItemName: string; ingredient: string; status: StockStatus }>> {
  const warnings: Array<{ menuItemId: string; menuItemName: string; ingredient: string; status: StockStatus }> = [];

  await prisma.$transaction(async (tx) => {
    for (const orderItem of orderItems) {
      const menuItem = await tx.menuItem.findUnique({
        where: { id: orderItem.menuItemId },
        select: { id: true, itemName: true },
      });
      if (!menuItem) continue;

      const recipes = await tx.recipe.findMany({
        where: { menuItemId: orderItem.menuItemId },
        include: {
          ingredients: {
            include: {
              inventoryItem: true,
            },
          },
        },
      });

      for (const recipe of recipes) {
        for (const ingredient of recipe.ingredients) {
          const deductQty = new Prisma.Decimal(ingredient.quantityRequired.toNumber() * orderItem.quantity);
          const newQuantity = ingredient.inventoryItem.quantity.sub(deductQty);
          const finalQty = newQuantity.toNumber() < 0 ? new Prisma.Decimal(0) : newQuantity;
          const newStatus = computeStockStatus(finalQty, ingredient.inventoryItem.minimumThreshold);

          await tx.inventoryItem.update({
            where: { id: ingredient.inventoryItemId },
            data: { quantity: finalQty, stockStatus: newStatus },
          });

          await tx.stockMovement.create({
            data: {
              inventoryItemId: ingredient.inventoryItemId,
              movementType: 'auto_deduction',
              quantityChange: deductQty.neg(),
              reason: `Order ${orderId} - ${menuItem.itemName} x${orderItem.quantity}`,
              orderId,
              performedBy,
            },
          });

          if (newStatus !== 'ok') {
            warnings.push({
              menuItemId: menuItem.id,
              menuItemName: menuItem.itemName,
              ingredient: ingredient.inventoryItem.itemName,
              status: newStatus,
            });
          }
        }
      }
    }
  });

  return warnings;
}

export async function reverseStockForOrder(orderId: string, performedBy: string): Promise<void> {
  const deductions = await prisma.stockMovement.findMany({
    where: { orderId, movementType: 'auto_deduction' },
  });

  await prisma.$transaction(async (tx) => {
    for (const deduction of deductions) {
      const reverseQty = deduction.quantityChange.abs();

      const item = await tx.inventoryItem.findUnique({
        where: { id: deduction.inventoryItemId },
      });
      if (!item) continue;

      const newQuantity = item.quantity.add(reverseQty);
      const newStatus = computeStockStatus(newQuantity, item.minimumThreshold);

      await tx.inventoryItem.update({
        where: { id: deduction.inventoryItemId },
        data: { quantity: newQuantity, stockStatus: newStatus },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: deduction.inventoryItemId,
          movementType: 'auto_deduction',
          quantityChange: reverseQty,
          reason: `Reversal for order ${orderId}`,
          orderId,
          performedBy,
        },
      });
    }
  });
}
