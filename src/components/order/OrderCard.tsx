import { Clock, ChefHat, CheckCircle, Utensils, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import type { Order } from '@/types';
import type { OrderStatus } from '@/types/enums';
import { useEffect, useState } from 'react';

interface OrderCardProps {
  order: Order;
  tableName: string;
  itemCount: number;
  waiterName: string;
  onTap: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'Menunggu', color: 'text-warning', bgColor: 'bg-warning/10', icon: Clock },
  cooking: { label: 'Dimasak', color: 'text-info', bgColor: 'bg-info/10', icon: ChefHat },
  ready: { label: 'Siap', color: 'text-success', bgColor: 'bg-success/10', icon: CheckCircle },
  served: { label: 'Disajikan', color: 'text-primary', bgColor: 'bg-primary/10', icon: Utensils },
  paid: { label: 'Dibayar', color: 'text-text-secondary', bgColor: 'bg-surface-elevated', icon: CheckCircle },
  cancelled: { label: 'Dibatalkan', color: 'text-error', bgColor: 'bg-error/10', icon: AlertCircle },
  voided: { label: 'Void', color: 'text-error', bgColor: 'bg-error/10', icon: AlertCircle },
};

function useElapsedTime(startTime: string): string {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    function update() {
      const start = new Date(startTime).getTime();
      const diff = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${mins}:${String(secs).padStart(2, '0')}`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

export function OrderCard({ order, tableName, itemCount, waiterName, onTap, onCancel }: OrderCardProps) {
  const config = STATUS_CONFIG[order.orderStatus];
  const StatusIcon = config.icon;
  const elapsed = useElapsedTime(order.createdAt);

  return (
    <button
      onClick={() => onTap(order.id)}
      className="w-full text-left bg-surface rounded-lg border border-border p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-medium text-sm">{order.orderNumber}</span>
          {order.isAdditional && (
            <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
              Tambahan
            </span>
          )}
        </div>
        <span className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded-full', config.bgColor, config.color)}>
          <StatusIcon size={12} />
          {config.label}
        </span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-text-secondary text-xs">{tableName}</span>
        <span className="text-text-secondary text-xs">{itemCount} item</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs">{waiterName}</span>
        <div className="flex items-center gap-3">
          <span className="text-text-secondary text-xs flex items-center gap-1">
            <Clock size={12} />
            {elapsed}
          </span>
          <span className="text-text-primary font-medium text-sm">
            Rp {order.grandTotal.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {onCancel && !['paid', 'cancelled', 'voided'].includes(order.orderStatus) && (
        <div className="mt-3 pt-3 border-t border-border flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel(order.id);
            }}
            className="text-xs text-error hover:text-error/80 px-3 py-1 rounded border border-error/30 hover:bg-error/10 transition-colors"
            aria-label={`Batalkan pesanan ${order.orderNumber}`}
          >
            Batalkan
          </button>
        </div>
      )}
    </button>
  );
}
