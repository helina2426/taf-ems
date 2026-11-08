// Builds the Express application: its settings, its routes, and its error handling.
// It does NOT start listening — server.js does that.
// Keeping them separate lets automated tests use the app without starting a real server.

import express from 'express';
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
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// 1. Let the app read JSON data sent in request bodies.
app.use(express.json());

// 2. Routes.
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

// 3. No route matched → 404. Must come AFTER all routes.
app.use(notFound);

// 4. Turn any error into a clean JSON reply. Must be the LAST app.use.
app.use(errorHandler);

export default app;