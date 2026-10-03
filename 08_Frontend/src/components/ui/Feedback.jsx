// Inline notices plus loading and empty states.

// variant: 'info' | 'success' | 'warning' | 'danger'
export function Notice({ variant = 'info', title, children, onDismiss }) {
  const urgent = variant === 'danger' || variant === 'warning';
  return (
    <div className={`notice notice--${variant}`} role={urgent ? 'alert' : 'status'}>
      <div className="notice__row">
        <div>
          {title && <p className="notice__title">{title}</p>}
          <div>{children}</div>
        </div>
        {onDismiss && (
          <button type="button" className="link-button" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
