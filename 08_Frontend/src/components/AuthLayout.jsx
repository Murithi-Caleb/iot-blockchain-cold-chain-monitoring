// Two-panel layout for the login and sign-up screens.
export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <div className="auth__brand">
        <div>
          <div className="brand" style={{ padding: 0, border: 0 }}>
            <span className="brand__mark" aria-hidden="true">CC</span>
            <div>
              <div className="brand__name">Cold Chain Monitor</div>
              <div className="brand__sub">Dedan Kimathi University of Technology</div>
            </div>
          </div>
          <h1>Produce Traceability and Cold Chain Monitoring</h1>
          <p className="auth__lead">
            A prototype system for Kenya&apos;s horticultural export industry: monitoring storage and
            transit conditions and tracing produce batches through the supply chain.
          </p>
          <ul className="auth__points">
            <li>IoT temperature and humidity monitoring</li>
            <li>QR-code traceability for every produce batch</li>
            <li>Role-based workspaces for administrators, operators and traceability users</li>
          </ul>
        </div>
        <p className="auth__footnote">Final-year Computer Science project prototype.</p>
      </div>
      <div className="auth__form-side">
        <div className="auth__card">{children}</div>
      </div>
    </div>
  );
}
