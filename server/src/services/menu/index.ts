import prisma from '../../prisma';
import { AppError } from '../../middleware/errorHandler';

// --- Menu Items ---

export async function listMenuItems(filters: {
  categoryId?: string;
  isAvailable?: boolean;
  search?: string;
}) {
  const where: any = {};
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.isAvailable !== undefined) where.isAvailable = filters.isAvailable;
  if (filters.search) where.itemName = { contains: filters.search, mode: 'insensitive' };

  const items = await prisma.menuItem.findMany({
    where,
    include: {
      category: { select: { name: true } },
      recipes: { select: { id: true } },
    },
    orderBy: { itemName: 'asc' },
  });

  return {
    menuItems: items.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      price: item.price,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      description: item.description,
      isAvailable: item.isAvailable,
      imageUrl: item.imageUrl,
      hasRecipe: item.recipes.length > 0,
    })),
    total: items.length,
  };
}

export async function getMenuItemById(id: string) {
  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      recipes: { select: { id: true } },
    },
  });

  if (!item) {
    throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
  }

  return {
    id: item.id,
    itemName: item.itemName,
    price: item.price,
    categoryId: item.categoryId,
    categoryName: item.category.name,
    description: item.description,
    isAvailable: item.isAvailable,
    imageUrl: item.imageUrl,
    hasRecipe: item.recipes.length > 0,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function createMenuItem(data: {
  itemName: string;
  price: number;
  categoryId: string;
  description?: string;
  isAvailable?: boolean;
  imageUrl?: string;
}) {
  const category = await prisma.menuCategory.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) {
    throw new AppError(400, 'INVALID_CATEGORY', 'Category does not exist');
  }

  const item = await prisma.menuItem.create({
    data: {
      itemName: data.itemName,
      price: data.price,
      categoryId: data.categoryId,
      description: data.description,
      isAvailable: data.isAvailable ?? true,
      imageUrl: data.imageUrl,
    },
  });

  return {
    id: item.id,
    itemName: item.itemName,
    price: item.price,
    categoryId: item.categoryId,
    isAvailable: item.isAvailable,
    createdAt: item.createdAt.toISOString(),
  };
}

export async function updateMenuItem(
  id: string,
  data: {
    itemName?: string;
    price?: number;
    categoryId?: string;
    description?: string;
    isAvailable?: boolean;
    imageUrl?: string;
  },
) {
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
  }

  if (data.categoryId) {
    const category = await prisma.menuCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new AppError(400, 'INVALID_CATEGORY', 'Category does not exist');
    }
  }

  const updated = await prisma.menuItem.update({
    where: { id },
    data,
  });

  return {
    id: updated.id,
    itemName: updated.itemName,
    price: updated.price,
    isAvailable: updated.isAvailable,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteMenuItem(id: string) {
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
  }

  const activeOrders = await prisma.orderItem.findFirst({
    where: {
      menuItemId: id,
      order: {
        orderStatus: { in: ['pending', 'cooking', 'ready', 'served'] },
      },
    },
  });

  if (activeOrders) {
    throw new AppError(409, 'MENU_ITEM_IN_USE', 'Cannot delete menu item with active orders');
  }

  await prisma.menuItem.delete({ where: { id } });
  return { message: 'Menu item deleted successfully' };
}

// --- Menu Categories ---

export async function listCategories() {
  const categories = await prisma.menuCategory.findMany({
    include: { _count: { select: { menuItems: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder ?? 0,
      itemCount: c._count.menuItems,
    })),
  };
}

export async function createCategory(data: { name: string; sortOrder?: number }) {
  const existing = await prisma.menuCategory.findUnique({ where: { name: data.name } });
  if (existing) {
    throw new AppError(409, 'CATEGORY_NAME_EXISTS', 'Category name already exists');
  }

  const category = await prisma.menuCategory.create({
    data: {
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
    },
  });

  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder ?? 0,
  };
}

export async function updateCategory(
  id: string,
  data: { name?: string; sortOrder?: number },
) {
  const category = await prisma.menuCategory.findUnique({ where: { id } });
  if (!category) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  }

  if (data.name && data.name !== category.name) {
    const existing = await prisma.menuCategory.findUnique({ where: { name: data.name } });
    if (existing) {
      throw new AppError(409, 'CATEGORY_NAME_EXISTS', 'Category name already exists');
    }
  }

  const updated = await prisma.menuCategory.update({
    where: { id },
    data,
  });

  return {
    id: updated.id,
    name: updated.name,
    sortOrder: updated.sortOrder ?? 0,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteCategory(id: string) {
  const category = await prisma.menuCategory.findUnique({ where: { id } });
  if (!category) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  }

  const itemCount = await prisma.menuItem.count({ where: { categoryId: id } });
  if (itemCount > 0) {
    throw new AppError(409, 'CATEGORY_HAS_ITEMS', 'Cannot delete category with assigned menu items');
  }

  await prisma.menuCategory.delete({ where: { id } });
  return { message: 'Category deleted successfully' };
}
