// Screen: S-003 | Interface: waiter-cashier-ui | Roles: waiter-cashier, owner
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useOrderManagementStore } from '@/stores/useOrderManagementStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useShiftManagementStore } from '@/stores/useShiftManagementStore';
import { TableSelector } from '@/components/order/TableSelector';
import { MenuItemCard } from '@/components/order/MenuItemCard';
import { OrderSummarySidebar, type CartItem } from '@/components/order/OrderSummarySidebar';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { MenuItem } from '@/types';

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedTableId = searchParams.get('tableId');
  const addToOrderId = searchParams.get('addToOrder');

  const [selectedTableId, setSelectedTableId] = useState<string | null>(preselectedTableId);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    tables,
    loading: tablesLoading,
    loadTables,
    createOrder,
    addItemsToOrder,
    getActiveOrderForTable,
  } = useOrderManagementStore();

  const {
    menuItems,
    menuCategories,
    loading: menuLoading,
    loadMenuItems,
    loadCategories,
  } = useMenuStore();

  const currentUser = useAuthStore((s) => s.currentUser);
  const activeShift = useShiftManagementStore((s) => s.activeShift);
  const getPPNRate = useSettingsStore((s) => s.getPPNRate);
  const getActiveDiscounts = useSettingsStore((s) => s.getActiveDiscounts);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadTables();
    loadMenuItems();
    loadCategories();
    loadSettings();
  }, [loadTables, loadMenuItems, loadCategories, loadSettings]);

  const activeOrderForSelectedTable = useMemo(() => {
    if (!selectedTableId) return undefined;
    return getActiveOrderForTable(selectedTableId);
  }, [selectedTableId, getActiveOrderForTable]);

  const isAddMode = !!addToOrderId || !!activeOrderForSelectedTable;

  const activeDiscounts = useMemo(() => getActiveDiscounts(), [getActiveDiscounts]);
  const ppnRate = useMemo(() => getPPNRate(), [getPPNRate]);

  const filteredMenuItems = useMemo(() => {
    let items = menuItems.filter((item) => item.isAvailable);
    if (selectedCategoryId) {
      items = items.filter((item) => item.categoryId === selectedCategoryId);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => item.itemName.toLowerCase().includes(query));
    }
    return items;
  }, [menuItems, selectedCategoryId, searchQuery]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cartItems]
  );

  const discountAmount = 0; // discount selection is handled separately
  const ppnAmount = useMemo(
    () => (subtotal - discountAmount) * (ppnRate / 100),
    [subtotal, discountAmount, ppnRate]
  );
  const grandTotal = useMemo(
    () => (subtotal - discountAmount) + ppnAmount,
    [subtotal, discountAmount, ppnAmount]
  );

  const handleAddMenuItem = useCallback((item: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        menuItemId: item.id,
        itemName: item.itemName,
        quantity: 1,
        unitPrice: item.price,
      }];
    });
  }, []);

  const handleUpdateQuantity = useCallback((menuItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev.map((c) =>
        c.menuItemId === menuItemId
          ? { ...c, quantity: Math.max(1, c.quantity + delta) }
          : c
      )
    );
  }, []);

  const handleRemoveItem = useCallback((menuItemId: string) => {
    setCartItems((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
  }, []);

  const handleUpdateNotes = useCallback((menuItemId: string, notes: string) => {
    setCartItems((prev) =>
      prev.map((c) =>
        c.menuItemId === menuItemId ? { ...c, specialNotes: notes || undefined } : c
      )
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedTableId || cartItems.length === 0 || !currentUser) return;

    setSubmitting(true);
    try {
      const existingOrder = addToOrderId ?? activeOrderForSelectedTable?.id;
      if (existingOrder) {
        await addItemsToOrder(existingOrder, cartItems);
      } else {
        await createOrder({
          tableId: selectedTableId,
          waiterId: currentUser.id,
          shiftId: activeShift?.id,
          items: cartItems,
          specialNotes: orderNotes || undefined,
          ppnRate,
        });
      }
      navigate('/pos/orders');
    } catch {
      // error captured in store
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedTableId, cartItems, currentUser, addToOrderId,
    activeOrderForSelectedTable, addItemsToOrder, createOrder,
    activeShift, orderNotes, ppnRate, navigate,
  ]);

  if (tablesLoading && tables.length === 0) {
    return <LoadingSpinner size="lg" message="Memuat data..." />;
  }

  return (
    <div className="flex flex-col h-full -m-4">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/pos/orders')}
          className="text-text-secondary hover:text-text-primary"
          aria-label="Kembali"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-text-primary font-medium text-sm">
            {isAddMode ? 'Tambah Pesanan' : 'Buat Pesanan Baru'}
          </h1>
          {isAddMode && activeOrderForSelectedTable && (
            <p className="text-text-secondary text-xs">
              Menambah ke {activeOrderForSelectedTable.orderNumber}
            </p>
          )}
        </div>
      </div>

      {/* Table Selector */}
      {!addToOrderId && (
        <div className="bg-surface border-b border-border px-4 py-3">
          <label className="text-text-secondary text-xs mb-2 block">Pilih Meja</label>
          <TableSelector
            tables={tables}
            selectedTableId={selectedTableId}
            onSelect={setSelectedTableId}
            activeOrderTableId={activeOrderForSelectedTable?.tableId}
          />
          {selectedTableId && activeOrderForSelectedTable && (
            <div className="mt-2 bg-warning/10 border border-warning/30 rounded px-3 py-2">
              <p className="text-warning text-xs">
                Meja ini sudah memiliki pesanan aktif ({activeOrderForSelectedTable.orderNumber}). Item baru akan ditambahkan sebagai Tambahan.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active Promo Banner */}
      {activeDiscounts.length > 0 && (
        <div className="bg-primary/5 border-b border-primary/20 px-4 py-2">
          <p className="text-primary text-xs">
            Promo aktif: {activeDiscounts.map((d) => d.discountName).join(', ')}
          </p>
        </div>
      )}

      {/* Main Content: Menu Browser + Order Summary */}
      <div className="flex-1 flex overflow-hidden">
        {/* Menu Browser */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="px-4 py-3 border-b border-border">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Cari menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-elevated text-text-primary text-sm rounded-lg border border-border focus:border-primary focus:outline-none placeholder:text-text-secondary/50"
                aria-label="Cari menu"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="px-4 py-2 border-b border-border flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={clsx(
                'shrink-0 px-3 py-1.5 text-xs rounded-full transition-colors',
                selectedCategoryId === null
                  ? 'bg-primary text-white'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              )}
            >
              Semua
            </button>
            {menuCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={clsx(
                  'shrink-0 px-3 py-1.5 text-xs rounded-full transition-colors',
                  selectedCategoryId === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-auto p-4">
            {menuLoading && menuItems.length === 0 ? (
              <LoadingSpinner size="md" message="Memuat menu..." />
            ) : filteredMenuItems.length === 0 ? (
              <p className="text-text-secondary text-sm text-center py-8">
                Tidak ada menu ditemukan
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredMenuItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} onAdd={handleAddMenuItem} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Order Summary Sidebar (visible on larger screens or as bottom sheet on mobile) */}
        <div className="hidden md:flex w-80 border-l border-border">
          <OrderSummarySidebar
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onUpdateNotes={handleUpdateNotes}
            subtotal={subtotal}
            discountAmount={discountAmount}
            ppnRate={ppnRate}
            ppnAmount={ppnAmount}
            grandTotal={grandTotal}
            onSubmit={handleSubmit}
            submitting={submitting}
            orderNotes={orderNotes}
            onOrderNotesChange={setOrderNotes}
            isAddMode={isAddMode}
          />
        </div>
      </div>

      {/* Mobile: Sticky bottom bar with cart summary */}
      <div className="md:hidden bg-surface border-t border-border px-4 py-3 safe-bottom">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-secondary text-xs">{cartItems.length} item</span>
          <span className="text-text-primary font-medium text-sm">
            Rp {grandTotal.toLocaleString('id-ID')}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!selectedTableId || cartItems.length === 0 || submitting}
          className="w-full py-3 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting
            ? 'Mengirim...'
            : isAddMode
              ? `Tambah Pesanan (${cartItems.length} item)`
              : `Kirim Pesanan (${cartItems.length} item)`}
        </button>
      </div>
    </div>
  );
}
