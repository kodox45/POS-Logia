import { Bell, CheckCircle } from 'lucide-react';
import type { Order } from '@/types';

interface KitchenReadyBarProps {
  readyOrders: Order[];
  onConfirmServed: (orderId: string) => void;
  tableNames: Record<string, string>;
}

export function KitchenReadyBar({ readyOrders, onConfirmServed, tableNames }: KitchenReadyBarProps) {
  if (readyOrders.length === 0) return null;

  return (
    <div className="bg-success/10 border border-success/30 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Bell size={16} className="text-success" />
        <span className="text-success text-sm font-medium">
          {readyOrders.length} pesanan siap disajikan
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {readyOrders.map((order) => (
          <button
            key={order.id}
            onClick={() => onConfirmServed(order.id)}
            className="flex items-center gap-2 bg-success/20 text-success text-xs px-3 py-1.5 rounded-full hover:bg-success/30 transition-colors"
            aria-label={`Konfirmasi sajikan pesanan ${order.orderNumber}`}
          >
            <CheckCircle size={12} />
            <span>{tableNames[order.tableId] ?? 'Meja ?'} - {order.orderNumber}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
