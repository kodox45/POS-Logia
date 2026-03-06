import { clsx } from 'clsx';
import type { Table } from '@/types';

interface TableSelectorProps {
  tables: Table[];
  selectedTableId: string | null;
  onSelect: (tableId: string) => void;
  activeOrderTableId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'border-success/50 bg-success/5 hover:bg-success/10',
  occupied: 'border-warning/50 bg-warning/5 hover:bg-warning/10',
  needs_payment: 'border-error/50 bg-error/5 hover:bg-error/10',
};

export function TableSelector({ tables, selectedTableId, onSelect, activeOrderTableId }: TableSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {tables.map((table) => {
        const isSelected = table.id === selectedTableId;
        const isActiveOrder = table.id === activeOrderTableId;
        return (
          <button
            key={table.id}
            onClick={() => onSelect(table.id)}
            className={clsx(
              'shrink-0 px-4 py-2 rounded-lg border text-sm transition-all',
              isSelected
                ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                : STATUS_COLORS[table.status] ?? 'border-border',
              !isSelected && 'text-text-primary'
            )}
            aria-label={`${table.tableName} - ${table.status}`}
            aria-pressed={isSelected}
          >
            <span className="font-medium">{table.tableName}</span>
            {isActiveOrder && (
              <span className="block text-xs text-warning mt-0.5">Ada pesanan aktif</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
