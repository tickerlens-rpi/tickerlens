import {useState} from 'react';
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

/**
 * Three-way text-size switch shown in the header. The stored preference is
 * applied before first paint in `main.tsx`; this control only changes it.
 */
export function TextSizeControl() {
  const [size, setSize] = useState<TextSize>(readStoredTextSize);

  function select(option: TextSize) {
    setSize(option);
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
          aria-pressed={size === option}
          onClick={() => select(option)}
        >
          A
        </button>
      ))}
    </div>
  );
}
