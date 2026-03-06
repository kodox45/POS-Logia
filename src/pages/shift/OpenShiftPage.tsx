// Screen: S-014 | Interface: waiter-cashier-ui | Roles: waiter-cashier, owner

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useShiftManagementStore } from '@/stores/useShiftManagementStore';
import { Lock, Delete, ArrowLeft, CheckCircle } from 'lucide-react';

const PIN_LENGTH = 6;
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const;

type Step = 'pin' | 'balance';

function formatCurrency(amount: number): string {
  return `Rp ${(amount / 100).toLocaleString('id-ID')}`;
}

export default function OpenShiftPage() {
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinVerifying, setPinVerifying] = useState(false);
  const [balanceInput, setBalanceInput] = useState('0');
  const currentUser = useAuthStore((state) => state.currentUser);
  const verifyPin = useAuthStore((state) => state.verifyPin);
  const openShift = useShiftManagementStore((state) => state.openShift);
  const loading = useShiftManagementStore((state) => state.loading);
  const error = useShiftManagementStore((state) => state.error);
  const navigate = useNavigate();

  const handlePinPress = useCallback((key: string) => {
    if (key === 'delete') {
      setPin((prev) => prev.slice(0, -1));
      setPinError('');
      return;
    }
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      return prev + key;
    });
    setPinError('');
  }, []);

  const handlePinVerify = useCallback(async () => {
    if (!currentUser || pin.length === 0) return;
    setPinVerifying(true);
    setPinError('');
    try {
      const valid = await verifyPin(currentUser.id, pin);
      if (valid) {
        setStep('balance');
      } else {
        setPinError('PIN salah. Coba lagi.');
        setPin('');
      }
    } catch {
      setPinError('Gagal memverifikasi PIN.');
      setPin('');
    } finally {
      setPinVerifying(false);
    }
  }, [currentUser, pin, verifyPin]);

  const handleBalancePress = useCallback((key: string) => {
    if (key === 'delete') {
      setBalanceInput((prev) => {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      });
      return;
    }
    setBalanceInput((prev) => {
      if (prev === '0') return key;
      if (prev.length >= 12) return prev;
      return prev + key;
    });
  }, []);

  const handleOpenShift = useCallback(async () => {
    if (!currentUser) return;
    const balanceCents = parseInt(balanceInput, 10) * 100;
    await openShift(currentUser.id, balanceCents);
    const state = useShiftManagementStore.getState();
    if (state.activeShift) {
      navigate('/pos/orders', { replace: true });
    }
  }, [currentUser, balanceInput, openShift, navigate]);

  if (!currentUser) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="bg-surface rounded-lg p-6 sm:p-8 max-w-md w-full shadow-lg border border-border">
        {/* Shift Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Buka Kasir</h1>
          <p className="text-text-secondary text-sm">{dateStr} - {timeStr}</p>
          <p className="text-text-secondary text-sm mt-1">Kasir: {currentUser.displayName}</p>
        </div>

        {step === 'pin' && (
          <>
            {/* PIN Verification Step */}
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock size={24} className="text-primary" />
              </div>
            </div>
            <p className="text-text-secondary text-sm text-center mb-6">
              Masukkan PIN untuk membuka shift
            </p>

            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-6" aria-label={`PIN: ${pin.length} dari ${PIN_LENGTH} digit`}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full transition-colors ${
                    i < pin.length ? 'bg-primary' : 'bg-border'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-error text-sm mb-4 text-center" role="alert">{pinError}</p>
            )}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-label="Numpad PIN">
              {NUMPAD_KEYS.map((key, i) => {
                if (key === '') return <div key={i} />;
                if (key === 'delete') {
                  return (
                    <button key={i} type="button" onClick={() => handlePinPress('delete')} disabled={pinVerifying}
                      className="h-14 flex items-center justify-center rounded-lg bg-background hover:bg-surface-elevated active:bg-border text-text-secondary transition-colors disabled:opacity-50"
                      aria-label="Hapus digit">
                      <Delete size={20} />
                    </button>
                  );
                }
                return (
                  <button key={i} type="button" onClick={() => handlePinPress(key)} disabled={pinVerifying}
                    className="h-14 flex items-center justify-center rounded-lg bg-background hover:bg-surface-elevated active:bg-border text-text-primary text-lg font-medium transition-colors disabled:opacity-50">
                    {key}
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={handlePinVerify} disabled={pin.length === 0 || pinVerifying}
              className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white py-3 px-4 rounded-lg font-medium transition-colors">
              {pinVerifying ? 'Memverifikasi...' : 'Verifikasi PIN'}
            </button>

            <button type="button" onClick={() => navigate('/dashboard')}
              className="w-full mt-3 flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary py-2 transition-colors text-sm">
              <ArrowLeft size={16} />
              Kembali ke Dashboard
            </button>
          </>
        )}

        {step === 'balance' && (
          <>
            {/* Opening Balance Step */}
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle size={24} className="text-success" />
              </div>
            </div>
            <p className="text-success text-sm text-center mb-2 font-medium">PIN terverifikasi</p>
            <p className="text-text-secondary text-sm text-center mb-6">
              Masukkan modal awal kas (Rupiah)
            </p>

            {/* Currency display */}
            <div className="bg-background border border-border rounded-lg px-4 py-4 mb-6 text-center">
              <p className="text-text-secondary text-xs mb-1">Modal Awal</p>
              <p className="text-2xl sm:text-3xl font-bold text-text-primary">
                {formatCurrency(parseInt(balanceInput, 10) * 100)}
              </p>
            </div>

            {error && (
              <p className="text-error text-sm mb-4 text-center" role="alert">{error}</p>
            )}

            {/* Numpad for balance */}
            <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-label="Numpad modal awal">
              {NUMPAD_KEYS.map((key, i) => {
                if (key === '') return <div key={i} />;
                if (key === 'delete') {
                  return (
                    <button key={i} type="button" onClick={() => handleBalancePress('delete')} disabled={loading}
                      className="h-14 flex items-center justify-center rounded-lg bg-background hover:bg-surface-elevated active:bg-border text-text-secondary transition-colors disabled:opacity-50"
                      aria-label="Hapus digit">
                      <Delete size={20} />
                    </button>
                  );
                }
                return (
                  <button key={i} type="button" onClick={() => handleBalancePress(key)} disabled={loading}
                    className="h-14 flex items-center justify-center rounded-lg bg-background hover:bg-surface-elevated active:bg-border text-text-primary text-lg font-medium transition-colors disabled:opacity-50">
                    {key}
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={handleOpenShift}
              disabled={loading || balanceInput === '0'}
              className="w-full bg-success hover:bg-success/90 disabled:opacity-50 text-white py-3 px-4 rounded-lg font-medium transition-colors">
              {loading ? 'Membuka Shift...' : 'Buka Shift'}
            </button>

            <button type="button" onClick={() => { setStep('pin'); setPin(''); }}
              className="w-full mt-3 flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary py-2 transition-colors text-sm"
              disabled={loading}>
              <ArrowLeft size={16} />
              Kembali
            </button>
          </>
        )}
      </div>
    </div>
  );
}
