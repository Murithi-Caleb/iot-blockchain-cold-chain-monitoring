// Labelled form control. `as` selects the element ('input' by default, or 'select').
// Hint and error text are linked with aria-describedby.
export default function FormField({
  id,
  label,
  hint,
  error,
  as: Control = 'input',
  className = '',
  children,
  ...controlProps
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={id}>
        {label}
        {controlProps.required && <span className="field__required" aria-hidden="true"> *</span>}
      </label>
      <Control
        id={id}
        className="input"
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...controlProps}
      >
        {children}
      </Control>
      {hint && <p id={hintId} className="field__hint">{hint}</p>}
      {error && <p id={errorId} className="field__error">{error}</p>}
    </div>
  );
}
