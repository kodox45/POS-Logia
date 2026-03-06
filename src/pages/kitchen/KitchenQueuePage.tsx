// Screen: S-006 | Interface: kitchen-display | Roles: chef, owner
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useKitchenStore } from '@/stores/useKitchenStore';
import { KitchenOrderCard } from '@/components/kitchen/KitchenOrderCard';
import { NewOrderAlert } from '@/components/kitchen/NewOrderAlert';
import { KitchenStatsBar } from '@/components/kitchen/KitchenStatsBar';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { db } from '@/db/database';

const POLL_INTERVAL_MS = 5000;

export default function KitchenQueuePage() {
  const navigate = useNavigate();
  const {
    orderQueue,
    loading,
    error,
    getOrderQueue,
    startCooking,
    markReady,
  } = useKitchenStore();

  const [alertTable, setAlertTable] = useState<number | null>(null);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());

  // Initial load
  useEffect(() => {
    getOrderQueue();
  }, [getOrderQueue]);

  // Polling for new orders
  useEffect(() => {
    const interval = setInterval(() => {
      getOrderQueue();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [getOrderQueue]);

  // Detect new orders and trigger alert
  useEffect(() => {
    const currentIds = new Set(orderQueue.map((o) => o.id));
    const prevIds = prevOrderIdsRef.current;

    if (prevIds.size > 0) {
      for (const order of orderQueue) {
        if (!prevIds.has(order.id) && order.orderStatus === 'pending') {
          setAlertTable(order.tableNumber);
          break;
        }
      }
    }

    prevOrderIdsRef.current = currentIds;
  }, [orderQueue]);

  const handleDismissAlert = useCallback(() => {
    setAlertTable(null);
  }, []);

  const handleViewRecipe = useCallback(async (menuItemId: string) => {
    try {
      const recipe = await db.recipes
        .where('menuItemId')
        .equals(menuItemId)
        .first();
      if (recipe) {
        navigate(`/kitchen/recipe/${recipe.id}`);
      }
    } catch {
      // Recipe not found — silently ignore
    }
  }, [navigate]);

  const pendingOrders = orderQueue.filter((o) => o.orderStatus === 'pending');
  const cookingOrders = orderQueue.filter((o) => o.orderStatus === 'cooking');
  const readyOrders = orderQueue.filter((o) => o.orderStatus === 'ready');

  if (loading && orderQueue.length === 0) {
    return <LoadingSpinner size="lg" message="Memuat antrian pesanan..." />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* New Order Alert Banner */}
      <NewOrderAlert tableNumber={alertTable} onDismiss={handleDismissAlert} />

      {/* Error display */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-2 bg-error/10 border border-error/30 rounded text-error text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Refresh button */}
      <div className="flex items-center justify-between px-1 mb-2">
        <h1 className="text-lg font-bold text-text-primary">Antrian Pesanan</h1>
        <button
          onClick={() => getOrderQueue()}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-primary transition-colors px-2 py-1 rounded"
          aria-label="Refresh antrian"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden">
        <KanbanColumn
          title="Menunggu"
          count={pendingOrders.length}
          colorClass="text-warning"
          orders={pendingOrders}
          onStartCooking={startCooking}
          onMarkReady={markReady}
          onViewRecipe={handleViewRecipe}
          emptyMessage="Tidak ada pesanan menunggu"
        />
        <KanbanColumn
          title="Dimasak"
          count={cookingOrders.length}
          colorClass="text-primary"
          orders={cookingOrders}
          onStartCooking={startCooking}
          onMarkReady={markReady}
          onViewRecipe={handleViewRecipe}
          emptyMessage="Tidak ada pesanan dimasak"
        />
        <KanbanColumn
          title="Siap"
          count={readyOrders.length}
          colorClass="text-success"
          orders={readyOrders}
          onStartCooking={startCooking}
          onMarkReady={markReady}
          onViewRecipe={handleViewRecipe}
          emptyMessage="Tidak ada pesanan siap"
        />
      </div>

      {/* Stats Bar */}
      <KitchenStatsBar orders={orderQueue} />
    </div>
  );
}

interface KanbanColumnProps {
  title: string;
  count: number;
  colorClass: string;
  orders: import('@/stores/useKitchenStore').KitchenOrderView[];
  onStartCooking: (orderId: string) => void;
  onMarkReady: (orderId: string) => void;
  onViewRecipe: (menuItemId: string) => void;
  emptyMessage: string;
}

function KanbanColumn({
  title,
  count,
  colorClass,
  orders,
  onStartCooking,
  onMarkReady,
  onViewRecipe,
  emptyMessage,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-h-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-2 py-1.5 mb-2">
        <h2 className={`text-sm font-bold ${colorClass}`}>{title}</h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-surface-elevated ${colorClass}`}>
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2 px-0.5 pb-2" role="list" aria-label={`Pesanan ${title.toLowerCase()}`}>
        {orders.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-text-secondary text-sm">
            {emptyMessage}
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} role="listitem">
              <KitchenOrderCard
                order={order}
                onStartCooking={onStartCooking}
                onMarkReady={onMarkReady}
                onViewRecipe={onViewRecipe}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
