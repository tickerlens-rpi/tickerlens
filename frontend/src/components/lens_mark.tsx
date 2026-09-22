interface LensMarkProps {
  className?: string;
}

/**
 * The TickerLens mark: a lens over a small trend line. Decorative only; the
 * wordmark text next to it carries the name.
 */
export function LensMark({className}: LensMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="lens-mark__plate" width="64" height="64" rx="14" />
      <circle className="lens-mark__ring" cx="29" cy="29" r="15" />
      <path className="lens-mark__handle" d="M40 40l12 12" />
      <path className="lens-mark__trend" d="M20 33l6-7 5 4 7-9" />
    </svg>
  );
}
