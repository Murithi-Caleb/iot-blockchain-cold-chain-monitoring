// variant: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
// The text is always present and each variant adds a distinct glyph via CSS, so
// status is never communicated by colour alone.
export default function StatusBadge({ variant = 'neutral', children }) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
