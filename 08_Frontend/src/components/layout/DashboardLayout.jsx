import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSession, logout, ROLE_LABELS } from '../../lib/auth';
import StatusBadge from '../ui/StatusBadge';

// Shared application shell: sidebar navigation, top bar and main content area.
//
// navItems entries:
//   { heading: 'Text' }                       section heading
//   { id, label }                             switches view via onNavigate(id)
//   { id, label, to: '/path' }                router link to another route
//   { id, label, planned: true }              not built yet: shown disabled with a tag
export default function DashboardLayout({ workspaceName, navItems, activeId, onNavigate, children }) {
  const navigate = useNavigate();
  const session = useMemo(() => getSession(), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const navId = useId();

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const renderItem = (item, index) => {
    if (item.heading) {
      return <li key={`h-${index}`} className="nav-heading" role="presentation">{item.heading}</li>;
    }

    if (item.planned) {
      return (
        <li key={item.id}>
          <span className="nav-item nav-item--planned" aria-disabled="true">
            {item.label}
            <span className="nav-tag">Planned</span>
          </span>
        </li>
      );
    }

    if (item.to) {
      return (
        <li key={item.id}>
          <Link className="nav-item" to={item.to} aria-current={activeId === item.id ? 'page' : undefined}>
            {item.label}
          </Link>
        </li>
      );
    }

    return (
      <li key={item.id}>
        <button
          type="button"
          className="nav-item"
          aria-current={activeId === item.id ? 'page' : undefined}
          onClick={() => {
            onNavigate(item.id);
            setMenuOpen(false);
          }}
        >
          {item.label}
        </button>
      </li>
    );
  };

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="shell">
        <aside id={navId} className={menuOpen ? 'sidebar sidebar--open' : 'sidebar'}>
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">CC</span>
            <div>
              <div className="brand__name">Cold Chain Monitor</div>
              <div className="brand__sub">Produce traceability</div>
            </div>
          </div>
          <nav className="sidebar__nav" aria-label="Main navigation">
            <ul>{navItems.map(renderItem)}</ul>
          </nav>
          <div className="sidebar__footer">
            <button type="button" className="nav-item" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </aside>

        {menuOpen && <div className="scrim scrim--visible" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

        <div className="shell__main">
          <header className="topbar">
            <div className="topbar__user">
              <button
                type="button"
                className="btn btn--secondary btn--sm menu-button"
                aria-expanded={menuOpen}
                aria-controls={navId}
                onClick={() => setMenuOpen((open) => !open)}
              >
                Menu
              </button>
              <span className="topbar__workspace">{workspaceName}</span>
            </div>
            <div className="topbar__user">
              {session?.email && <span className="topbar__email">{session.email}</span>}
              {session?.role && <StatusBadge variant="info">{ROLE_LABELS[session.role] || session.role}</StatusBadge>}
            </div>
          </header>
          <main id="main-content" className="content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
