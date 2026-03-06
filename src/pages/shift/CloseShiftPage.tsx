// Screen: S-015 | Interface: waiter-cashier-ui | Roles: waiter-cashier, owner

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useShiftManagementStore } from '@/stores/useShiftManagementStore';
import {
  AlertTriangle,
  Lock,
  Delete,
  Printer,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const;

function formatCurrency(amount: number): string {
  return `Rp ${(amount / 100).toLocaleString('id-ID')}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function getShiftDuration(start: string): string {
  const diff = Date.now() - new Date(start).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours} jam ${minutes} menit`;
}

type Stage = 'summary' | 'reconciliation' | 'confirm';

export default function CloseShiftPage() {
  const [stage, setStage] = useState<Stage>('summary');
  const [cashInput, setCashInput] = useState('0');
  const [closingNotes, setClosingNotes] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const currentUser = useAuthStore((state) => state.currentUser);
  const activeShift = useShiftManagementStore((state) => state.activeShift);
  const shiftTransactions = useShiftManagementStore((state) => state.shiftTransactions);
  const closeShift = useShiftManagementStore((state) => state.closeShift);
  const loadShiftTransactions = useShiftManagementStore((state) => state.loadShiftTransactions);
  const loading = useShiftManagementStore((state) => state.loading);
  const error = useShiftManagementStore((state) => state.error);
  const navigate = useNavigate();

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  useEffect(() => {
    if (activeShift) {
      loadShiftTransactions(activeShift.id);
    }
  }, [activeShift, loadShiftTransactions]);

  const handleCashPress = useCallback((key: string) => {
    if (key === 'delete') {
      setCashInput((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    setCashInput((prev) => {
      if (prev === '0') return key;
      if (prev.length >= 12) return prev;
      return prev + key;
    });
  }, []);

  const handleCloseShift = useCallback(async () => {
    if (!activeShift) return;
    const actualCashCents = parseInt(cashInput, 10) * 100;
    await closeShift(activeShift.id, actualCashCents, closingNotes.trim() || undefined);
    const state = useShiftManagementStore.getState();
    if (!state.activeShift) {
      navigate('/dashboard', { replace: true });
    }
  }, [activeShift, cashInput, closingNotes, closeShift, navigate]);

  if (!currentUser || !activeShift) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-text-secondary">Tidak ada shift aktif</div>
      </div>
    );
  }

  const expectedCash = activeShift.openingBalance + activeShift.cashSalesTotal - activeShift.voidTotalAmount;
  const actualCashCents = parseInt(cashInput, 10) * 100;
  const discrepancy = actualCashCents - expectedCash;
  const hasDiscrepancy = discrepancy !== 0;
  const canClose = !hasDiscrepancy || closingNotes.trim().length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Closing Lock Banner — ONE-WAY session */}
      <div className="bg-error/10 border-b border-error/30 px-4 py-3 flex items-center gap-3 shrink-0">
        <Lock size={18} className="text-error shrink-0" />
        <div>
          <p className="text-error font-medium text-sm">Sesi Tutup Kasir</p>
          <p className="text-error/70 text-xs">Anda tidak dapat kembali ke operasi. Selesaikan proses penutupan.</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Stage: Summary */}
          {(stage === 'summary' || stage === 'reconciliation' || stage === 'confirm') && (
            <>
              {/* Shift Summary */}
              <section>
                <h2 className="text-lg font-semibold text-text-primary mb-4">Ringkasan Shift</h2>
                <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Shift</span>
                    <span className="text-text-primary font-medium text-sm">{activeShift.shiftNumber}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Kasir</span>
                    <span className="text-text-primary text-sm">{currentUser.displayName}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Durasi</span>
                    <span className="text-text-primary text-sm flex items-center gap-1">
                      <Clock size={14} />
                      {getShiftDuration(activeShift.shiftStartTime)}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Modal Awal</span>
                    <span className="text-text-primary font-medium text-sm">{formatCurrency(activeShift.openingBalance)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Total Transaksi</span>
                    <span className="text-text-primary font-medium text-sm">{activeShift.totalTransactions}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Penjualan Tunai</span>
                    <span className="text-text-primary font-medium text-sm">{formatCurrency(activeShift.cashSalesTotal)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Penjualan Digital</span>
                    <span className="text-text-primary font-medium text-sm">{formatCurrency(activeShift.digitalSalesTotal)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Total Pendapatan</span>
                    <span className="text-primary font-semibold">{formatCurrency(activeShift.totalRevenue)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Void</span>
                    <span className="text-error text-sm">{activeShift.voidCount} ({formatCurrency(activeShift.voidTotalAmount)})</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Total Diskon</span>
                    <span className="text-text-primary text-sm">{formatCurrency(activeShift.discountTotalGiven)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center bg-primary/5">
                    <span className="text-text-primary font-medium text-sm">Kas yang Diharapkan</span>
                    <span className="text-primary font-bold">{formatCurrency(expectedCash)}</span>
                  </div>
                </div>
              </section>

              {/* Transaction Report */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-text-primary">Laporan Transaksi</h2>
                  <button
                    type="button"
                    onClick={() => handlePrint()}
                    className="flex items-center gap-1.5 text-primary hover:text-primary-dark text-sm transition-colors"
                    aria-label="Cetak laporan transaksi"
                  >
                    <Printer size={16} />
                    Cetak
                  </button>
                </div>

                <div ref={printRef} className="bg-surface border border-border rounded-lg overflow-hidden">
                  {shiftTransactions.length === 0 ? (
                    <div className="px-4 py-8 text-center text-text-secondary text-sm">
                      Belum ada transaksi di shift ini
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-background">
                            <th className="px-3 py-2 text-left text-text-secondary font-medium">Waktu</th>
                            <th className="px-3 py-2 text-left text-text-secondary font-medium">No. Transaksi</th>
                            <th className="px-3 py-2 text-right text-text-secondary font-medium">Total</th>
                            <th className="px-3 py-2 text-left text-text-secondary font-medium">Metode</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {shiftTransactions.map((tx) => (
                            <tr key={tx.id}>
                              <td className="px-3 py-2 text-text-primary">{formatTime(tx.createdAt)}</td>
                              <td className="px-3 py-2 text-text-primary">{tx.transactionNumber}</td>
                              <td className="px-3 py-2 text-right text-text-primary font-medium">{formatCurrency(tx.grandTotal)}</td>
                              <td className="px-3 py-2 text-text-secondary capitalize">{tx.paymentMethod.replace('_', ' ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Stage: Reconciliation */}
          {stage === 'summary' && (
            <button
              type="button"
              onClick={() => setStage('reconciliation')}
              className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              Lanjut ke Rekonsiliasi Kas
              <ArrowRight size={18} />
            </button>
          )}

          {(stage === 'reconciliation' || stage === 'confirm') && (
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Rekonsiliasi Kas</h2>

              {/* Expected cash display */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-4">
                <p className="text-text-secondary text-xs">Kas Diharapkan (Sistem)</p>
                <p className="text-primary font-bold text-xl">{formatCurrency(expectedCash)}</p>
              </div>

              {/* Actual cash input display */}
              <div className="bg-background border border-border rounded-lg px-4 py-3 mb-4 text-center">
                <p className="text-text-secondary text-xs mb-1">Kas Aktual (Hitung Fisik)</p>
                <p className="text-2xl font-bold text-text-primary">{formatCurrency(actualCashCents)}</p>
              </div>

              {/* Numpad for cash */}
              <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-label="Numpad kas aktual">
                {NUMPAD_KEYS.map((key, i) => {
                  if (key === '') return <div key={i} />;
                  if (key === 'delete') {
                    return (
                      <button key={i} type="button" onClick={() => handleCashPress('delete')} disabled={loading}
                        className="h-12 flex items-center justify-center rounded-lg bg-surface hover:bg-surface-elevated active:bg-border text-text-secondary transition-colors disabled:opacity-50"
                        aria-label="Hapus digit">
                        <Delete size={18} />
                      </button>
                    );
                  }
                  return (
                    <button key={i} type="button" onClick={() => handleCashPress(key)} disabled={loading}
                      className="h-12 flex items-center justify-center rounded-lg bg-surface hover:bg-surface-elevated active:bg-border text-text-primary text-lg font-medium transition-colors disabled:opacity-50">
                      {key}
                    </button>
                  );
                })}
              </div>

              {/* Discrepancy indicator */}
              {cashInput !== '0' && (
                <div className={`rounded-lg px-4 py-3 mb-4 flex items-center gap-3 ${
                  !hasDiscrepancy
                    ? 'bg-success/10 border border-success/20'
                    : Math.abs(discrepancy) <= 500000
                      ? 'bg-warning/10 border border-warning/20'
                      : 'bg-error/10 border border-error/20'
                }`}>
                  {!hasDiscrepancy ? (
                    <CheckCircle size={20} className="text-success shrink-0" />
                  ) : (
                    <XCircle size={20} className={Math.abs(discrepancy) <= 500000 ? 'text-warning shrink-0' : 'text-error shrink-0'} />
                  )}
                  <div>
                    <p className={`font-medium text-sm ${
                      !hasDiscrepancy ? 'text-success' : Math.abs(discrepancy) <= 500000 ? 'text-warning' : 'text-error'
                    }`}>
                      {!hasDiscrepancy ? 'Kas cocok' : `Selisih: ${formatCurrency(Math.abs(discrepancy))}`}
                    </p>
                    {hasDiscrepancy && (
                      <p className="text-text-secondary text-xs">
                        {discrepancy > 0 ? 'Kas lebih dari yang diharapkan' : 'Kas kurang dari yang diharapkan'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes — mandatory if discrepancy exists */}
              {cashInput !== '0' && hasDiscrepancy && (
                <div className="mb-4">
                  <label htmlFor="closing-notes" className="block text-sm font-medium text-text-primary mb-1.5">
                    Catatan Penutupan <span className="text-error">*</span>
                  </label>
                  <div className="flex items-start gap-1.5 mb-1.5">
                    <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
                    <p className="text-warning text-xs">Wajib diisi karena ada selisih kas</p>
                  </div>
                  <textarea
                    id="closing-notes"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Jelaskan penyebab selisih kas..."
                    rows={3}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary text-sm placeholder:text-text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              )}

              {/* Optional notes when no discrepancy */}
              {cashInput !== '0' && !hasDiscrepancy && (
                <div className="mb-4">
                  <label htmlFor="closing-notes-optional" className="block text-sm font-medium text-text-primary mb-1.5">
                    Catatan Penutupan (opsional)
                  </label>
                  <textarea
                    id="closing-notes-optional"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Catatan tambahan..."
                    rows={2}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary text-sm placeholder:text-text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              )}

              {error && (
                <p className="text-error text-sm mb-4 text-center" role="alert">{error}</p>
              )}

              {/* Close Shift button */}
              <button
                type="button"
                onClick={() => setShowConfirmDialog(true)}
                disabled={loading || cashInput === '0' || !canClose}
                className="w-full bg-error hover:bg-error/90 disabled:opacity-50 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Menutup Shift...' : 'Tutup Shift'}
              </button>
            </section>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-close-title">
          <div className="bg-surface rounded-lg p-6 max-w-sm w-full shadow-lg border border-border">
            <h3 id="confirm-close-title" className="text-lg font-semibold text-text-primary mb-2">Konfirmasi Tutup Shift</h3>
            <p className="text-text-secondary text-sm mb-4">
              Shift akan ditutup secara permanen. Data shift tidak dapat diubah setelah penutupan.
            </p>
            {hasDiscrepancy && (
              <p className="text-warning text-sm mb-4">
                Selisih kas: {formatCurrency(Math.abs(discrepancy))}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 border border-border text-text-primary py-2.5 px-4 rounded-lg font-medium hover:bg-surface-elevated transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirmDialog(false); handleCloseShift(); }}
                disabled={loading}
                className="flex-1 bg-error hover:bg-error/90 disabled:opacity-50 text-white py-2.5 px-4 rounded-lg font-medium transition-colors"
              >
                Tutup Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
