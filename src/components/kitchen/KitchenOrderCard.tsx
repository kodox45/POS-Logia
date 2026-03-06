import { Clock, ChefHat, CheckCircle, BookOpen, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import type { KitchenOrderView } from '@/stores/useKitchenStore';
import type { OrderItem } from '@/types';

interface KitchenOrderCardProps {
  order: KitchenOrderView;
  onStartCooking: (orderId: string) => void;
  onMarkReady: (orderId: string) => void;
  onViewRecipe: (menuItemId: string) => void;
}

export function KitchenOrderCard({ order, onStartCooking, onMarkReady, onViewRecipe }: KitchenOrderCardProps) {
  const isPending = order.orderStatus === 'pending';
  const isCooking = order.orderStatus === 'cooking';

  return (
    <div
      className={clsx(
        'rounded-lg border bg-surface p-3 flex flex-col gap-2 transition-colors',
        order.isLate && (isPending || isCooking) && 'border-error border-2 shadow-lg',
        !order.isLate && 'border-border'
      )}
    >
      {/* Header: Table number + order number + elapsed time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-text-primary">
            Meja {order.tableNumber}
          </span>
          <span className="text-xs text-text-secondary">
            #{order.orderNumber}
          </span>
          {order.isAdditional && (
            <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-medium">
              Tambahan
            </span>
          )}
        </div>
        <ElapsedTimer minutes={order.elapsedMinutes} isLate={order.isLate} />
      </div>

      {/* Items list */}
      <div className="flex flex-col gap-1">
        {order.items.map((item) => (
          <OrderItemRow key={item.id} item={item} onViewRecipe={onViewRecipe} />
        ))}
      </div>

      {/* Special notes */}
      {order.specialNotes && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 bg-warning/10 rounded text-xs text-warning">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{order.specialNotes}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-1">
        {isPending && (
          <button
            onClick={() => onStartCooking(order.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-white font-medium text-sm active:scale-[0.98] transition-transform"
            aria-label={`Mulai masak pesanan meja ${order.tableNumber}`}
          >
            <ChefHat size={18} />
            <span>Mulai Masak</span>
          </button>
        )}
        {isCooking && (
          <button
            onClick={() => onMarkReady(order.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-success text-white font-medium text-sm active:scale-[0.98] transition-transform"
            aria-label={`Tandai siap pesanan meja ${order.tableNumber}`}
          >
            <CheckCircle size={18} />
            <span>Siap Diantar</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ElapsedTimer({ minutes, isLate }: { minutes: number; isLate: boolean }) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const display = hrs > 0 ? `${hrs}j ${mins}m` : `${mins}m`;

  return (
    <div
      className={clsx(
        'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded',
        isLate ? 'bg-error/20 text-error' : 'bg-surface-elevated text-text-secondary'
      )}
      aria-label={`Waktu berlalu: ${display}`}
    >
      <Clock size={12} />
      <span>{display}</span>
    </div>
  );
}

function OrderItemRow({ item, onViewRecipe }: { item: OrderItem; onViewRecipe: (menuItemId: string) => void }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-primary w-6 text-center">
          {item.quantity}x
        </span>
        <button
          onClick={() => onViewRecipe(item.menuItemId)}
          className="text-sm text-text-primary hover:text-accent transition-colors text-left flex items-center gap-1"
          aria-label={`Lihat resep ${item.itemName}`}
        >
          <span>{item.itemName}</span>
          <BookOpen size={12} className="text-text-secondary" />
        </button>
        {item.isAdditional && (
          <span className="px-1.5 py-0.5 rounded bg-warning/20 text-warning text-xs">
            Tambahan
          </span>
        )}
      </div>
      {item.specialNotes && (
        <span className="text-xs text-warning italic max-w-[120px] truncate" title={item.specialNotes}>
          {item.specialNotes}
        </span>
      )}
    </div>
  );
}
