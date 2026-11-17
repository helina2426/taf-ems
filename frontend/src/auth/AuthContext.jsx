// Keeps track of WHO is logged in, for the whole app.
//
// "Context" is React's way to share a value with every page without passing it down by hand.
// Pages read it with useAuth() (in useAuth.js).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../api/client.js';
import { AuthContext } from './authContextObject.js';
import { setDisplayCalendar } from '../utils/format.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // true while we check a saved token after a page refresh
  const [checking, setChecking] = useState(Boolean(tokenStore.get()));
  // a message to show on the login page, e.g. "Your session has expired"
  const [notice, setNotice] = useState('');
  // true after the user pressed "Log out": the next person to log in starts on the dashboard,
  // not on the page the previous person was looking at.
  const [loggedOut, setLoggedOut] = useState(false);

  const clearSession = useCallback((message = '') => {
    tokenStore.clear();
    setUser(null);
    setNotice(message);
  }, []);

  // If the backend answers 401 to ANY request, the session is over: go back to login.
  useEffect(() => {
    setUnauthorizedHandler((message) => clearSession(message || 'Please log in again.'));
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const data = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  // After a page refresh: if a token was saved, ask the backend who it belongs to.
  useEffect(() => {
    if (!tokenStore.get()) return;
    refreshUser()
      .catch(() => clearSession())
      .finally(() => setChecking(false));
  }, [refreshUser, clearSession]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    tokenStore.set(data.token);
    setNotice('');
    setLoggedOut(false);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout'); // recorded in the audit log
    } catch {
      // Even if this fails, we still log out on this device.
    }
    setLoggedOut(true);
    clearSession('You have been logged out.');
  }, [clearSession]);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const data = await api.post('/auth/change-password', { currentPassword, newPassword });
      // The old token stopped working (Phase 7), so keep the new one.
      tokenStore.set(data.token);
      return refreshUser();
    },
    [refreshUser],
  );

  // Version 2: show every date in the calendar this person chose (Ethiopian by default).
  // Done here, before the pages draw, so every page uses the right calendar.
  setDisplayCalendar(user?.displayCalendar);

  // Saves "show my dates in Ethiopian / Gregorian" and redraws the pages.
  const setCalendar = useCallback(async (displayCalendar) => {
    const data = await api.patch('/auth/preferences', { displayCalendar });
    setUser(data.user);
  }, []);

  // useMemo: only create a new object when something inside it changed.
  const value = useMemo(
    () => ({ user, checking, notice, loggedOut, login, logout, changePassword, refreshUser, setCalendar }),
    [user, checking, notice, loggedOut, login, logout, changePassword, refreshUser, setCalendar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
