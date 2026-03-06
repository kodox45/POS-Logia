// Screen: S-010 | Interface: admin-panel | Roles: owner
import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  ArrowLeft,
  Clock,
  ChefHat,
  Package,
  ListOrdered,
} from 'lucide-react';
import { useRecipeStore } from '@/stores/useRecipeStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { Recipe, RecipeIngredient, RecipeStep } from '@/types';
import { clsx } from 'clsx';
import type { DifficultyLevel } from '@/types/enums';

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: 'Mudah',
  medium: 'Sedang',
  hard: 'Sulit',
};

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  easy: 'bg-success/20 text-success',
  medium: 'bg-warning/20 text-warning',
  hard: 'bg-error/20 text-error',
};

interface RecipeFormIngredient {
  inventoryItemId: string;
  quantityRequired: string;
  unit: string;
}

interface RecipeFormStep {
  instruction: string;
}

interface RecipeFormData {
  menuItemId: string;
  cookingTime: string;
  difficultyLevel: DifficultyLevel | '';
  notes: string;
  ingredients: RecipeFormIngredient[];
  steps: RecipeFormStep[];
}

const EMPTY_FORM: RecipeFormData = {
  menuItemId: '',
  cookingTime: '',
  difficultyLevel: '',
  notes: '',
  ingredients: [{ inventoryItemId: '', quantityRequired: '', unit: '' }],
  steps: [{ instruction: '' }],
};

