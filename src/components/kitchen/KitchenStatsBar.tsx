import { Clock, CheckCircle, ChefHat, AlertCircle } from 'lucide-react';
import type { KitchenOrderView } from '@/stores/useKitchenStore';

interface KitchenStatsBarProps {
  orders: KitchenOrderView[];
}

export function KitchenStatsBar({ orders }: KitchenStatsBarProps) {
  const pendingCount = orders.filter((o) => o.orderStatus === 'pending').length;
  const cookingCount = orders.filter((o) => o.orderStatus === 'cooking').length;
  const readyCount = orders.filter((o) => o.orderStatus === 'ready').length;

  const cookingOrders = orders.filter((o) => o.orderStatus === 'cooking' || o.orderStatus === 'ready');
  const avgCookingTime = cookingOrders.length > 0
    ? Math.round(cookingOrders.reduce((sum, o) => sum + o.elapsedMinutes, 0) / cookingOrders.length)
    : 0;

  return (
    <div
      className="flex items-center gap-4 px-4 py-2 bg-surface border-t border-border overflow-x-auto"
      role="status"
      aria-label="Statistik dapur hari ini"
    >
      <StatChip
        icon={<AlertCircle size={14} />}
        label="Menunggu"
        value={pendingCount}
        color="text-warning"
      />
      <StatChip
        icon={<ChefHat size={14} />}
        label="Dimasak"
        value={cookingCount}
        color="text-primary"
      />
      <StatChip
        icon={<CheckCircle size={14} />}
        label="Siap"
        value={readyCount}
        color="text-success"
      />
      <StatChip
        icon={<Clock size={14} />}
        label="Rata-rata"
        value={`${avgCookingTime}m`}
        color="text-text-secondary"
      />
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={color}>{icon}</span>
      <span className="text-xs text-text-secondary">{label}:</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}
