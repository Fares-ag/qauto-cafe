'use client';

import { Button } from './Button';

export function PinPad({
  pin,
  onPinChange,
  onSubmit,
  loading,
  submitLabel = 'Enter',
}: {
  pin: string;
  onPinChange: (pin: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  submitLabel?: string;
}) {
  function append(digit: string) {
    if (pin.length < 6) onPinChange(pin + digit);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`rounded-full border transition-colors duration-150 ${
              pin[i] ? 'border-brand bg-brand' : 'border-border-strong bg-surface-sunken'
            } ${pin[i] ? 'h-3.5 w-3.5' : 'h-3 w-3'}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === 'C') onPinChange('');
              else if (key === '⌫') onPinChange(pin.slice(0, -1));
              else append(key);
            }}
            className="rounded-xl bg-surface-sunken py-4 text-lg font-semibold text-ink transition-colors duration-150 hover:bg-surface-raised active:scale-[0.98]"
          >
            {key}
          </button>
        ))}
      </div>

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={pin.length < 4}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
