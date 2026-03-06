// Screen: S-011 | Interface: admin-panel | Roles: owner
import { useState, useEffect, useMemo } from 'react';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Search, Plus, Package, AlertTriangle, XCircle, X, ArrowUpCircle,
  SlidersHorizontal, History, Trash2, Edit2,
} from 'lucide-react';
import clsx from 'clsx';
import type { InventoryItem, StockMovement } from '@/types';
import type { StockStatus } from '@/types/enums';

const STATUS_LABELS: Record<StockStatus, string> = { ok: 'Aman', low: 'Rendah', critical: 'Kritis' };
const STATUS_COLORS: Record<StockStatus, string> = {
  ok: 'bg-green-500/20 text-green-400',
  low: 'bg-yellow-500/20 text-yellow-400',
  critical: 'bg-red-500/20 text-red-400',
};

export default function InventoryManagementPage() {
  const {
    inventoryItems, loading, error,
    loadInventoryItems, addStock, updateItem, deleteItem,
    restockItem, adjustStock, loadMovements, stockMovements,
  } = useInventoryStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [restockTarget, setRestockTarget] = useState<InventoryItem | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [historyTarget, setHistoryTarget] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  useEffect(() => { loadInventoryItems(); }, [loadInventoryItems]);

  useEffect(() => {
    if (historyTarget) loadMovements(historyTarget.id);
  }, [historyTarget, loadMovements]);

  const filtered = useMemo(() => {
    let items = inventoryItems;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.itemName.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      items = items.filter((i) => i.stockStatus === statusFilter);
    }
    return items;
  }, [inventoryItems, search, statusFilter]);

  const lowCount = inventoryItems.filter((i) => i.stockStatus === 'low').length;
  const criticalCount = inventoryItems.filter((i) => i.stockStatus === 'critical').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Manajemen Stok</h1>
          <p className="text-text-secondary text-sm mt-1">
            {inventoryItems.length} item | {lowCount} rendah | {criticalCount} kritis
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Tambah Item
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari item..." className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | StockStatus)} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary">
          <option value="all">Semua Status</option>
          <option value="ok">Aman</option>
          <option value="low">Rendah</option>
          <option value="critical">Kritis</option>
        </select>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left px-4 py-3 font-medium">Nama Item</th>
                <th className="text-right px-4 py-3 font-medium">Stok</th>
                <th className="text-left px-4 py-3 font-medium">Satuan</th>
                <th className="text-right px-4 py-3 font-medium">Min. Threshold</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && !inventoryItems.length ? (
                <tr><td colSpan={6} className="text-center py-12 text-text-secondary">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-text-secondary">Tidak ada item ditemukan</td></tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-background/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-text-secondary" />
                      <span className="text-text-primary font-medium">{item.itemName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary font-mono">{item.quantity}</td>
                  <td className="px-4 py-3 text-text-secondary">{item.unit}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono">{item.minimumThreshold ?? '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', STATUS_COLORS[item.stockStatus])}>
                      {STATUS_LABELS[item.stockStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setRestockTarget(item)} title="Restok" className="p-1.5 hover:bg-green-500/10 rounded text-green-400"><ArrowUpCircle size={16} /></button>
                      <button onClick={() => setAdjustTarget(item)} title="Koreksi" className="p-1.5 hover:bg-yellow-500/10 rounded text-yellow-400"><SlidersHorizontal size={16} /></button>
                      <button onClick={() => setHistoryTarget(item)} title="Riwayat" className="p-1.5 hover:bg-blue-500/10 rounded text-blue-400"><History size={16} /></button>
                      <button onClick={() => setEditItem(item)} title="Edit" className="p-1.5 hover:bg-primary/10 rounded text-primary"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleteTarget(item)} title="Hapus" className="p-1.5 hover:bg-red-500/10 rounded text-red-400"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Item Modal */}
      {(showAddModal || editItem) && (
        <ItemFormModal
          item={editItem}
          onClose={() => { setShowAddModal(false); setEditItem(null); }}
          onSave={async (data) => {
            if (editItem) {
              await updateItem(editItem.id, { itemName: data.itemName, unit: data.unit, minimumThreshold: data.minimumThreshold });
            } else {
              await addStock(data);
            }
            setShowAddModal(false);
            setEditItem(null);
          }}
        />
      )}

      {/* Restock Modal */}
      {restockTarget && (
        <RestockModal
          item={restockTarget}
          onClose={() => setRestockTarget(null)}
          onRestock={async (qty, reason) => {
            await restockItem(restockTarget.id, qty, reason, 'owner');
            setRestockTarget(null);
          }}
        />
      )}

      {/* Adjust Modal */}
      {adjustTarget && (
        <AdjustModal
          item={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onAdjust={async (newQty, reason) => {
            await adjustStock(adjustTarget.id, newQty, reason, 'owner');
            setAdjustTarget(null);
          }}
        />
      )}

      {/* Movement History Drawer */}
      {historyTarget && (
        <MovementHistoryDrawer
          item={historyTarget}
          movements={stockMovements}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          itemName={deleteTarget.itemName}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteItem(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function ItemFormModal({ item, onClose, onSave }: {
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (data: { itemName: string; quantity: number; unit: string; minimumThreshold?: number }) => Promise<void>;
}) {
  const [name, setName] = useState(item?.itemName ?? '');
  const [qty, setQty] = useState(item?.quantity?.toString() ?? '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [threshold, setThreshold] = useState(item?.minimumThreshold?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) return;
    setSaving(true);
    await onSave({
      itemName: name.trim(),
      quantity: parseFloat(qty) || 0,
      unit: unit.trim(),
      minimumThreshold: threshold ? parseFloat(threshold) : undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">{item ? 'Edit Item' : 'Tambah Item Baru'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Nama Item</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          {!item && (
            <div>
              <label className="block text-sm text-text-secondary mb-1">Jumlah Awal</label>
              <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} min="0" step="any" required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
            </div>
          )}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Satuan</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, liter, pcs, pack" required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Min. Threshold (opsional)</label>
            <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} min="0" step="any" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-text-secondary px-4 py-2 rounded-lg text-sm hover:bg-background">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RestockModal({ item, onClose, onRestock }: {
  item: InventoryItem;
  onClose: () => void;
  onRestock: (qty: number, reason: string) => Promise<void>;
}) {
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('Restok pembelian');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    if (!q || q <= 0) return;
    setSaving(true);
    await onRestock(q, reason);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Restok: {item.itemName}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
        </div>
        <p className="text-sm text-text-secondary mb-4">Stok saat ini: <span className="font-mono text-text-primary">{item.quantity} {item.unit}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Jumlah Tambahan</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} min="0.01" step="any" required autoFocus className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Alasan</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-text-secondary px-4 py-2 rounded-lg text-sm hover:bg-background">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Menyimpan...' : 'Restok'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdjustModal({ item, onClose, onAdjust }: {
  item: InventoryItem;
  onClose: () => void;
  onAdjust: (newQty: number, reason: string) => Promise<void>;
}) {
  const [newQty, setNewQty] = useState(item.quantity.toString());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    await onAdjust(parseFloat(newQty) || 0, reason.trim());
    setSaving(false);
  };

  const delta = (parseFloat(newQty) || 0) - item.quantity;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Koreksi Stok: {item.itemName}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
        </div>
        <p className="text-sm text-text-secondary mb-4">Stok saat ini: <span className="font-mono text-text-primary">{item.quantity} {item.unit}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Jumlah Baru</label>
            <input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} min="0" step="any" required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
            {delta !== 0 && (
              <p className={clsx('text-xs mt-1', delta > 0 ? 'text-green-400' : 'text-red-400')}>
                {delta > 0 ? '+' : ''}{delta} {item.unit}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Alasan (wajib)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-text-secondary px-4 py-2 rounded-lg text-sm hover:bg-background">Batal</button>
            <button type="submit" disabled={saving || !reason.trim()} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Menyimpan...' : 'Koreksi'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MovementHistoryDrawer({ item, movements, onClose }: {
  item: InventoryItem;
  movements: StockMovement[];
  onClose: () => void;
}) {
  const typeLabels: Record<string, string> = {
    restock: 'Restok',
    auto_deduction: 'Deduksi Otomatis',
    manual_adjustment: 'Koreksi Manual',
  };
  const typeColors: Record<string, string> = {
    restock: 'text-green-400',
    auto_deduction: 'text-red-400',
    manual_adjustment: 'text-yellow-400',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-surface border-l border-border w-full max-w-lg h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Riwayat Pergerakan</h2>
            <p className="text-sm text-text-secondary">{item.itemName}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
        </div>
        {movements.length === 0 ? (
          <p className="text-center text-text-secondary py-12">Belum ada riwayat pergerakan</p>
        ) : (
          <div className="space-y-3">
            {movements.map((m) => (
              <div key={m.id} className="bg-background border border-border/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={clsx('text-sm font-medium', typeColors[m.movementType] ?? 'text-text-primary')}>
                    {typeLabels[m.movementType] ?? m.movementType}
                  </span>
                  <span className={clsx('text-sm font-mono font-medium', m.quantityChange >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {m.quantityChange >= 0 ? '+' : ''}{m.quantityChange} {item.unit}
                  </span>
                </div>
                {m.reason && <p className="text-xs text-text-secondary">{m.reason}</p>}
                <p className="text-xs text-text-secondary mt-1">
                  {format(new Date(m.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteConfirmModal({ itemName, onClose, onConfirm }: {
  itemName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/10 rounded-full"><AlertTriangle size={20} className="text-red-400" /></div>
          <h2 className="text-lg font-semibold text-text-primary">Hapus Item?</h2>
        </div>
        <p className="text-sm text-text-secondary mb-6">Apakah Anda yakin ingin menghapus <strong className="text-text-primary">{itemName}</strong>? Item yang digunakan oleh resep tidak dapat dihapus.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-border text-text-secondary px-4 py-2 rounded-lg text-sm hover:bg-background">Batal</button>
          <button onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false); }} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{deleting ? 'Menghapus...' : 'Hapus'}</button>
        </div>
      </div>
    </div>
  );
}
