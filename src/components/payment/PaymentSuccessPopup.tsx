import { CheckCircle, Printer } from 'lucide-react';
import type { Transaction } from '@/types';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  tunai: 'Tunai',
  qris: 'QRIS',
  gopay: 'GoPay',
  ovo: 'OVO',
  dana: 'DANA',
  shopeepay: 'ShopeePay',
  transfer_bank: 'Transfer Bank',
};

interface PaymentSuccessPopupProps {
  transaction: Transaction;
  isOpen: boolean;
  onPrintReceipt: () => void;
  onDone: () => void;
}

export function PaymentSuccessPopup({ transaction, isOpen, onPrintReceipt, onDone }: PaymentSuccessPopupProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Pembayaran berhasil"
    >
      <div className="bg-surface rounded-lg border border-border p-6 w-full max-w-sm mx-4 text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-success/10 rounded-full flex items-center justify-center">
            <CheckCircle size={32} className="text-success" />
          </div>
        </div>

        <h3 className="text-text-primary font-medium text-lg mb-1">Pembayaran Berhasil</h3>
        <p className="text-text-secondary text-sm mb-6">{transaction.transactionNumber}</p>

        {/* Transaction Summary */}
        <div className="bg-surface-elevated rounded-lg p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-text-secondary text-xs">
            <span>Meja</span>
            <span>{transaction.tableNumber}</span>
          </div>
          <div className="flex justify-between text-text-secondary text-xs">
            <span>Metode</span>
            <span>{PAYMENT_METHOD_LABELS[transaction.paymentMethod] ?? transaction.paymentMethod}</span>
          </div>
          <div className="flex justify-between text-text-secondary text-xs">
            <span>Subtotal</span>
            <span>Rp {transaction.subtotalAmount.toLocaleString('id-ID')}</span>
          </div>
          {(transaction.discountAmount ?? 0) > 0 && (
            <div className="flex justify-between text-success text-xs">
              <span>Diskon{transaction.discountName ? ` (${transaction.discountName})` : ''}</span>
              <span>- Rp {(transaction.discountAmount ?? 0).toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="flex justify-between text-text-secondary text-xs">
            <span>PPN ({transaction.ppnRate}%)</span>
            <span>Rp {transaction.ppnAmount.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-text-primary font-medium text-sm pt-2 border-t border-border">
            <span>Total</span>
            <span>Rp {transaction.grandTotal.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-text-secondary text-xs">
            <span>Dibayar</span>
            <span>Rp {transaction.amountPaid.toLocaleString('id-ID')}</span>
          </div>
          {transaction.changeAmount > 0 && (
            <div className="flex justify-between text-warning text-xs">
              <span>Kembalian</span>
              <span>Rp {transaction.changeAmount.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onPrintReceipt}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <Printer size={16} />
            Print Struk
          </button>
          <button
            onClick={onDone}
            className="flex-1 px-4 py-2.5 text-sm text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
