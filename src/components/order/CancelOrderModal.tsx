import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface CancelOrderModalProps {
  orderNumber: string;
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function CancelOrderModal({ orderNumber, isOpen, onConfirm, onClose }: CancelOrderModalProps) {
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Konfirmasi pembatalan pesanan"
    >
      <div
        className="bg-surface rounded-lg border border-border p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-medium">Batalkan Pesanan</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-start gap-3 mb-6">
          <div className="p-2 bg-error/10 rounded-full shrink-0">
            <AlertTriangle size={20} className="text-error" />
          </div>
          <p className="text-text-secondary text-sm">
            Apakah Anda yakin ingin membatalkan pesanan <span className="text-text-primary font-medium">{orderNumber}</span>? Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-text-secondary border border-border rounded hover:bg-surface-elevated transition-colors"
          >
            Kembali
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 px-4 py-2 text-sm text-white bg-error rounded hover:bg-error/90 disabled:opacity-50 transition-colors"
          >
            {confirming ? 'Membatalkan...' : 'Ya, Batalkan'}
          </button>
        </div>
      </div>
    </div>
  );
}
