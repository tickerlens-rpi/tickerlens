import {useSyncExternalStore} from 'react';
import {subscribeToLocalData} from '../lib/local_data';
import {
  TEXT_SIZES,
  applyTextSize,
  readStoredTextSize,
  storeTextSize,
} from '../lib/text_size';
import type {TextSize} from '../lib/text_size';

const LABELS: Record<TextSize, string> = {
  default: 'Default text size',
  large: 'Large text size',
  larger: 'Larger text size',
};

function readSize(): TextSize {
  return readStoredTextSize();
}

/**
 * Three-way text-size switch. The stored preference is applied before first
 * paint in `main.tsx`; this control changes it, and every copy of the control
 * (header and Settings) stays in sync through storage.
 */
export function TextSizeControl() {
  const size = useSyncExternalStore(
    subscribeToLocalData,
    readSize,
    (): TextSize => 'default',
  );

  function select(option: TextSize) {
    applyTextSize(option);
    storeTextSize(option);
  }

  return (
    <div className="text-size" role="group" aria-label="Text size">
      {TEXT_SIZES.map(option => (
        <button
          key={option}
          type="button"
          className={`text-size__option text-size__option--${option}`}
          aria-label={LABELS[option]}
          title={LABELS[option]}
          aria-pressed={size === option}
          onClick={() => select(option)}
        >
          A
        </button>
      ))}
    </div>
  );
}
