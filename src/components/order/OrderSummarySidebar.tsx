import { Minus, Plus, Trash2 } from 'lucide-react';

export interface CartItem {
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  specialNotes?: string;
}

interface OrderSummarySidebarProps {
  items: CartItem[];
  onUpdateQuantity: (menuItemId: string, delta: number) => void;
  onRemoveItem: (menuItemId: string) => void;
  onUpdateNotes: (menuItemId: string, notes: string) => void;
  subtotal: number;
  discountAmount: number;
  discountName?: string;
  ppnRate: number;
  ppnAmount: number;
  grandTotal: number;
  onSubmit: () => void;
  submitting: boolean;
  orderNotes: string;
  onOrderNotesChange: (notes: string) => void;
  isAddMode: boolean;
}

export function OrderSummarySidebar({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateNotes,
  subtotal,
  discountAmount,
  discountName,
  ppnRate,
  ppnAmount,
  grandTotal,
  onSubmit,
  submitting,
  orderNotes,
  onOrderNotesChange,
  isAddMode,
}: OrderSummarySidebarProps) {
  return (
    <div className="bg-surface rounded-lg border border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h3 className="text-text-primary font-medium text-sm">
          {isAddMode ? 'Tambah Pesanan' : 'Ringkasan Pesanan'}
        </h3>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-text-secondary text-xs text-center py-8">
            Belum ada item ditambahkan
          </p>
        ) : (
          items.map((item) => (
            <div key={item.menuItemId} className="bg-surface-elevated rounded p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm truncate">{item.itemName}</p>
                  <p className="text-text-secondary text-xs">
                    Rp {item.unitPrice.toLocaleString('id-ID')}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveItem(item.menuItemId)}
                  className="text-text-secondary hover:text-error shrink-0"
                  aria-label={`Hapus ${item.itemName}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQuantity(item.menuItemId, -1)}
                    disabled={item.quantity <= 1}
                    className="h-7 w-7 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary disabled:opacity-30"
                    aria-label="Kurangi jumlah"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-text-primary text-sm w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.menuItemId, 1)}
                    className="h-7 w-7 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary"
                    aria-label="Tambah jumlah"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className="text-text-primary text-sm font-medium">
                  Rp {(item.unitPrice * item.quantity).toLocaleString('id-ID')}
                </span>
              </div>

              <input
                type="text"
                placeholder="Catatan item..."
                value={item.specialNotes ?? ''}
                onChange={(e) => onUpdateNotes(item.menuItemId, e.target.value)}
                className="w-full mt-2 px-2 py-1 bg-surface text-text-primary text-xs rounded border border-border focus:border-primary focus:outline-none placeholder:text-text-secondary/50"
                aria-label={`Catatan untuk ${item.itemName}`}
              />
            </div>
          ))
        )}
      </div>

      {/* Order Notes */}
      <div className="px-4 pb-2">
        <input
          type="text"
          placeholder="Catatan pesanan..."
          value={orderNotes}
          onChange={(e) => onOrderNotesChange(e.target.value)}
          className="w-full px-3 py-2 bg-surface-elevated text-text-primary text-sm rounded border border-border focus:border-primary focus:outline-none placeholder:text-text-secondary/50"
          aria-label="Catatan umum pesanan"
        />
      </div>

      {/* Totals */}
      <div className="p-4 border-t border-border space-y-1.5">
        <div className="flex justify-between text-text-secondary text-xs">
          <span>Subtotal</span>
          <span>Rp {subtotal.toLocaleString('id-ID')}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-success text-xs">
            <span>Diskon{discountName ? ` (${discountName})` : ''}</span>
            <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
          </div>
        )}
        <div className="flex justify-between text-text-secondary text-xs">
          <span>PPN ({ppnRate}%)</span>
          <span>Rp {ppnAmount.toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between text-text-primary font-medium text-sm pt-1.5 border-t border-border">
          <span>Total</span>
          <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Submit Button */}
      <div className="p-4 pt-0">
        <button
          onClick={onSubmit}
          disabled={items.length === 0 || submitting}
          className="w-full py-3 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting
            ? 'Mengirim...'
            : isAddMode
              ? 'Tambah Pesanan'
              : 'Kirim Pesanan'}
        </button>
      </div>
    </div>
  );
}
