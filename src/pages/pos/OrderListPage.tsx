// Screen: S-002 | Interface: waiter-cashier-ui | Roles: waiter-cashier, owner
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useOrderManagementStore } from '@/stores/useOrderManagementStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { OrderCard } from '@/components/order/OrderCard';
import { KitchenReadyBar } from '@/components/order/KitchenReadyBar';
import { CancelOrderModal } from '@/components/order/CancelOrderModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { OrderStatus } from '@/types/enums';

type FilterTab = 'all' | 'pending' | 'cooking' | 'ready' | 'served';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'cooking', label: 'Dimasak' },
  { key: 'ready', label: 'Siap' },
  { key: 'served', label: 'Disajikan' },
];

export default function OrderListPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);

  const {
    orders,
    tables,
    orderItems,
    loading,
    error,
    loadOrders,
    loadTables,
    cancelOrder,
    updateOrderStatus,
  } = useOrderManagementStore();

  const users = useAuthStore((s) => s.users);

  useEffect(() => {
    loadOrders();
    loadTables();
  }, [loadOrders, loadTables]);

  const activeOrders = useMemo(
    () => orders.filter((o) => !['paid', 'cancelled', 'voided'].includes(o.orderStatus)),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return activeOrders;
    return activeOrders.filter((o) => o.orderStatus === activeFilter);
  }, [activeOrders, activeFilter]);

  const readyOrders = useMemo(
    () => activeOrders.filter((o) => o.orderStatus === 'ready'),
    [activeOrders]
  );

  const tableNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of tables) {
      map[t.id] = t.tableName;
    }
    return map;
  }, [tables]);

  const waiterNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.id] = u.displayName;
    }
    return map;
  }, [users]);

  const handleConfirmServed = useCallback(
    async (orderId: string) => {
      try {
        await updateOrderStatus(orderId, 'served' as OrderStatus);
      } catch {
        // error is captured in store
      }
    },
    [updateOrderStatus]
  );

  const handleCancelOrder = useCallback(async () => {
    if (!cancelOrderId) return;
    try {
      await cancelOrder(cancelOrderId);
    } catch {
      // error is captured in store
    }
    setCancelOrderId(null);
  }, [cancelOrderId, cancelOrder]);

  const handleOrderTap = useCallback(
    (orderId: string) => {
      navigate(`/pos/payment/${orderId}`);
    },
    [navigate]
  );

  const cancelOrderData = cancelOrderId
    ? orders.find((o) => o.id === cancelOrderId)
    : null;

  if (loading && orders.length === 0) {
    return <LoadingSpinner size="lg" message="Memuat pesanan..." />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Kitchen Ready Notification Bar */}
      <KitchenReadyBar
        readyOrders={readyOrders}
        onConfirmServed={handleConfirmServed}
        tableNames={tableNameMap}
      />

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === 'all'
              ? activeOrders.length
              : activeOrders.filter((o) => o.orderStatus === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={clsx(
                'px-4 py-2 text-sm rounded-full whitespace-nowrap transition-colors',
                activeFilter === tab.key
                  ? 'bg-primary text-white'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              )}
              aria-label={`Filter ${tab.label}`}
              aria-pressed={activeFilter === tab.key}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-3 mb-4">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {/* Active Orders List */}
      <div className="flex-1 overflow-auto space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <p className="text-sm">Belum ada pesanan aktif</p>
            <button
              onClick={() => navigate('/pos/orders/new')}
              className="mt-4 text-primary text-sm hover:underline"
            >
              Buat pesanan baru
            </button>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              tableName={tableNameMap[order.tableId] ?? `Meja ?`}
              itemCount={orderItems.filter((i) => i.orderId === order.id).length}
              waiterName={waiterNameMap[order.waiterId] ?? 'Pelayan'}
              onTap={handleOrderTap}
              onCancel={setCancelOrderId}
            />
          ))
        )}
      </div>

      {/* New Order FAB */}
      <button
        onClick={() => navigate('/pos/orders/new')}
        className="fixed bottom-24 right-6 h-14 w-14 bg-primary rounded-full shadow-lg flex items-center justify-center hover:bg-primary-dark active:scale-95 transition-all z-10"
        aria-label="Buat pesanan baru"
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* Cancel Order Modal */}
      <CancelOrderModal
        isOpen={cancelOrderId !== null}
        orderNumber={cancelOrderData?.orderNumber ?? ''}
        onConfirm={handleCancelOrder}
        onClose={() => setCancelOrderId(null)}
      />
    </div>
  );
}
