// The list of pages (routes) and who may see them.

import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext.jsx';
import { RequireAuth } from './auth/RequireAuth.jsx';
import { AppLayout } from './layout/AppLayout.jsx';
import { NAVIGATION } from './layout/navigation.js';
import { ChangePasswordPage } from './pages/ChangePasswordPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ComingSoonPage, NotFoundPage } from './pages/SimplePages.jsx';

// Every menu entry except the dashboard is a placeholder for now (built in 8.4–8.6).
// For each page, we also work out which roles have it in their menu, so the others get "Not available".
const placeholderPages = [];
for (const [role, items] of Object.entries(NAVIGATION)) {
  for (const item of items) {
    if (item.to === '/dashboard') continue;
    const existing = placeholderPages.find((page) => page.to === item.to);
    if (existing) existing.roles.push(role);
    else placeholderPages.push({ ...item, roles: [role] });
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/change-password"
            element={
              <RequireAuth>
                <ChangePasswordPage />
              </RequireAuth>
            }
          />

          {/* Every page inside the app frame needs a logged-in user. */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            {placeholderPages.map((item) => (
              <Route
                key={item.to}
                path={item.to}
                element={
                  <RequireAuth roles={item.roles}>
                    <ComingSoonPage title={item.label} />
                  </RequireAuth>
                }
              />
            ))}
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
