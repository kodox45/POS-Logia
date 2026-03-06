import { Plus } from 'lucide-react';
import type { MenuItem } from '@/types';

interface MenuItemCardProps {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
}

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
  return (
    <button
      onClick={() => onAdd(item)}
      disabled={!item.isAvailable}
      className="w-full text-left bg-surface rounded-lg border border-border p-3 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label={`Tambah ${item.itemName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-sm font-medium truncate">{item.itemName}</p>
          {item.description && (
            <p className="text-text-secondary text-xs mt-0.5 line-clamp-2">{item.description}</p>
          )}
          <p className="text-primary text-sm font-medium mt-1">
            Rp {item.price.toLocaleString('id-ID')}
          </p>
        </div>
        {item.isAvailable && (
          <div className="shrink-0 h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
            <Plus size={16} className="text-primary" />
          </div>
        )}
      </div>
      {!item.isAvailable && (
        <span className="text-xs text-error mt-1 block">Tidak tersedia</span>
      )}
    </button>
  );
}
