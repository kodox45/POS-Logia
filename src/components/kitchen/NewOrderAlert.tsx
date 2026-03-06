import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { clsx } from 'clsx';

const ALERT_DURATION_MS = 5000;

interface NewOrderAlertProps {
  tableNumber: number | null;
  onDismiss: () => void;
}

export function NewOrderAlert({ tableNumber, onDismiss }: NewOrderAlertProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (tableNumber === null) {
      setVisible(false);
      return;
    }

    setVisible(true);
    playChime();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, ALERT_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tableNumber, onDismiss]);

  function playChime() {
    try {
      if (!audioRef.current) {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      }
    } catch {
      // Audio not available
    }
  }

  if (!visible || tableNumber === null) return null;

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-3 px-4',
        'bg-primary text-white shadow-lg animate-pulse'
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-3">
        <Bell size={20} className="animate-bounce" />
        <span className="text-base font-bold">
          Pesanan Baru! Meja {tableNumber}
        </span>
      </div>
    </div>
  );
}
