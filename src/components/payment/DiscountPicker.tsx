import { Tag, X } from 'lucide-react';
import type { Discount } from '@/types';

interface DiscountPickerProps {
  discounts: Discount[];
  selectedDiscountId: string | null;
  onSelect: (discount: Discount) => void;
  onRemove: () => void;
  currentDiscountName?: string;
  currentDiscountAmount?: number;
}

export function DiscountPicker({
  discounts,
  selectedDiscountId,
  onSelect,
  onRemove,
  currentDiscountName,
  currentDiscountAmount,
}: DiscountPickerProps) {
  if (selectedDiscountId && currentDiscountName) {
    return (
      <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-success" />
          <span className="text-success text-sm">{currentDiscountName}</span>
          {currentDiscountAmount !== undefined && currentDiscountAmount > 0 && (
            <span className="text-success text-xs">
              (- Rp {currentDiscountAmount.toLocaleString('id-ID')})
            </span>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-success hover:text-success/80"
          aria-label="Hapus diskon"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  if (discounts.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {discounts.map((discount) => (
        <button
          key={discount.id}
          onClick={() => onSelect(discount)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-elevated border border-border rounded-full text-text-secondary hover:border-success/50 hover:text-success transition-colors"
        >
          <Tag size={12} />
          <span>{discount.discountName}</span>
          <span className="text-text-secondary/60">
            {discount.discountType === 'percentage'
              ? `${discount.discountValue}%`
              : `Rp ${discount.discountValue.toLocaleString('id-ID')}`}
          </span>
        </button>
      ))}
    </div>
  );
}
