// Guard: PinGateModal — Modal overlay for PIN verification
// Triggered when entering POS screens from non-POS context
// Check: PIN hash comparison via bcrypt

import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { Delete, Lock } from 'lucide-react';

const PIN_LENGTH = 6;
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const;

export function PinGateModal() {
  const [pinVerified, setPinVerified] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const currentUser = useAuthStore((state) => state.currentUser);
  const verifyPin = useAuthStore((state) => state.verifyPin);

  const handleNumpadPress = useCallback((key: string) => {
    if (key === 'delete') {
      setPin((prev) => prev.slice(0, -1));
      setError('');
      return;
    }
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      return prev + key;
    });
    setError('');
  }, []);

  const handleVerify = useCallback(async () => {
    if (!currentUser || pin.length === 0) return;
    setVerifying(true);
    setError('');

    try {
      const valid = await verifyPin(currentUser.id, pin);
      if (valid) {
        setPinVerified(true);
      } else {
        setError('PIN salah. Coba lagi.');
        setPin('');
      }
    } catch {
      setError('Gagal memverifikasi PIN.');
      setPin('');
    } finally {
      setVerifying(false);
    }
  }, [currentUser, pin, verifyPin]);

  if (pinVerified || !currentUser) {
    return <Outlet />;
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-gate-title"
    >
      <div className="bg-surface rounded-lg p-6 sm:p-8 max-w-sm w-full mx-4 shadow-lg border border-border">
        <div className="flex items-center justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock size={24} className="text-primary" />
          </div>
        </div>

        <h2 id="pin-gate-title" className="text-lg font-semibold text-text-primary text-center mb-1">
          Verifikasi PIN
        </h2>
        <p className="text-text-secondary text-sm text-center mb-6">
          Masukkan PIN untuk mengakses area POS
        </p>

        {/* PIN dots display */}
        <div className="flex justify-center gap-3 mb-6" aria-label={`PIN dimasukkan: ${pin.length} dari ${PIN_LENGTH} digit`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full transition-colors ${
                i < pin.length ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-error text-sm mb-4 text-center" role="alert">{error}</p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-label="Numpad">
          {NUMPAD_KEYS.map((key, i) => {
            if (key === '') {
              return <div key={i} />;
            }
            if (key === 'delete') {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleNumpadPress('delete')}
                  disabled={verifying}
                  className="h-14 flex items-center justify-center rounded-lg bg-background hover:bg-surface-elevated active:bg-border text-text-secondary transition-colors disabled:opacity-50"
                  aria-label="Hapus digit terakhir"
                >
                  <Delete size={20} />
                </button>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleNumpadPress(key)}
                disabled={verifying}
                className="h-14 flex items-center justify-center rounded-lg bg-background hover:bg-surface-elevated active:bg-border text-text-primary text-lg font-medium transition-colors disabled:opacity-50"
              >
                {key}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleVerify}
          disabled={pin.length === 0 || verifying}
          className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white py-3 px-4 rounded-lg font-medium transition-colors"
        >
          {verifying ? 'Memverifikasi...' : 'Verifikasi'}
        </button>
      </div>
    </div>
  );
}
