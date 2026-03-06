// Screen: S-008 | Interface: admin-panel | Roles: owner
import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Banknote,
  Smartphone,
  XCircle,
  Tag,
  Package,
  AlertTriangle,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useReportingStore } from '@/stores/useReportingStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { clsx } from 'clsx';

type DateRange = 'today' | 'week' | 'month' | 'custom';

const PAYMENT_COLORS = ['#2D8CF0', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export default function AdminDashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showRangePicker, setShowRangePicker] = useState(false);

  const {
    dailySummary,
    topSellingItems,
    paymentBreakdown,
    revenueByDateRange,
    peakHours,
    shiftPerformance,
    lowStockCount,
    loading,
    loadDashboardData,
  } = useReportingStore();

  const inventoryItems = useInventoryStore((s) => s.inventoryItems);
  const loadInventoryItems = useInventoryStore((s) => s.loadInventoryItems);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { startDate: format(startOfDay(now), 'yyyy-MM-dd'), endDate: format(endOfDay(now), 'yyyy-MM-dd') };
      case 'week':
        return { startDate: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), endDate: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
      case 'month':
        return { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'custom':
        return { startDate: customStart || format(now, 'yyyy-MM-dd'), endDate: customEnd || format(now, 'yyyy-MM-dd') };
    }
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    loadDashboardData(startDate, endDate);
    loadInventoryItems();
  }, [startDate, endDate, loadDashboardData, loadInventoryItems]);

  const lowStockItems = inventoryItems.filter(
    (item) => item.stockStatus === 'low' || item.stockStatus === 'critical'
  );

  const dateRangeLabels: Record<DateRange, string> = {
    today: 'Hari Ini',
    week: 'Minggu Ini',
    month: 'Bulan Ini',
    custom: 'Custom',
  };

  if (loading && !dailySummary) {
    return <LoadingSpinner size="lg" message="Memuat data laporan..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-text-primary">Laporan Bisnis</h1>
        <div className="relative">
          <button
            onClick={() => setShowRangePicker(!showRangePicker)}
            className="flex items-center gap-2 bg-surface-elevated border border-border rounded px-4 py-2 text-sm text-text-primary hover:border-primary transition-colors"
          >
            <Calendar size={16} />
            <span>{dateRangeLabels[dateRange]}</span>
            <ChevronDown size={14} />
          </button>
          {showRangePicker && (
            <div className="absolute right-0 top-full mt-2 bg-surface-elevated border border-border rounded shadow-lg z-20 min-w-[200px]">
              {(['today', 'week', 'month'] as DateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => { setDateRange(range); setShowRangePicker(false); }}
                  className={clsx(
                    'w-full text-left px-4 py-2 text-sm hover:bg-primary/10 transition-colors',
                    dateRange === range ? 'text-primary bg-primary/5' : 'text-text-secondary'
                  )}
                >
                  {dateRangeLabels[range]}
                </button>
              ))}
              <div className="border-t border-border p-3 space-y-2">
                <p className="text-xs text-text-secondary">Custom Range</p>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-text-primary"
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-text-primary"
                />
                <button
                  onClick={() => { setDateRange('custom'); setShowRangePicker(false); }}
                  className="w-full bg-primary text-white rounded px-3 py-1.5 text-sm hover:bg-primary-dark transition-colors"
                >
                  Terapkan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign size={20} />}
          label="Total Pendapatan"
          value={formatCurrency(dailySummary?.totalRevenue ?? 0)}
          color="text-success"
        />
        <KpiCard
          icon={<ShoppingCart size={20} />}
          label="Jumlah Transaksi"
          value={String(dailySummary?.totalTransactions ?? 0)}
          color="text-primary"
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Rata-rata / Transaksi"
          value={formatCurrency(dailySummary?.averageOrderValue ?? 0)}
          color="text-accent"
        />
        <KpiCard
          icon={<Banknote size={20} />}
          label="Tunai"
          value={formatCurrency(dailySummary?.cashTotal ?? 0)}
          subtitle={`Digital: ${formatCurrency(dailySummary?.digitalTotal ?? 0)}`}
          color="text-warning"
        />
        <KpiCard
          icon={<Smartphone size={20} />}
          label="Digital"
          value={formatCurrency(dailySummary?.digitalTotal ?? 0)}
          color="text-info"
        />
        <KpiCard
          icon={<XCircle size={20} />}
          label="Total Void"
          value={`${dailySummary?.voidCount ?? 0} (${formatCurrency(dailySummary?.voidAmount ?? 0)})`}
          color="text-error"
        />
        <KpiCard
          icon={<Tag size={20} />}
          label="Total Diskon"
          value={formatCurrency(dailySummary?.discountTotal ?? 0)}
          color="text-warning"
        />
        <KpiCard
          icon={<Package size={20} />}
          label="Stok Rendah"
          value={String(lowStockCount)}
          color={lowStockCount > 0 ? 'text-error' : 'text-success'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-surface rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-text-primary mb-4">Tren Pendapatan</h3>
          {revenueByDateRange.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueByDateRange}>
                <CartesianGrid strokeDasharray="3 3" stroke="#253545" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8BA3BC' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8BA3BC' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1C2E42', border: '1px solid #253545', borderRadius: '8px' }}
                  labelStyle={{ color: '#E8F1FA' }}
                  formatter={(value: number) => [formatCurrency(value), 'Pendapatan']}
                />
                <Bar dataKey="revenue" fill="#2D8CF0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-text-secondary text-sm">
              Belum ada data transaksi
            </div>
          )}
        </div>

        {/* Peak Hours Chart */}
        <div className="bg-surface rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-text-primary mb-4">Jam Sibuk</h3>
          {peakHours.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#253545" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#8BA3BC' }} tickFormatter={(h) => `${h}:00`} />
                <YAxis tick={{ fontSize: 11, fill: '#8BA3BC' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1C2E42', border: '1px solid #253545', borderRadius: '8px' }}
                  labelStyle={{ color: '#E8F1FA' }}
                  formatter={(value: number, name: string) => [value, name === 'orderCount' ? 'Pesanan' : 'Pendapatan']}
                  labelFormatter={(h) => `Jam ${h}:00`}
                />
                <Bar dataKey="orderCount" fill="#22C55E" radius={[4, 4, 0, 0]} name="Pesanan" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-text-secondary text-sm">
              Belum ada data pesanan
            </div>
          )}
        </div>
      </div>

      {/* Second Row: Top Selling Items + Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <div className="bg-surface rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-text-primary mb-4">Top 10 Menu Terlaris</h3>
          {topSellingItems.length > 0 ? (
            <div className="space-y-2">
              {topSellingItems.map((item, idx) => (
                <div key={item.menuItemId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      idx < 3 ? 'bg-primary/20 text-primary' : 'bg-surface-elevated text-text-secondary'
                    )}>
                      {idx + 1}
                    </span>
                    <span className="text-sm text-text-primary">{item.itemName}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-text-primary">{item.totalQuantity} terjual</p>
                    <p className="text-xs text-text-secondary">{formatCurrency(item.totalRevenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-secondary text-sm">
              Belum ada data penjualan
            </div>
          )}
        </div>

        {/* Payment Method Breakdown */}
        <div className="bg-surface rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-text-primary mb-4">Metode Pembayaran</h3>
          {paymentBreakdown.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="total"
                    nameKey="method"
                  >
                    {paymentBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PAYMENT_COLORS[idx % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1C2E42', border: '1px solid #253545', borderRadius: '8px' }}
                    formatter={(value: number) => [formatCurrency(value)]}
                  />
                  <Legend
                    formatter={(value: string) => <span className="text-xs text-text-secondary capitalize">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full space-y-1 mt-2">
                {paymentBreakdown.map((pm, idx) => (
                  <div key={pm.method} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[idx % PAYMENT_COLORS.length] }} />
                      <span className="text-text-secondary capitalize">{pm.method}</span>
                    </div>
                    <span className="text-text-primary">{pm.count}x ({pm.percentage.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-secondary text-sm">
              Belum ada data pembayaran
            </div>
          )}
        </div>
      </div>

      {/* Shift Performance Table */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium text-text-primary mb-4">Performa Shift</h3>
        {shiftPerformance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary text-left border-b border-border">
                  <th className="pb-3 pr-4">Shift ID</th>
                  <th className="pb-3 pr-4">PIC Kasir</th>
                  <th className="pb-3 pr-4">Tanggal</th>
                  <th className="pb-3 pr-4">Durasi</th>
                  <th className="pb-3 pr-4 text-right">Transaksi</th>
                  <th className="pb-3 pr-4 text-right">Pendapatan</th>
                  <th className="pb-3 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {shiftPerformance.map((shift) => (
                  <tr key={shift.shiftId} className="border-b border-border last:border-0 text-text-primary">
                    <td className="py-3 pr-4 font-mono text-xs">{shift.shiftNumber}</td>
                    <td className="py-3 pr-4">{shift.cashierName}</td>
                    <td className="py-3 pr-4">{shift.date}</td>
                    <td className="py-3 pr-4">{shift.duration}</td>
                    <td className="py-3 pr-4 text-right">{shift.transactionCount}</td>
                    <td className="py-3 pr-4 text-right">{formatCurrency(shift.revenue)}</td>
                    <td className={clsx('py-3 text-right font-medium', shift.discrepancy === 0 ? 'text-success' : shift.discrepancy > 0 ? 'text-warning' : 'text-error')}>
                      {formatCurrency(shift.discrepancy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-text-secondary text-sm">
            Belum ada data shift
          </div>
        )}
      </div>

      {/* Low Stock Alerts Widget */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-text-primary">Peringatan Stok Rendah</h3>
            {lowStockItems.length > 0 && (
              <span className="bg-error/20 text-error text-xs font-bold px-2 py-0.5 rounded-full">
                {lowStockItems.length}
              </span>
            )}
          </div>
          <a href="/admin/inventory" className="text-xs text-primary hover:text-primary-light transition-colors">
            Lihat Stok &rarr;
          </a>
        </div>
        {lowStockItems.length > 0 ? (
          <div className="space-y-2">
            {lowStockItems.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className={item.stockStatus === 'critical' ? 'text-error' : 'text-warning'} />
                  <span className="text-sm text-text-primary">{item.itemName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">
                    {item.quantity} {item.unit}
                  </span>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    item.stockStatus === 'critical' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'
                  )}>
                    {item.stockStatus === 'critical' ? 'Kritis' : 'Rendah'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-text-secondary text-sm flex items-center justify-center gap-2">
            <Package size={16} className="text-success" />
            Semua stok dalam kondisi baik
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, subtitle, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
      <p className={clsx('text-lg font-semibold', color)}>{value}</p>
      {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
    </div>
  );
}
