// Screen: S-007 | Interface: kitchen-display | Roles: chef, owner
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, BarChart3, BookOpen, AlertCircle } from 'lucide-react';
import { db } from '@/db/database';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { clsx } from 'clsx';
import type { Recipe, RecipeIngredient, RecipeStep, MenuItem } from '@/types';

interface RecipeViewData {
  recipe: Recipe;
  menuItem: MenuItem | null;
  ingredients: (RecipeIngredient & { inventoryItemName: string })[];
  steps: RecipeStep[];
}

export default function RecipeViewerPage() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<RecipeViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recipeId) {
      setError('Recipe ID tidak ditemukan');
      setLoading(false);
      return;
    }

    loadRecipe(recipeId);
  }, [recipeId]);

  async function loadRecipe(id: string) {
    setLoading(true);
    setError(null);
    try {
      const recipe = await db.recipes.get(id);
      if (!recipe) {
        setError('Resep tidak ditemukan');
        setLoading(false);
        return;
      }

      const menuItem = await db.menuItems.get(recipe.menuItemId) ?? null;

      const rawIngredients = await db.recipeIngredients
        .where('recipeId')
        .equals(id)
        .toArray();

      const ingredients = await Promise.all(
        rawIngredients.map(async (ing) => {
          const invItem = await db.inventoryItems.get(ing.inventoryItemId);
          return {
            ...ing,
            inventoryItemName: invItem?.itemName ?? 'Item tidak ditemukan',
          };
        })
      );

      const steps = await db.recipeSteps
        .where('[recipeId+stepOrder]')
        .between([id, 0], [id, Infinity])
        .toArray();

      steps.sort((a, b) => a.stepOrder - b.stepOrder);

      setData({ recipe, menuItem, ingredients, steps });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat resep');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" message="Memuat resep..." />;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="flex items-center gap-2 text-error">
          <AlertCircle size={20} />
          <span className="text-sm">{error ?? 'Resep tidak ditemukan'}</span>
        </div>
        <button
          onClick={() => navigate('/kitchen/queue')}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft size={16} />
          Kembali ke Antrian
        </button>
      </div>
    );
  }

  const { recipe, menuItem, ingredients, steps } = data;
  const difficultyColors = {
    easy: 'bg-success/20 text-success',
    medium: 'bg-warning/20 text-warning',
    hard: 'bg-error/20 text-error',
  };
  const difficultyLabels = {
    easy: 'Mudah',
    medium: 'Sedang',
    hard: 'Sulit',
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/kitchen/queue')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors mb-3 self-start"
        aria-label="Kembali ke antrian"
      >
        <ArrowLeft size={16} />
        <span>Kembali</span>
      </button>

      {/* Recipe Header */}
      <section className="bg-surface rounded-lg border border-border p-4 mb-3" aria-label="Informasi resep">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={18} className="text-primary" />
              <h1 className="text-xl font-bold text-text-primary">
                {menuItem?.itemName ?? 'Resep'}
              </h1>
            </div>
            {menuItem?.description && (
              <p className="text-sm text-text-secondary">{menuItem.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {recipe.cookingTime != null && (
              <div className="flex items-center gap-1 text-sm text-text-secondary bg-surface-elevated px-2 py-1 rounded">
                <Clock size={14} />
                <span>{recipe.cookingTime} menit</span>
              </div>
            )}
            {recipe.difficultyLevel && (
              <span
                className={clsx(
                  'px-2 py-1 rounded text-xs font-medium',
                  difficultyColors[recipe.difficultyLevel]
                )}
              >
                <BarChart3 size={12} className="inline mr-1" />
                {difficultyLabels[recipe.difficultyLevel]}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Content: Ingredients + Steps side by side on tablet, stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
        {/* Ingredients */}
        <section className="bg-surface rounded-lg border border-border p-4" aria-label="Bahan-bahan">
          <h2 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
            Bahan-bahan
            <span className="text-xs text-text-secondary font-normal">({ingredients.length} item)</span>
          </h2>
          {ingredients.length === 0 ? (
            <p className="text-sm text-text-secondary italic">Belum ada bahan yang ditambahkan</p>
          ) : (
            <ul className="space-y-2" role="list">
              {ingredients.map((ing) => (
                <li
                  key={ing.id}
                  className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                >
                  <span className="text-sm text-text-primary">{ing.inventoryItemName}</span>
                  <span className="text-sm text-text-secondary font-medium">
                    {ing.quantityRequired} {ing.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Cooking Steps */}
        <section className="bg-surface rounded-lg border border-border p-4" aria-label="Langkah memasak">
          <h2 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
            Langkah Memasak
            <span className="text-xs text-text-secondary font-normal">({steps.length} langkah)</span>
          </h2>
          {steps.length === 0 ? (
            <p className="text-sm text-text-secondary italic">Belum ada langkah yang ditambahkan</p>
          ) : (
            <ol className="space-y-3" role="list">
              {steps.map((step) => (
                <li key={step.id} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                    {step.stepOrder}
                  </span>
                  <p className="text-sm text-text-primary leading-relaxed">{step.instruction}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Notes */}
      {recipe.notes && (
        <section className="bg-surface rounded-lg border border-border p-4 mt-3" aria-label="Catatan">
          <h2 className="text-sm font-bold text-text-primary mb-2">Catatan & Tips</h2>
          <p className="text-sm text-text-secondary leading-relaxed">{recipe.notes}</p>
        </section>
      )}
    </div>
  );
}
