// Builds the Express application: its settings, its routes, and its error handling.
// It does NOT start listening — server.js does that.
// Keeping them separate lets automated tests use the app without starting a real server.

import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import env from './config/env.js';
import prisma from './config/prisma.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFound } from './middleware/notFound.js';
import authRoutes from './modules/auth/auth.routes.js';
import companyRoutes from './modules/companies/company.routes.js';
import managerRoutes from './modules/managers/manager.routes.js';
import employeeRoutes from './modules/employees/employee.routes.js';
import periodRoutes from './modules/periods/period.routes.js';
import criterionRoutes from './modules/criteria/criterion.routes.js';
import goalRoutes from './modules/goals/goal.routes.js';
import selfAssessmentRoutes from './modules/self-assessments/selfAssessment.routes.js';
import evaluationRoutes from './modules/evaluations/evaluation.routes.js';
import holdingUserRoutes from './modules/holding-users/holdingUser.routes.js';
import reportRoutes from './modules/reports/report.routes.js';
import auditLogRoutes from './modules/audit-logs/auditLog.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import planYearRoutes from './modules/plan-years/planYear.routes.js';
import { kpiRoutes, planRoutes } from './modules/plans/plan.routes.js';
import checkInRoutes from './modules/check-ins/checkIn.routes.js';
import changeRequestRoutes from './modules/change-requests/changeRequest.routes.js';
import appealRoutes from './modules/appeals/appeal.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Behind a proxy (nginx…), trust it to tell us the visitor's real address (see TRUST_PROXY).
if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);

// 1. Security (Phase 7).
// Do not announce "X-Powered-By: Express" (it tells attackers which software to target).
app.disable('x-powered-by');
// Helmet adds security headers that tell browsers to be stricter (for example, never guess
// a file's type, never show this API inside another site's frame).
app.use(helmet());
// CORS: only the websites listed in CORS_ORIGINS (our React app) may call the API from a browser.
app.use(cors({ origin: env.corsOrigins }));
// Limit how many requests one computer can send.
app.use('/api', apiLimiter);

// 2. Let the app read JSON data sent in request bodies — at most 100 KB per request,
//    so nobody can slow the server down by sending huge bodies.
app.use(express.json({ limit: '100kb' }));

// 3. Routes.
// Health check: a simple URL that answers "I'm alive".
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      message: 'Taf EMS backend is running',
      timestamp: new Date().toISOString(),
    },
  });
});

// Readiness check: is the database reachable too? Used by servers and monitoring tools.
app.get('/api/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ success: true, data: { status: 'ok', database: 'ok' } });
  } catch {
    res.status(503).json({ success: false, error: { message: 'The database is not reachable.' } });
  }
});

// Module routes.
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/evaluation-periods', periodRoutes);
app.use('/api/evaluation-criteria', criterionRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/self-assessments', selfAssessmentRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/holding-users', holdingUserRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditLogRoutes);
// Version 2: plan-based evaluation.
app.use('/api/settings', settingsRoutes);
app.use('/api/plan-years', planYearRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/check-ins', checkInRoutes);
app.use('/api/change-requests', changeRequestRoutes);
app.use('/api/appeals', appealRoutes);

// Production: also serve the built React app (see SERVE_FRONTEND).
if (env.serveFrontend) {
  const dist = path.resolve(env.frontendDist);
  if (!existsSync(path.join(dist, 'index.html'))) {
    throw new Error(`SERVE_FRONTEND is true, but ${dist}/index.html was not found. Run "npm run build" in frontend first.`);
  }
  // Files in /assets have a fingerprint in their name, so browsers may keep them for a year.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false }));
  // Any other page address (/dashboard, /evaluations/123…) gets index.html; React Router shows the right page.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// 4. No route matched → 404. Must come AFTER all routes.
app.use(notFound);

// 5. Turn any error into a clean JSON reply. Must be the LAST app.use.
app.use(errorHandler);

export default app;