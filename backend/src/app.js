// Builds the Express application: its settings, its routes, and its error handling.
// It does NOT start listening — server.js does that.
// Keeping them separate lets automated tests use the app without starting a real server.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import env from './config/env.js';
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
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

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

// 4. No route matched → 404. Must come AFTER all routes.
app.use(notFound);

// 5. Turn any error into a clean JSON reply. Must be the LAST app.use.
app.use(errorHandler);

export default app;