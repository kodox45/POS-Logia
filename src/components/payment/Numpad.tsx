import { Delete } from 'lucide-react';

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  quickAmounts?: number[];
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];

const DEFAULT_QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

export function Numpad({ value, onChange, quickAmounts = DEFAULT_QUICK_AMOUNTS }: NumpadProps) {
  const handleKey = (key: string) => {
    if (key === 'del') {
      onChange(value.slice(0, -1) || '0');
    } else if (key === '000') {
      if (value !== '0') onChange(value + '000');
    } else {
      if (value === '0') {
        onChange(key);
      } else {
        onChange(value + key);
      }
    }
  };

  const handleQuickAmount = (amount: number) => {
    onChange(String(amount));
  };

  return (
    <div>
      {/* Quick Amount Buttons */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {quickAmounts.map((amount) => (
          <button
            key={amount}
            onClick={() => handleQuickAmount(amount)}
            className="py-2 text-xs bg-surface-elevated text-text-secondary rounded hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {amount.toLocaleString('id-ID')}
          </button>
        ))}
      </div>

      {/* Numpad Grid */}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className="py-3 text-sm font-medium bg-surface-elevated text-text-primary rounded hover:bg-primary/10 transition-colors flex items-center justify-center"
            aria-label={key === 'del' ? 'Hapus' : key}
          >
            {key === 'del' ? <Delete size={18} /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}