export default function RecipeManagementPage() {
  const {
    recipes,
    recipeIngredients,
    recipeSteps,
    loading,
    error,
    loadRecipes,
    addRecipe,
    updateRecipe,
    deleteRecipe,
  } = useRecipeStore();

  const { menuItems, loadMenuItems } = useMenuStore();
  const { inventoryItems, loadInventoryItems } = useInventoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewingRecipe, setViewingRecipe] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [form, setForm] = useState<RecipeFormData>(EMPTY_FORM);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadRecipes();
    loadMenuItems();
    loadInventoryItems();
  }, [loadRecipes, loadMenuItems, loadInventoryItems]);

  const getMenuItemName = useCallback(
    (menuItemId: string) => menuItems.find((m) => m.id === menuItemId)?.itemName || 'Unknown',
    [menuItems]
  );

  const getInventoryItemName = useCallback(
    (inventoryItemId: string) => inventoryItems.find((i) => i.id === inventoryItemId)?.itemName || 'Unknown',
    [inventoryItems]
  );

  const getRecipeIngredients = useCallback(
    (recipeId: string): RecipeIngredient[] => recipeIngredients.filter((ri) => ri.recipeId === recipeId),
    [recipeIngredients]
  );

  const getRecipeSteps = useCallback(
    (recipeId: string): RecipeStep[] => recipeSteps.filter((rs) => rs.recipeId === recipeId).sort((a, b) => a.stepOrder - b.stepOrder),
    [recipeSteps]
  );

  const filteredRecipes = recipes.filter((r) => {
    const menuName = getMenuItemName(r.menuItemId);
    return menuName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const menuItemsWithoutRecipe = menuItems.filter(
    (mi) => !recipes.some((r) => r.menuItemId === mi.id)
  );

  const openAddRecipe = () => {
    setEditingRecipe(null);
    setForm(EMPTY_FORM);
    setShowFormModal(true);
  };

  const openEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    const ings = getRecipeIngredients(recipe.id);
    const steps = getRecipeSteps(recipe.id);
    setForm({
      menuItemId: recipe.menuItemId,
      cookingTime: recipe.cookingTime ? String(recipe.cookingTime) : '',
      difficultyLevel: recipe.difficultyLevel || '',
      notes: recipe.notes || '',
      ingredients: ings.length > 0
        ? ings.map((i) => ({ inventoryItemId: i.inventoryItemId, quantityRequired: String(i.quantityRequired), unit: i.unit }))
        : [{ inventoryItemId: '', quantityRequired: '', unit: '' }],
      steps: steps.length > 0
        ? steps.map((s) => ({ instruction: s.instruction }))
        : [{ instruction: '' }],
    });
    setShowFormModal(true);
  };

  const handleSaveRecipe = async () => {
    if (!form.menuItemId) return;
    const validIngredients = form.ingredients.filter((i) => i.inventoryItemId && i.quantityRequired && i.unit);
    const validSteps = form.steps.filter((s) => s.instruction.trim());

    if (editingRecipe) {
      await updateRecipe(editingRecipe.id, {
        cookingTime: form.cookingTime ? Number(form.cookingTime) : undefined,
        difficultyLevel: form.difficultyLevel as DifficultyLevel || undefined,
        notes: form.notes.trim() || undefined,
        ingredients: validIngredients.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          quantityRequired: Number(i.quantityRequired),
          unit: i.unit,
        })),
        steps: validSteps.map((s, idx) => ({
          stepOrder: idx + 1,
          instruction: s.instruction.trim(),
        })),
      });
    } else {
      await addRecipe({
        menuItemId: form.menuItemId,
        cookingTime: form.cookingTime ? Number(form.cookingTime) : undefined,
        difficultyLevel: form.difficultyLevel as DifficultyLevel || undefined,
        notes: form.notes.trim() || undefined,
        ingredients: validIngredients.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          quantityRequired: Number(i.quantityRequired),
          unit: i.unit,
        })),
        steps: validSteps.map((s, idx) => ({
          stepOrder: idx + 1,
          instruction: s.instruction.trim(),
        })),
      });
    }
    setShowFormModal(false);
  };

  const handleDeleteRecipe = async (id: string) => {
    await deleteRecipe(id);
    setShowDeleteConfirm(null);
    if (viewingRecipe === id) setViewingRecipe(null);
  };

  const addIngredientRow = () => {
    setForm({ ...form, ingredients: [...form.ingredients, { inventoryItemId: '', quantityRequired: '', unit: '' }] });
  };

  const removeIngredientRow = (idx: number) => {
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== idx) });
  };

  const updateIngredient = (idx: number, field: keyof RecipeFormIngredient, value: string) => {
    const updated = [...form.ingredients];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, ingredients: updated });
  };

  const addStepRow = () => {
    setForm({ ...form, steps: [...form.steps, { instruction: '' }] });
  };

  const removeStepRow = (idx: number) => {
    setForm({ ...form, steps: form.steps.filter((_, i) => i !== idx) });
  };

  const updateStep = (idx: number, value: string) => {
    const updated = [...form.steps];
    updated[idx] = { instruction: value };
    setForm({ ...form, steps: updated });
  };

  if (loading && recipes.length === 0) {
    return <LoadingSpinner size="lg" message="Memuat data resep..." />;
  }

  // Recipe Detail View
  if (viewingRecipe) {
    const recipe = recipes.find((r) => r.id === viewingRecipe);
    if (!recipe) {
      setViewingRecipe(null);
      return null;
    }
    const ings = getRecipeIngredients(recipe.id);
    const steps = getRecipeSteps(recipe.id);

    return (
      <div className="space-y-6">
        <button onClick={() => setViewingRecipe(null)} className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors">
          <ArrowLeft size={16} /> Kembali ke Daftar Resep
        </button>

        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{getMenuItemName(recipe.menuItemId)}</h2>
              <div className="flex items-center gap-4 mt-2">
                {recipe.cookingTime && (
                  <span className="flex items-center gap-1 text-sm text-text-secondary">
                    <Clock size={14} /> {recipe.cookingTime} menit
                  </span>
                )}
                {recipe.difficultyLevel && (
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', DIFFICULTY_COLORS[recipe.difficultyLevel])}>
                    {DIFFICULTY_LABELS[recipe.difficultyLevel]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEditRecipe(recipe)} className="p-2 text-text-secondary hover:text-primary rounded hover:bg-primary/10 transition-colors" aria-label="Edit resep">
                <Edit2 size={16} />
              </button>
              <button onClick={() => setShowDeleteConfirm(recipe.id)} className="p-2 text-text-secondary hover:text-error rounded hover:bg-error/10 transition-colors" aria-label="Hapus resep">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {recipe.notes && (
            <div className="bg-surface-elevated rounded p-3 mb-6">
              <p className="text-sm text-text-secondary">{recipe.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ingredients */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
                <Package size={16} /> Bahan ({ings.length})
              </h3>
              {ings.length > 0 ? (
                <div className="space-y-2">
                  {ings.map((ing) => (
                    <div key={ing.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-text-primary">{getInventoryItemName(ing.inventoryItemId)}</span>
                      <span className="text-sm text-text-secondary">{ing.quantityRequired} {ing.unit}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">Belum ada bahan</p>
              )}
            </div>

            {/* Steps */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
                <ListOrdered size={16} /> Langkah ({steps.length})
              </h3>
              {steps.length > 0 ? (
                <div className="space-y-3">
                  {steps.map((step, idx) => (
                    <div key={step.id} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-text-primary">{step.instruction}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">Belum ada langkah</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Recipe List View
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">Manajemen Resep</h1>

      {error && (
        <div className="bg-error/10 border border-error/30 text-error rounded px-4 py-3 text-sm">{error}</div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Cari resep berdasarkan menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={openAddRecipe}
          disabled={menuItemsWithoutRecipe.length === 0}
          className="bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Tambah Resep
        </button>
      </div>

      {/* Recipe Table */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="text-text-secondary text-left border-b border-border bg-surface-elevated">
                <th className="px-4 py-3">Menu</th>
                <th className="px-4 py-3 text-center">Waktu Masak</th>
                <th className="px-4 py-3 text-center">Kesulitan</th>
                <th className="px-4 py-3 text-center">Bahan</th>
                <th className="px-4 py-3 text-center">Langkah</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecipes.length > 0 ? (
                filteredRecipes.map((recipe) => {
                  const ingCount = getRecipeIngredients(recipe.id).length;
                  const stepCount = getRecipeSteps(recipe.id).length;
                  return (
                    <tr key={recipe.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/50 transition-colors cursor-pointer" onClick={() => setViewingRecipe(recipe.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChefHat size={16} className="text-primary shrink-0" />
                          <span className="text-text-primary font-medium">{getMenuItemName(recipe.menuItemId)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-text-secondary">
                        {recipe.cookingTime ? `${recipe.cookingTime} min` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {recipe.difficultyLevel ? (
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', DIFFICULTY_COLORS[recipe.difficultyLevel])}>
                            {DIFFICULTY_LABELS[recipe.difficultyLevel]}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-text-secondary">{ingCount}</td>
                      <td className="px-4 py-3 text-center text-text-secondary">{stepCount}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditRecipe(recipe)} className="p-1.5 text-text-secondary hover:text-primary rounded hover:bg-primary/10 transition-colors" aria-label="Edit resep">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setShowDeleteConfirm(recipe.id)} className="p-1.5 text-text-secondary hover:text-error rounded hover:bg-error/10 transition-colors" aria-label="Hapus resep">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-secondary">
                    {searchQuery ? 'Tidak ada resep yang cocok' : 'Belum ada resep. Klik "Tambah Resep" untuk memulai.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipe Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowFormModal(false)}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-lg shadow-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-text-primary">{editingRecipe ? 'Edit Resep' : 'Tambah Resep Baru'}</h2>
              <button onClick={() => setShowFormModal(false)} className="text-text-secondary hover:text-text-primary"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Menu Item Select */}
              <div>
                <label className="block text-sm text-text-secondary mb-1">Menu Item *</label>
                <select
                  value={form.menuItemId}
                  onChange={(e) => setForm({ ...form, menuItemId: e.target.value })}
                  disabled={!!editingRecipe}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary disabled:opacity-60"
                >
                  <option value="">Pilih menu</option>
                  {(editingRecipe ? menuItems : menuItemsWithoutRecipe).map((mi) => (
                    <option key={mi.id} value={mi.id}>{mi.itemName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Waktu Masak (menit)</label>
                  <input type="number" value={form.cookingTime} onChange={(e) => setForm({ ...form, cookingTime: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" min="1" placeholder="30" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Tingkat Kesulitan</label>
                  <select value={form.difficultyLevel} onChange={(e) => setForm({ ...form, difficultyLevel: e.target.value as DifficultyLevel | '' })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary">
                    <option value="">Pilih</option>
                    <option value="easy">Mudah</option>
                    <option value="medium">Sedang</option>
                    <option value="hard">Sulit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">Catatan</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary resize-none" rows={2} placeholder="Tips atau catatan tambahan" />
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-text-secondary font-medium">Bahan</label>
                  <button onClick={addIngredientRow} className="text-primary text-xs hover:text-primary-light flex items-center gap-1">
                    <Plus size={12} /> Tambah Bahan
                  </button>
                </div>
                <div className="space-y-2">
                  {form.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={ing.inventoryItemId}
                        onChange={(e) => updateIngredient(idx, 'inventoryItemId', e.target.value)}
                        className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
                      >
                        <option value="">Pilih bahan</option>
                        {inventoryItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.itemName}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={ing.quantityRequired}
                        onChange={(e) => updateIngredient(idx, 'quantityRequired', e.target.value)}
                        className="w-20 bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
                        placeholder="Jumlah"
                        min="0"
                        step="0.1"
                      />
                      <input
                        type="text"
                        value={ing.unit}
                        onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                        className="w-16 bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
                        placeholder="Satuan"
                      />
                      {form.ingredients.length > 1 && (
                        <button onClick={() => removeIngredientRow(idx)} className="text-text-secondary hover:text-error shrink-0">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-text-secondary font-medium">Langkah Memasak</label>
                  <button onClick={addStepRow} className="text-primary text-xs hover:text-primary-light flex items-center gap-1">
                    <Plus size={12} /> Tambah Langkah
                  </button>
                </div>
                <div className="space-y-2">
                  {form.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                        {idx + 1}
                      </span>
                      <textarea
                        value={step.instruction}
                        onChange={(e) => updateStep(idx, e.target.value)}
                        className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary resize-none"
                        rows={2}
                        placeholder={`Langkah ${idx + 1}`}
                      />
                      {form.steps.length > 1 && (
                        <button onClick={() => removeStepRow(idx)} className="text-text-secondary hover:text-error shrink-0 mt-1">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowFormModal(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Batal</button>
              <button
                onClick={handleSaveRecipe}
                disabled={!form.menuItemId}
                className="bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded px-4 py-2 text-sm font-medium transition-colors"
              >
                {editingRecipe ? 'Simpan Perubahan' : 'Tambah Resep'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-sm shadow-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Hapus Resep?</h3>
            <p className="text-sm text-text-secondary mb-6">Resep beserta bahan dan langkah-langkahnya akan dihapus secara permanen.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Batal</button>
              <button onClick={() => handleDeleteRecipe(showDeleteConfirm)} className="bg-error hover:bg-error/80 text-white rounded px-4 py-2 text-sm font-medium transition-colors">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
