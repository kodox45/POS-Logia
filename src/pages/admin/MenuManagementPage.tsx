// Screen: S-009 | Interface: admin-panel | Roles: owner
import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Upload,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useMenuStore } from '@/stores/useMenuStore';
import { useRecipeStore } from '@/stores/useRecipeStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { MenuItem, MenuCategory } from '@/types';
import { clsx } from 'clsx';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

interface MenuItemFormData {
  itemName: string;
  price: string;
  categoryId: string;
  description: string;
  isAvailable: boolean;
  imageUrl: string;
}

const EMPTY_FORM: MenuItemFormData = {
  itemName: '',
  price: '',
  categoryId: '',
  description: '',
  isAvailable: true,
  imageUrl: '',
};

export default function MenuManagementPage() {
  const {
    menuItems,
    menuCategories,
    loading,
    error,
    loadMenuItems,
    loadCategories,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useMenuStore();

  const { recipes, loadRecipes } = useRecipeStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [itemForm, setItemForm] = useState<MenuItemFormData>(EMPTY_FORM);
  const [categoryForm, setCategoryForm] = useState({ name: '', sortOrder: '0' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  useEffect(() => {
    loadMenuItems();
    loadCategories();
    loadRecipes();
  }, [loadMenuItems, loadCategories, loadRecipes]);

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.categoryId === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryName = useCallback(
    (categoryId: string) => menuCategories.find((c) => c.id === categoryId)?.name || '-',
    [menuCategories]
  );

  const hasRecipe = useCallback(
    (menuItemId: string) => recipes.some((r) => r.menuItemId === menuItemId),
    [recipes]
  );

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm(EMPTY_FORM);
    setShowItemModal(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      itemName: item.itemName,
      price: String(item.price),
      categoryId: item.categoryId,
      description: item.description || '',
      isAvailable: item.isAvailable,
      imageUrl: item.imageUrl || '',
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.itemName.trim() || !itemForm.price || !itemForm.categoryId) return;
    if (editingItem) {
      await updateMenuItem(editingItem.id, {
        itemName: itemForm.itemName.trim(),
        price: Number(itemForm.price),
        categoryId: itemForm.categoryId,
        description: itemForm.description.trim() || undefined,
        isAvailable: itemForm.isAvailable,
        imageUrl: itemForm.imageUrl.trim() || undefined,
      });
    } else {
      await addMenuItem({
        itemName: itemForm.itemName.trim(),
        price: Number(itemForm.price),
        categoryId: itemForm.categoryId,
        description: itemForm.description.trim() || undefined,
        isAvailable: itemForm.isAvailable,
        imageUrl: itemForm.imageUrl.trim() || undefined,
      });
    }
    setShowItemModal(false);
  };

  const handleDeleteItem = async (id: string) => {
    await deleteMenuItem(id);
    setShowDeleteConfirm(null);
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', sortOrder: String(menuCategories.length) });
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, sortOrder: String(cat.sortOrder ?? 0) });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return;
    if (editingCategory) {
      await updateCategory(editingCategory.id, {
        name: categoryForm.name.trim(),
        sortOrder: Number(categoryForm.sortOrder),
      });
    } else {
      await addCategory(categoryForm.name.trim(), Number(categoryForm.sortOrder));
    }
    setShowCategoryModal(false);
  };

  if (loading && menuItems.length === 0) {
    return <LoadingSpinner size="lg" message="Memuat data menu..." />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">Manajemen Menu</h1>

      {error && (
        <div className="bg-error/10 border border-error/30 text-error rounded px-4 py-3 text-sm">{error}</div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Cari menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary"
            />
          </div>
          <div className="relative">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-surface-elevated border border-border rounded px-3 py-2 text-sm text-text-primary appearance-none pr-8 focus:outline-none focus:border-primary"
            >
              <option value="all">Semua Kategori</option>
              {menuCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryManager(!showCategoryManager)}
            className="bg-surface-elevated border border-border text-text-primary rounded px-3 py-2 text-sm hover:border-primary transition-colors"
          >
            Kategori
          </button>
          <button
            onClick={openAddItem}
            className="bg-primary hover:bg-primary-dark text-white rounded px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Tambah Menu
          </button>
        </div>
      </div>

      {/* Category Manager */}
      {showCategoryManager && (
        <div className="bg-surface rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Kelola Kategori</h3>
            <button onClick={openAddCategory} className="text-primary text-sm hover:text-primary-light flex items-center gap-1">
              <Plus size={14} /> Tambah
            </button>
          </div>
          {menuCategories.length > 0 ? (
            <div className="space-y-2">
              {menuCategories.map((cat) => {
                const itemCount = menuItems.filter((i) => i.categoryId === cat.id).length;
                return (
                  <div key={cat.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <span className="text-sm text-text-primary">{cat.name}</span>
                      <span className="text-xs text-text-secondary ml-2">({itemCount} item)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditCategory(cat)} className="text-text-secondary hover:text-primary p-1"><Edit2 size={14} /></button>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="text-text-secondary hover:text-error p-1"
                        disabled={itemCount > 0}
                        title={itemCount > 0 ? 'Hapus item terlebih dahulu' : 'Hapus kategori'}
                      >
                        <Trash2 size={14} className={itemCount > 0 ? 'opacity-30' : ''} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Belum ada kategori</p>
          )}
        </div>
      )}

      {/* Menu Table */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="text-text-secondary text-left border-b border-border bg-surface-elevated">
                <th className="px-4 py-3">Nama Menu</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-center">Resep</th>
                <th className="px-4 py-3 text-center">Ketersediaan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.itemName} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-surface-elevated flex items-center justify-center text-text-secondary text-xs">?</div>
                        )}
                        <div>
                          <p className="text-text-primary font-medium">{item.itemName}</p>
                          {item.description && <p className="text-xs text-text-secondary truncate max-w-[200px]">{item.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{getCategoryName(item.categoryId)}</td>
                    <td className="px-4 py-3 text-right text-text-primary font-medium">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3 text-center">
                      {hasRecipe(item.id) ? (
                        <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">Ada</span>
                      ) : (
                        <span className="text-xs text-text-secondary">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleAvailability(item.id)} aria-label={item.isAvailable ? 'Nonaktifkan' : 'Aktifkan'}>
                        {item.isAvailable ? <ToggleRight size={24} className="text-success" /> : <ToggleLeft size={24} className="text-text-secondary" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditItem(item)} className="p-1.5 text-text-secondary hover:text-primary rounded hover:bg-primary/10 transition-colors" aria-label="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setShowDeleteConfirm(item.id)} className="p-1.5 text-text-secondary hover:text-error rounded hover:bg-error/10 transition-colors" aria-label="Hapus">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-secondary">
                    {searchQuery || filterCategory !== 'all' ? 'Tidak ada menu yang cocok dengan filter' : 'Belum ada menu. Klik "Tambah Menu" untuk memulai.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Menu Item Form Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowItemModal(false)}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{editingItem ? 'Edit Menu' : 'Tambah Menu Baru'}</h2>
              <button onClick={() => setShowItemModal(false)} className="text-text-secondary hover:text-text-primary"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Nama Menu *</label>
                <input type="text" value={itemForm.itemName} onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" placeholder="Nasi Goreng Spesial" />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Harga *</label>
                <input type="number" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" placeholder="25000" min="0" />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Kategori *</label>
                <select value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary">
                  <option value="">Pilih kategori</option>
                  {menuCategories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Deskripsi</label>
                <textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary resize-none" rows={2} placeholder="Deskripsi singkat" />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">URL Gambar</label>
                <div className="flex items-center gap-2">
                  <Upload size={16} className="text-text-secondary shrink-0" />
                  <input type="text" value={itemForm.imageUrl} onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" placeholder="https://..." />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Tersedia</span>
                <button onClick={() => setItemForm({ ...itemForm, isAvailable: !itemForm.isAvailable })}>
                  {itemForm.isAvailable ? <ToggleRight size={28} className="text-success" /> : <ToggleLeft size={28} className="text-text-secondary" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowItemModal(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Batal</button>
              <button onClick={handleSaveItem} disabled={!itemForm.itemName.trim() || !itemForm.price || !itemForm.categoryId} className="bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded px-4 py-2 text-sm font-medium transition-colors">
                {editingItem ? 'Simpan Perubahan' : 'Tambah Menu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-text-secondary hover:text-text-primary"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Nama Kategori *</label>
                <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" placeholder="Makanan Utama" />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Urutan</label>
                <input type="number" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" min="0" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Batal</button>
              <button onClick={handleSaveCategory} disabled={!categoryForm.name.trim()} className="bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded px-4 py-2 text-sm font-medium transition-colors">
                {editingCategory ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-sm shadow-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Hapus Menu?</h3>
            <p className="text-sm text-text-secondary mb-6">Item menu ini akan dihapus secara permanen.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Batal</button>
              <button onClick={() => handleDeleteItem(showDeleteConfirm)} className="bg-error hover:bg-error/80 text-white rounded px-4 py-2 text-sm font-medium transition-colors">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
