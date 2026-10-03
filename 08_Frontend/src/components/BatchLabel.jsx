import { QRCodeSVG } from 'qrcode.react';
import { getTraceUrl } from '../lib/config';
import { formatDateTime } from '../lib/format';

// Printable traceability label for a batch. The QR code encodes the batch's
// traceability page URL (<site origin>/trace/<id>), configurable via
// VITE_PUBLIC_BASE_URL. Only the .print-label block is printed (see App.css).
export default function BatchLabel({ batch }) {
  const url = getTraceUrl(batch.batch_id);

  return (
    <div className="label-layout">
      <div className="print-label">
        <span className="print-label__title">Traceability label</span>
        <QRCodeSVG value={url} size={180} />
        <span className="print-label__id">{batch.batch_id}</span>
        <span className="print-label__meta">
          {batch.produce_type} &middot; {batch.quantity} &middot; {batch.source_location}
        </span>
        <span className="print-label__meta">Registered {formatDateTime(batch.registration_date)}</span>
        <span className="print-label__url">{url}</span>
      </div>
      <div className="stack">
        <p>
          Print this label and attach it to the pallet or crate. Scanning the QR code opens the
          traceability page for this batch (sign-in required).
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={() => window.print()}>
            Print label
          </button>
        </div>
      </div>
    </div>
  );
}
