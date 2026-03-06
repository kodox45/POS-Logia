import prisma from '../../prisma';
import { AppError } from '../../middleware/errorHandler';

export async function listRecipes(filters: { menuItemId?: string }) {
  const where: any = {};
  if (filters.menuItemId) where.menuItemId = filters.menuItemId;

  const recipes = await prisma.recipe.findMany({
    where,
    include: {
      menuItem: { select: { itemName: true } },
      _count: { select: { ingredients: true, steps: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    recipes: recipes.map((r) => ({
      id: r.id,
      menuItemId: r.menuItemId,
      menuItemName: r.menuItem.itemName,
      cookingTime: r.cookingTime,
      difficultyLevel: r.difficultyLevel,
      ingredientCount: r._count.ingredients,
      stepCount: r._count.steps,
    })),
    total: recipes.length,
  };
}

export async function getRecipeById(id: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      menuItem: { select: { itemName: true } },
      ingredients: {
        include: {
          inventoryItem: { select: { itemName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });

  if (!recipe) {
    throw new AppError(404, 'RECIPE_NOT_FOUND', 'Recipe not found');
  }

  return {
    id: recipe.id,
    menuItemId: recipe.menuItemId,
    menuItemName: recipe.menuItem.itemName,
    cookingTime: recipe.cookingTime,
    difficultyLevel: recipe.difficultyLevel,
    notes: recipe.notes,
    ingredients: recipe.ingredients.map((ing) => ({
      id: ing.id,
      inventoryItemId: ing.inventoryItemId,
      inventoryItemName: ing.inventoryItem.itemName,
      quantityRequired: ing.quantityRequired,
      unit: ing.unit,
    })),
    steps: recipe.steps.map((s) => ({
      id: s.id,
      stepOrder: s.stepOrder,
      instruction: s.instruction,
    })),
  };
}

export async function createRecipe(data: {
  menuItemId: string;
  cookingTime?: number;
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  notes?: string;
  ingredients: { inventoryItemId: string; quantityRequired: number; unit: string }[];
  steps: { stepOrder: number; instruction: string }[];
}) {
  const menuItem = await prisma.menuItem.findUnique({ where: { id: data.menuItemId } });
  if (!menuItem) {
    throw new AppError(400, 'MENU_ITEM_NOT_FOUND', 'Referenced menu item does not exist');
  }

  for (const ing of data.ingredients) {
    const invItem = await prisma.inventoryItem.findUnique({
      where: { id: ing.inventoryItemId },
    });
    if (!invItem) {
      throw new AppError(
        400,
        'INVENTORY_ITEM_NOT_FOUND',
        'One or more ingredient inventory items not found',
      );
    }
  }

  const recipe = await prisma.recipe.create({
    data: {
      menuItemId: data.menuItemId,
      cookingTime: data.cookingTime,
      difficultyLevel: data.difficultyLevel,
      notes: data.notes,
      ingredients: {
        create: data.ingredients.map((ing) => ({
          inventoryItemId: ing.inventoryItemId,
          quantityRequired: ing.quantityRequired,
          unit: ing.unit,
        })),
      },
      steps: {
        create: data.steps.map((s) => ({
          stepOrder: s.stepOrder,
          instruction: s.instruction,
        })),
      },
    },
    include: {
      _count: { select: { ingredients: true, steps: true } },
    },
  });

  return {
    id: recipe.id,
    menuItemId: recipe.menuItemId,
    ingredientCount: recipe._count.ingredients,
    stepCount: recipe._count.steps,
    createdAt: recipe.createdAt.toISOString(),
  };
}

export async function updateRecipe(
  id: string,
  data: {
    cookingTime?: number;
    difficultyLevel?: 'easy' | 'medium' | 'hard';
    notes?: string;
    ingredients?: { inventoryItemId: string; quantityRequired: number; unit: string }[];
    steps?: { stepOrder: number; instruction: string }[];
  },
) {
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) {
    throw new AppError(404, 'RECIPE_NOT_FOUND', 'Recipe not found');
  }

  if (data.ingredients) {
    for (const ing of data.ingredients) {
      const invItem = await prisma.inventoryItem.findUnique({
        where: { id: ing.inventoryItemId },
      });
      if (!invItem) {
        throw new AppError(
          400,
          'INVENTORY_ITEM_NOT_FOUND',
          'One or more ingredient inventory items not found',
        );
      }
    }
  }

  const updateData: any = {};
  if (data.cookingTime !== undefined) updateData.cookingTime = data.cookingTime;
  if (data.difficultyLevel !== undefined) updateData.difficultyLevel = data.difficultyLevel;
  if (data.notes !== undefined) updateData.notes = data.notes;

  if (data.ingredients) {
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });
    updateData.ingredients = {
      create: data.ingredients.map((ing) => ({
        inventoryItemId: ing.inventoryItemId,
        quantityRequired: ing.quantityRequired,
        unit: ing.unit,
      })),
    };
  }

  if (data.steps) {
    await prisma.recipeStep.deleteMany({ where: { recipeId: id } });
    updateData.steps = {
      create: data.steps.map((s) => ({
        stepOrder: s.stepOrder,
        instruction: s.instruction,
      })),
    };
  }

  const updated = await prisma.recipe.update({
    where: { id },
    data: updateData,
  });

  return {
    id: updated.id,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteRecipe(id: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) {
    throw new AppError(404, 'RECIPE_NOT_FOUND', 'Recipe not found');
  }

  await prisma.recipe.delete({ where: { id } });
  return { message: 'Recipe deleted successfully' };
}
