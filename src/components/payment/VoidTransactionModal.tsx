import { useState } from 'react';
import { X, AlertTriangle, Lock } from 'lucide-react';
import type { VoidReason } from '@/types/enums';
import { VOID_REASONS } from '@/types/enums';

const VOID_REASON_LABELS: Record<VoidReason, string> = {
  salah_input: 'Salah Input',
  customer_batal: 'Customer Batal',
  item_habis: 'Item Habis',
  lainnya: 'Lainnya',
};

interface VoidTransactionModalProps {
  isOpen: boolean;
  orderNumber: string;
  voidAmount: number;
  onConfirm: (reason: VoidReason, notes: string, pin: string) => void;
  onClose: () => void;
  verifyingPin: boolean;
  pinError?: string;
}

export function VoidTransactionModal({
  isOpen,
  orderNumber,
  voidAmount,
  onConfirm,
  onClose,
  verifyingPin,
  pinError,
}: VoidTransactionModalProps) {
  const [step, setStep] = useState<'pin' | 'reason'>('pin');
  const [pin, setPin] = useState('');
  const [selectedReason, setSelectedReason] = useState<VoidReason | null>(null);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handlePinSubmit = () => {
    if (pin.length < 4) return;
    setStep('reason');
  };

  const handleConfirm = () => {
    if (!selectedReason) return;
    onConfirm(selectedReason, notes, pin);
  };

  const handleClose = () => {
    setStep('pin');
    setPin('');
    setSelectedReason(null);
    setNotes('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Void transaksi"
    >
      <div
        className="bg-surface rounded-lg border border-border p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-medium">Void Transaksi</h3>
          <button onClick={handleClose} className="text-text-secondary hover:text-text-primary" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        {step === 'pin' ? (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-warning/10 rounded-full shrink-0">
                <Lock size={20} className="text-warning" />
              </div>
              <div>
                <p className="text-text-secondary text-sm">
                  Masukkan PIN untuk void pesanan <span className="text-text-primary font-medium">{orderNumber}</span>
                </p>
                <p className="text-text-secondary text-xs mt-1">
                  Jumlah void: <span className="text-error font-medium">Rp {voidAmount.toLocaleString('id-ID')}</span>
                </p>
              </div>
            </div>

            <input
              type="password"
              placeholder="Masukkan PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 bg-surface-elevated text-text-primary text-center text-lg tracking-widest rounded-lg border border-border focus:border-primary focus:outline-none mb-2"
              autoFocus
              aria-label="PIN"
            />

            {pinError && (
              <p className="text-error text-xs mb-3 text-center">{pinError}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm text-text-secondary border border-border rounded hover:bg-surface-elevated transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handlePinSubmit}
                disabled={pin.length < 4 || verifyingPin}
                className="flex-1 px-4 py-2 text-sm text-white bg-warning rounded hover:bg-warning/90 disabled:opacity-50 transition-colors"
              >
                {verifyingPin ? 'Memverifikasi...' : 'Lanjut'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-error/10 rounded-full shrink-0">
                <AlertTriangle size={20} className="text-error" />
              </div>
              <p className="text-text-secondary text-sm">
                Pilih alasan void untuk pesanan <span className="text-text-primary font-medium">{orderNumber}</span>
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {VOID_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-4 py-2.5 text-sm rounded-lg border transition-colors ${
                    selectedReason === reason
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-text-secondary hover:border-primary/30'
                  }`}
                  aria-pressed={selectedReason === reason}
                >
                  {VOID_REASON_LABELS[reason]}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Catatan tambahan (opsional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-surface-elevated text-text-primary text-sm rounded-lg border border-border focus:border-primary focus:outline-none mb-4"
              aria-label="Catatan void"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep('pin')}
                className="flex-1 px-4 py-2 text-sm text-text-secondary border border-border rounded hover:bg-surface-elevated transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedReason || verifyingPin}
                className="flex-1 px-4 py-2 text-sm text-white bg-error rounded hover:bg-error/90 disabled:opacity-50 transition-colors"
              >
                {verifyingPin ? 'Memproses...' : 'Konfirmasi Void'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
