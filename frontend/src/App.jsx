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
import { CompaniesPage } from './pages/holding/CompaniesPage.jsx';
import { HoldingUsersPage } from './pages/holding/HoldingUsersPage.jsx';
import { ManagersPage } from './pages/holding/ManagersPage.jsx';
import { EmployeesPage } from './pages/shared/EmployeesPage.jsx';
import { AuditLogPage } from './pages/holding/AuditLogPage.jsx';
import { EvaluationSetupPage } from './pages/holding/EvaluationSetupPage.jsx';
import { EvaluationDetailPage } from './pages/evaluations/EvaluationDetailPage.jsx';
import { EvaluationsPage } from './pages/evaluations/EvaluationsPage.jsx';
import { MyEvaluationsPage } from './pages/evaluations/MyEvaluationsPage.jsx';
import { EmployeeReportPage } from './pages/reports/EmployeeReportPage.jsx';
import { ReportsPage } from './pages/reports/ReportsPage.jsx';

// The pages that are finished. Every other menu entry still shows "built in the next step".
const PAGES = {
  '/companies': CompaniesPage,
  '/managers': ManagersPage,
  '/employees': EmployeesPage,
  '/holding-users': HoldingUsersPage,
  '/evaluation-setup': EvaluationSetupPage,
  '/evaluations': EvaluationsPage,
  '/my-evaluations': MyEvaluationsPage,
  '/reports': ReportsPage,
  '/audit-log': AuditLogPage,
};

// For each menu entry (except the dashboard), work out which roles have it in their menu,
// so that the other roles get "Not available".
const menuPages = [];
for (const [role, items] of Object.entries(NAVIGATION)) {
  for (const item of items) {
    if (item.to === '/dashboard') continue;
    const existing = menuPages.find((page) => page.to === item.to);
    if (existing) existing.roles.push(role);
    else menuPages.push({ ...item, roles: [role] });
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
            {/* Pages opened from a list (not in the menu). */}
            <Route path="/evaluations/:id" element={<EvaluationDetailPage />} />
            <Route
              path="/reports/employees/:employeeId"
              element={
                <RequireAuth roles={['HOLDING', 'MANAGER']}>
                  <EmployeeReportPage />
                </RequireAuth>
              }
            />
            {menuPages.map((item) => {
              const Page = PAGES[item.to];
              return (
                <Route
                  key={item.to}
                  path={item.to}
                  element={<RequireAuth roles={item.roles}>{Page ? <Page /> : <ComingSoonPage title={item.label} />}</RequireAuth>}
                />
              );
            })}
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
