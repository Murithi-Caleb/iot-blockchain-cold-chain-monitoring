import { useEffect, useId, useRef } from 'react';

// Confirmation modal built on the native <dialog> element, which provides focus
// trapping, Escape-to-close and inert background without extra code.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onCancel
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      {open && (
        <>
          <div className="dialog__body">
            <h2 id={titleId}>{title}</h2>
            <div>{children}</div>
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={danger ? 'btn btn--danger' : 'btn btn--primary'}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
