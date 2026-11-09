// The frame around every page after login: the top bar, the menu on the left,
// and the page itself in the middle (<Outlet /> = "the current page goes here").

import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { NAVIGATION, ROLE_LABELS } from './navigation.js';

export function AppLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false); // for small screens
  const items = NAVIGATION[user.role] ?? [];
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
