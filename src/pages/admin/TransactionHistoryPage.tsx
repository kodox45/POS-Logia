// Screen: S-012 | Interface: admin-panel | Roles: owner
import { useState, useEffect, useMemo, useRef } from 'react';
import { usePaymentStore } from '@/stores/usePaymentStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { db } from '@/db/database';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Search, Download, X, FileText, Printer, Filter, RotateCcw,
  DollarSign, CreditCard, Banknote, TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';
import type { Transaction, OrderItem } from '@/types';
import type { PaymentMethod } from '@/types/enums';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  tunai: 'Tunai', qris: 'QRIS', gopay: 'GoPay', ovo: 'OVO',
  dana: 'Dana', shopeepay: 'ShopeePay', transfer_bank: 'Transfer Bank',
};

const STATUS_LABELS: Record<string, string> = { completed: 'Selesai', voided: 'Dibatalkan' };
const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  voided: 'bg-red-500/20 text-red-400',
};

function formatCurrency(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

export default function TransactionHistoryPage() {
  const { transactions, loading, loadTransactions } = usePaymentStore();
  const { users, loadUsers } = useAuthStore();
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTxn, setSearchTxn] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCashier, setFilterCashier] = useState<string>('all');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [txnItems, setTxnItems] = useState<OrderItem[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTransactions();
    loadUsers();
  }, [loadTransactions, loadUsers]);

  const filtered = useMemo(() => {
    let txns = [...transactions];

    if (dateFrom) {
      const from = startOfDay(new Date(dateFrom));
      txns = txns.filter((t) => new Date(t.createdAt) >= from);
    }
    if (dateTo) {
      const to = endOfDay(new Date(dateTo));
      txns = txns.filter((t) => new Date(t.createdAt) <= to);
    }
    if (searchTxn) {
      const q = searchTxn.toLowerCase();
      txns = txns.filter((t) => t.transactionNumber.toLowerCase().includes(q));
    }
    if (filterPayment !== 'all') {
      txns = txns.filter((t) => t.paymentMethod === filterPayment);
    }
    if (filterStatus !== 'all') {
      txns = txns.filter((t) => t.transactionStatus === filterStatus);
    }
    if (filterCashier !== 'all') {
      txns = txns.filter((t) => t.cashierId === filterCashier);
    }

    txns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return txns;
  }, [transactions, dateFrom, dateTo, searchTxn, filterPayment, filterStatus, filterCashier]);

  const stats = useMemo(() => {
    const completed = filtered.filter((t) => t.transactionStatus === 'completed');
    return {
      count: completed.length,
      totalRevenue: completed.reduce((sum, t) => sum + t.grandTotal, 0),
      cashTotal: completed.filter((t) => t.paymentMethod === 'tunai').reduce((sum, t) => sum + t.grandTotal, 0),
      digitalTotal: completed.filter((t) => t.paymentMethod !== 'tunai').reduce((sum, t) => sum + t.grandTotal, 0),
    };
  }, [filtered]);

  const resetFilters = () => {
    setDateFrom(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
    setSearchTxn('');
    setFilterPayment('all');
    setFilterStatus('all');
    setFilterCashier('all');
  };

  const getCashierName = (id: string) => users.find((u) => u.id === id)?.displayName ?? '-';

  const openDetail = async (txn: Transaction) => {
    setSelectedTxn(txn);
    const items = await db.orderItems.where('orderId').equals(txn.orderId).toArray();
    setTxnItems(items);
  };

  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx');
      const data = filtered.map((t) => ({
        'Tanggal': format(new Date(t.createdAt), 'dd/MM/yyyy HH:mm'),
        'No. Transaksi': t.transactionNumber,
        'Meja': t.tableNumber,
        'Kasir': getCashierName(t.cashierId),
        'Subtotal': t.subtotalAmount,
        'Diskon': t.discountAmount ?? 0,
        'PPN (%)': t.ppnRate,
        'PPN': t.ppnAmount,
        'Grand Total': t.grandTotal,
        'Metode': PAYMENT_LABELS[t.paymentMethod] ?? t.paymentMethod,
        'Status': STATUS_LABELS[t.transactionStatus] ?? t.transactionStatus,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
      XLSX.writeFile(wb, `transaksi_${dateFrom}_${dateTo}.xlsx`);
    } catch {
      // xlsx import might fail silently
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write('<html><head><title>Struk</title><style>body{font-family:monospace;font-size:12px;max-width:300px;margin:0 auto;padding:16px}table{width:100%;border-collapse:collapse}td{padding:2px 0}.right{text-align:right}.center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}</style></head><body>');
    printWindow.document.write(printRef.current.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Riwayat Transaksi</h1>
        <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Download size={16} /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-text-secondary" />
          <span className="text-sm font-medium text-text-secondary">Filter</span>
          <button onClick={resetFilters} className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline">
            <RotateCcw size={12} /> Reset
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Dari</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Sampai</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">No. Transaksi</label>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input value={searchTxn} onChange={(e) => setSearchTxn(e.target.value)} placeholder="Cari..." className="w-full bg-background border border-border rounded-lg pl-7 pr-2 py-1.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Metode</label>
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary">
              <option value="all">Semua</option>
              <option value="tunai">Tunai</option>
              <option value="qris">QRIS</option>
              <option value="gopay">GoPay</option>
              <option value="ovo">OVO</option>
              <option value="dana">Dana</option>
              <option value="shopeepay">ShopeePay</option>
              <option value="transfer_bank">Transfer Bank</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary">
              <option value="all">Semua</option>
              <option value="completed">Selesai</option>
              <option value="voided">Void</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Kasir</label>
            <select value={filterCashier} onChange={(e) => setFilterCashier(e.target.value)} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary">
              <option value="all">Semua</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatChip icon={<FileText size={16} />} label="Transaksi" value={stats.count.toString()} color="text-primary" />
        <StatChip icon={<TrendingUp size={16} />} label="Total Pendapatan" value={formatCurrency(stats.totalRevenue)} color="text-green-400" />
        <StatChip icon={<Banknote size={16} />} label="Total Tunai" value={formatCurrency(stats.cashTotal)} color="text-yellow-400" />
        <StatChip icon={<CreditCard size={16} />} label="Total Digital" value={formatCurrency(stats.digitalTotal)} color="text-blue-400" />
      </div>

      {/* Transaction Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium">No. Transaksi</th>
                <th className="text-center px-4 py-3 font-medium">Meja</th>
                <th className="text-left px-4 py-3 font-medium">Kasir</th>
                <th className="text-right px-4 py-3 font-medium">Subtotal</th>
                <th className="text-right px-4 py-3 font-medium">PPN</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Metode</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && !transactions.length ? (
                <tr><td colSpan={9} className="text-center py-12 text-text-secondary">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-text-secondary">Tidak ada transaksi ditemukan</td></tr>
              ) : filtered.map((txn) => (
                <tr key={txn.id} className="border-b border-border/50 hover:bg-background/50 cursor-pointer" onClick={() => openDetail(txn)}>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{format(new Date(txn.createdAt), 'dd/MM/yy HH:mm')}</td>
                  <td className="px-4 py-3 text-text-primary font-mono text-xs">{txn.transactionNumber}</td>
                  <td className="px-4 py-3 text-center text-text-primary">{txn.tableNumber}</td>
                  <td className="px-4 py-3 text-text-secondary">{getCashierName(txn.cashierId)}</td>
                  <td className="px-4 py-3 text-right text-text-primary font-mono">{formatCurrency(txn.subtotalAmount)}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono">{formatCurrency(txn.ppnAmount)}</td>
                  <td className="px-4 py-3 text-right text-text-primary font-mono font-medium">{formatCurrency(txn.grandTotal)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs bg-background px-2 py-0.5 rounded">{PAYMENT_LABELS[txn.paymentMethod] ?? txn.paymentMethod}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[txn.transactionStatus])}>
                      {STATUS_LABELS[txn.transactionStatus] ?? txn.transactionStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTxn(null)}>
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Detail Transaksi</h2>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint} className="flex items-center gap-1 text-sm text-primary hover:underline"><Printer size={14} /> Cetak</button>
                <button onClick={() => setSelectedTxn(null)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
              </div>
            </div>

            <div ref={printRef}>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-text-secondary">No. Transaksi</span><span className="text-text-primary font-mono">{selectedTxn.transactionNumber}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Tanggal</span><span className="text-text-primary">{format(new Date(selectedTxn.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId })}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Meja</span><span className="text-text-primary">{selectedTxn.tableNumber}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Kasir</span><span className="text-text-primary">{getCashierName(selectedTxn.cashierId)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Metode</span><span className="text-text-primary">{PAYMENT_LABELS[selectedTxn.paymentMethod]}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Status</span>
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[selectedTxn.transactionStatus])}>
                    {STATUS_LABELS[selectedTxn.transactionStatus]}
                  </span>
                </div>
              </div>

              <div className="border-t border-border/50 pt-3 mb-3">
                <h3 className="text-sm font-medium text-text-secondary mb-2">Item Pesanan</h3>
                {txnItems.length > 0 ? (
                  <div className="space-y-1">
                    {txnItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-text-primary">{item.itemName} x{item.quantity}</span>
                        <span className="text-text-primary font-mono">{formatCurrency(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">Data item tidak tersedia</p>
                )}
              </div>

              <div className="border-t border-border/50 pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span className="text-text-primary font-mono">{formatCurrency(selectedTxn.subtotalAmount)}</span></div>
                {(selectedTxn.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between"><span className="text-text-secondary">Diskon{selectedTxn.discountName ? ` (${selectedTxn.discountName})` : ''}</span><span className="text-red-400 font-mono">-{formatCurrency(selectedTxn.discountAmount ?? 0)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-text-secondary">PPN ({selectedTxn.ppnRate}%)</span><span className="text-text-primary font-mono">{formatCurrency(selectedTxn.ppnAmount)}</span></div>
                <div className="flex justify-between font-semibold border-t border-border/50 pt-2"><span className="text-text-primary">Grand Total</span><span className="text-primary font-mono">{formatCurrency(selectedTxn.grandTotal)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Dibayar</span><span className="text-text-primary font-mono">{formatCurrency(selectedTxn.amountPaid)}</span></div>
                {selectedTxn.changeAmount > 0 && (
                  <div className="flex justify-between"><span className="text-text-secondary">Kembalian</span><span className="text-text-primary font-mono">{formatCurrency(selectedTxn.changeAmount)}</span></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
      <p className={clsx('text-lg font-semibold', color)}>{value}</p>
    </div>
  );
}
