// The frame around every page after login: the top bar, the menu on the left,
// and the page itself in the middle (<Outlet /> = "the current page goes here").

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { useApi } from '../hooks/useApi.js';
import { visibleMenu } from '../utils/checkIns.js';
import { FEATURES_CHANGED, NAVIGATION, ROLE_LABELS } from './navigation.js';

export function AppLayout() {
  const { user, logout, setCalendar } = useAuth();
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // for small screens
  // Module 14: is the "Check-ins" menu item shown? Asked again on every page change, and at once
  // when the Head changes the switch on the Settings page (FEATURES_CHANGED).
  const { pathname } = useLocation();
  const checkInStatus = useApi('/check-ins/status');
  const reloadStatus = checkInStatus.reload;
  useEffect(() => reloadStatus(), [pathname, reloadStatus]);
  useEffect(() => {
    window.addEventListener(FEATURES_CHANGED, reloadStatus);
    return () => window.removeEventListener(FEATURES_CHANGED, reloadStatus);
  }, [reloadStatus]);
  const features = { checkIns: checkInStatus.data?.status.enabled };
  const items = visibleMenu(NAVIGATION[user.role] ?? [], features);
  const name = user.firstName ? `${user.firstName} ${user.lastName}` : user.email;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label="Open menu">
          ☰
        </button>
        <div className="brand">
          Taf <span>EMS</span>
        </div>
        <div className="topbar-user">
          <div className="topbar-name">{name}</div>
          <div className="topbar-role">
            {ROLE_LABELS[user.role]}
            {user.companyName && ` · ${user.companyName}`}
          </div>
        </div>
        {/* Version 2: every person chooses how dates are shown. Saved on the server. */}
        <label className="calendar-switch" title="How dates are shown">
          <span className="sr-only">Show dates in</span>
          <select
            value={user.displayCalendar ?? 'ETHIOPIAN'}
            disabled={savingCalendar}
            onChange={async (e) => {
              setSavingCalendar(true);
              try {
                await setCalendar(e.target.value);
              } finally {
                setSavingCalendar(false);
              }
            }}
          >
            <option value="ETHIOPIAN">EC dates</option>
            <option value="GREGORIAN">GC dates</option>
          </select>
        </label>
        <button className="btn btn-ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <nav className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main menu">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
        <NavLink to="/change-password" className={({ isActive }) => `nav-link nav-secondary ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          Change password
        </NavLink>
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
