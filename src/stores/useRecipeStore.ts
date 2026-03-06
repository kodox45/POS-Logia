// ============================================================
// Recipe Store — Domain: recipe
// DB tables: recipes, recipeIngredients, recipeSteps
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';
import type { Recipe, RecipeIngredient, RecipeStep } from '@/types';
import { notifySync } from '@/sync/sync-trigger';

function generateId(): string {
  return crypto.randomUUID();
}

export interface RecipeState {
  // State
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  recipeSteps: RecipeStep[];
  loading: boolean;
  error: string | null;

  // Actions
  loadRecipes: () => Promise<void>;
  addRecipe: (data: {
    menuItemId: string;
    cookingTime?: number;
    difficultyLevel?: 'easy' | 'medium' | 'hard';
    notes?: string;
    ingredients: { inventoryItemId: string; quantityRequired: number; unit: string }[];
    steps: { stepOrder: number; instruction: string }[];
  }) => Promise<Recipe>;
  updateRecipe: (id: string, updates: {
    cookingTime?: number;
    difficultyLevel?: 'easy' | 'medium' | 'hard';
    notes?: string;
    ingredients?: { inventoryItemId: string; quantityRequired: number; unit: string }[];
    steps?: { stepOrder: number; instruction: string }[];
  }) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  getRecipeByMenuItem: (menuItemId: string) => Promise<Recipe | undefined>;
  getRecipeWithDetails: (recipeId: string) => Promise<{
    recipe: Recipe;
    ingredients: RecipeIngredient[];
    steps: RecipeStep[];
  } | null>;
  linkIngredientToInventory: (recipeId: string, inventoryItemId: string, quantity: number, unit: string) => Promise<void>;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      recipeIngredients: [],
      recipeSteps: [],
      loading: false,
      error: null,

