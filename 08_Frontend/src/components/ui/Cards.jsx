// Panel: a titled card. StatCard: a single headline figure.

export function Panel({ title, description, actions, flush = false, children }) {
  return (
    <section className="panel">
      {(title || actions) && (
        <header className="panel__header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="panel__description">{description}</p>}
          </div>
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'panel__body panel__body--flush' : 'panel__body'}>{children}</div>
    </section>
  );
}

// `value` of null/undefined renders a muted "Not available" placeholder instead of a
// number, so unavailable data is never shown as a fake figure.
export function StatCard({ label, value, meta, badge }) {
  const unavailable = value === null || value === undefined;
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className={unavailable ? 'stat-card__value stat-card__value--muted' : 'stat-card__value'}>
        {unavailable ? 'Not available yet' : value}
      </span>
      {(meta || badge) && (
        <span className="stat-card__meta">
          {badge} {meta}
        </span>
      )}
    </div>
  );
}
