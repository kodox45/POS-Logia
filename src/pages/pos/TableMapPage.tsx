// Screen: S-005 | Interface: waiter-cashier-ui | Roles: waiter-cashier, owner
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useOrderManagementStore } from '@/stores/useOrderManagementStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { TableStatus } from '@/types/enums';

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  available: { label: 'Tersedia', color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/40' },
  occupied: { label: 'Terisi', color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/40' },
  needs_payment: { label: 'Perlu Bayar', color: 'text-error', bgColor: 'bg-error/10', borderColor: 'border-error/40' },
};

export default function TableMapPage() {
  const navigate = useNavigate();
  const { tables, orders, loading, loadTables, loadOrders } = useOrderManagementStore();

  useEffect(() => {
    loadTables();
    loadOrders();
  }, [loadTables, loadOrders]);

  const stats = useMemo(() => {
    const available = tables.filter((t) => t.status === 'available').length;
    const occupied = tables.filter((t) => t.status === 'occupied').length;
    const needsPayment = tables.filter((t) => t.status === 'needs_payment').length;
    return { available, occupied, needsPayment, total: tables.length };
  }, [tables]);

  const handleTableTap = (tableId: string, status: TableStatus, activeOrderId?: string) => {
    if (status === 'available') {
      navigate(`/pos/orders/new?tableId=${tableId}`);
    } else if (activeOrderId) {
      navigate(`/pos/payment/${activeOrderId}`);
    }
  };

  if (loading && tables.length === 0) {
    return <LoadingSpinner size="lg" message="Memuat peta meja..." />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary Bar */}
      <div className="flex gap-3 mb-4 overflow-x-auto pb-1">
        <div className="shrink-0 bg-surface rounded-lg border border-border px-4 py-2 flex items-center gap-2">
          <span className="text-text-secondary text-xs">Total</span>
          <span className="text-text-primary font-medium text-sm">{stats.total}</span>
        </div>
        <div className="shrink-0 bg-success/10 rounded-lg border border-success/30 px-4 py-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-success text-xs">Tersedia</span>
          <span className="text-success font-medium text-sm">{stats.available}</span>
        </div>
        <div className="shrink-0 bg-warning/10 rounded-lg border border-warning/30 px-4 py-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-warning" />
          <span className="text-warning text-xs">Terisi</span>
          <span className="text-warning font-medium text-sm">{stats.occupied}</span>
        </div>
        <div className="shrink-0 bg-error/10 rounded-lg border border-error/30 px-4 py-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-error" />
          <span className="text-error text-xs">Perlu Bayar</span>
          <span className="text-error font-medium text-sm">{stats.needsPayment}</span>
        </div>
      </div>

      {/* Table Grid */}
      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <p className="text-sm">Belum ada meja dikonfigurasi</p>
          <p className="text-xs mt-1">Hubungi Owner untuk menambahkan meja</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 flex-1 overflow-auto">
          {tables.map((table) => {
            const config = STATUS_CONFIG[table.status];
            const activeOrder = table.activeOrderId
              ? orders.find((o) => o.id === table.activeOrderId)
              : undefined;

            return (
              <button
                key={table.id}
                onClick={() => handleTableTap(table.id, table.status, table.activeOrderId)}
                className={clsx(
                  'flex flex-col items-center justify-center rounded-lg border-2 p-4 min-h-[100px] transition-all hover:shadow',
                  config.bgColor,
                  config.borderColor
                )}
                aria-label={`${table.tableName} - ${config.label}`}
              >
                <span className="text-text-primary font-medium text-lg">{table.tableNumber}</span>
                <span className="text-text-secondary text-xs mt-0.5">{table.tableName}</span>
                <span className={clsx('text-xs mt-1', config.color)}>{config.label}</span>
                {activeOrder && (
                  <span className="text-text-secondary text-xs mt-1">
                    {activeOrder.orderNumber}
                  </span>
                )}
                {table.capacity && (
                  <span className="text-text-secondary/60 text-xs mt-0.5">
                    {table.capacity} kursi
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