      loadRecipes: async () => {
        set({ loading: true, error: null });
        try {
          const recipes = await db.recipes.toArray();
          const ingredients = await db.recipeIngredients.toArray();
          const steps = await db.recipeSteps.toArray();
          set({ recipes, recipeIngredients: ingredients, recipeSteps: steps, loading: false });
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      addRecipe: async (data) => {
        set({ loading: true, error: null });
        try {
          const now = new Date().toISOString();
          const recipeId = generateId();

          const recipe: Recipe = {
            id: recipeId,
            menuItemId: data.menuItemId,
            cookingTime: data.cookingTime,
            difficultyLevel: data.difficultyLevel,
            notes: data.notes,
            syncId: generateId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          };

          const ingredients: RecipeIngredient[] = data.ingredients.map((ing) => ({
            id: generateId(),
            recipeId,
            inventoryItemId: ing.inventoryItemId,
            quantityRequired: ing.quantityRequired,
            unit: ing.unit,
            syncId: generateId(),
            syncStatus: 'pending' as const,
            createdAt: now,
            updatedAt: now,
          }));

          const steps: RecipeStep[] = data.steps.map((step) => ({
            id: generateId(),
            recipeId,
            stepOrder: step.stepOrder,
            instruction: step.instruction,
            syncId: generateId(),
            syncStatus: 'pending' as const,
            createdAt: now,
            updatedAt: now,
          }));

          await db.transaction('rw', [db.recipes, db.recipeIngredients, db.recipeSteps], async () => {
            await db.recipes.add(recipe);
            if (ingredients.length > 0) await db.recipeIngredients.bulkAdd(ingredients);
            if (steps.length > 0) await db.recipeSteps.bulkAdd(steps);
          });

          set((state) => ({
            recipes: [...state.recipes, recipe],
            recipeIngredients: [...state.recipeIngredients, ...ingredients],
            recipeSteps: [...state.recipeSteps, ...steps],
            loading: false,
          }));
          notifySync();

          return recipe;
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
          throw e;
        }
      },

      updateRecipe: async (id, updates) => {
        set({ loading: true, error: null });
        try {
          const now = new Date().toISOString();

          await db.transaction('rw', [db.recipes, db.recipeIngredients, db.recipeSteps], async () => {
            await db.recipes.update(id, {
              ...(updates.cookingTime !== undefined && { cookingTime: updates.cookingTime }),
              ...(updates.difficultyLevel !== undefined && { difficultyLevel: updates.difficultyLevel }),
              ...(updates.notes !== undefined && { notes: updates.notes }),
              updatedAt: now,
              syncStatus: 'pending',
            });

            if (updates.ingredients) {
              await db.recipeIngredients.where('recipeId').equals(id).delete();
              const newIngredients: RecipeIngredient[] = updates.ingredients.map((ing) => ({
                id: generateId(),
                recipeId: id,
                inventoryItemId: ing.inventoryItemId,
                quantityRequired: ing.quantityRequired,
                unit: ing.unit,
                syncId: generateId(),
                syncStatus: 'pending' as const,
                createdAt: now,
                updatedAt: now,
              }));
              if (newIngredients.length > 0) await db.recipeIngredients.bulkAdd(newIngredients);
            }

            if (updates.steps) {
              await db.recipeSteps.where('recipeId').equals(id).delete();
              const newSteps: RecipeStep[] = updates.steps.map((step) => ({
                id: generateId(),
                recipeId: id,
                stepOrder: step.stepOrder,
                instruction: step.instruction,
                syncId: generateId(),
                syncStatus: 'pending' as const,
                createdAt: now,
                updatedAt: now,
              }));
              if (newSteps.length > 0) await db.recipeSteps.bulkAdd(newSteps);
            }
          });

          // Reload from DB to get fresh state
          const recipes = await db.recipes.toArray();
          const ingredients = await db.recipeIngredients.toArray();
          const steps = await db.recipeSteps.toArray();
          set({ recipes, recipeIngredients: ingredients, recipeSteps: steps, loading: false });
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      deleteRecipe: async (id) => {
        set({ loading: true, error: null });
        try {
          await db.transaction('rw', [db.recipes, db.recipeIngredients, db.recipeSteps], async () => {
            await db.recipeIngredients.where('recipeId').equals(id).delete();
            await db.recipeSteps.where('recipeId').equals(id).delete();
            await db.recipes.delete(id);
          });

          set((state) => ({
            recipes: state.recipes.filter((r) => r.id !== id),
            recipeIngredients: state.recipeIngredients.filter((ri) => ri.recipeId !== id),
            recipeSteps: state.recipeSteps.filter((rs) => rs.recipeId !== id),
            loading: false,
          }));
          notifySync();
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      getRecipeByMenuItem: async (menuItemId) => {
        return await db.recipes.where('menuItemId').equals(menuItemId).first();
      },

      getRecipeWithDetails: async (recipeId) => {
        const recipe = await db.recipes.get(recipeId);
        if (!recipe) return null;
        const ingredients = await db.recipeIngredients.where('recipeId').equals(recipeId).toArray();
        const steps = await db.recipeSteps.where('recipeId').equals(recipeId).sortBy('stepOrder');
        return { recipe, ingredients, steps };
      },

      linkIngredientToInventory: async (recipeId, inventoryItemId, quantity, unit) => {
        const now = new Date().toISOString();
        const ingredient: RecipeIngredient = {
          id: generateId(),
          recipeId,
          inventoryItemId,
          quantityRequired: quantity,
          unit,
          syncId: generateId(),
          syncStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        };
        await db.recipeIngredients.add(ingredient);
        set((state) => ({
          recipeIngredients: [...state.recipeIngredients, ingredient],
        }));
        notifySync();
      },
    }),
    {
      name: 'recipe-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        recipes: state.recipes,
        recipeIngredients: state.recipeIngredients,
        recipeSteps: state.recipeSteps,
      }),
    }
  )
);
