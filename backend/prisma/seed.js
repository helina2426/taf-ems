// Fills the DEVELOPMENT database with fake sample data for testing.
// Every name, email and company here is invented. Never put real employee data here.
//
// Run with:  npm run db:seed
// To start again from an empty database:  npx prisma migrate reset  (then seed again)

import bcrypt from 'bcryptjs';
import env from '../src/config/env.js';
import prisma from '../src/config/prisma.js';

// One shared password for every sample account (development only).
// Sample accounts are ready to use (mustChangePassword = false), EXCEPT hr@demo.local,
// which keeps the "change your password first" rule so we can test it.
// Real accounts created through the API always must change their password first.
const SAMPLE_PASSWORD = 'ChangeMe123!';

async function main() {
  // Safety check 1: never run on a real (production) database.
  if (env.nodeEnv === 'production') {
    throw new Error('The seed script must never run in production.');
  }

  // Safety check 2: do not add sample data twice.
  const existingHolding = await prisma.holding.findFirst();
  if (existingHolding) {
    console.log('Sample data already exists. Nothing was changed.');
    console.log('To start again from an empty database, run: npx prisma migrate reset');
    return;
  }

  // Scramble the password once; every sample account uses the same hash.
  const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, 10);

  // A transaction: either EVERYTHING below is saved, or NOTHING is.
  // If any step fails halfway, PostgreSQL undoes the earlier steps automatically.
  await prisma.$transaction(async (tx) => {
    // ---- 1. The Holding ---------------------------------------------------
    const holding = await tx.holding.create({
      data: { name: 'Demo Holding' },
    });

    // ---- 2. Holding users ------------------------------------------------
    // The primary Holding user: the head of the organization, with all powers.
    const headUser = await tx.user.create({
      data: {
        email: 'head@demo.local',
        passwordHash,
        role: 'HOLDING',
        isPrimaryHoldingUser: true,
        canApproveEvaluations: true,
        mustChangePassword: false,
      },
    });

    // A second Holding user who cannot approve until the head allows it.
    await tx.user.create({
      data: {
        email: 'hr@demo.local',
        passwordHash,
        role: 'HOLDING',
        isPrimaryHoldingUser: false,
        canApproveEvaluations: false,
        mustChangePassword: true, // kept on purpose, to test the first-login rule
      },
    });

    // ---- 3. Two companies -------------------------------------------------
    // Two companies let us test that Manager A cannot see Company B.
    const alpha = await tx.company.create({
      data: {
        holdingId: holding.id,
        name: 'Alpha Energy (Demo)',
        code: 'ALPHA',
        email: 'info@alpha.demo.local',
      },
    });

    const beta = await tx.company.create({
      data: {
        holdingId: holding.id,
        name: 'Beta Logistics (Demo)',
        code: 'BETA',
        email: 'info@beta.demo.local',
      },
    });

    // ---- 4. People in each company ---------------------------------------
    // Helper: create a login account AND its employee profile together.
    async function createPerson({ email, role, company, employeeNumber, firstName, lastName, jobTitle }) {
      const user = await tx.user.create({
        data: { email, passwordHash, role, mustChangePassword: false },
      });

      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          companyId: company.id,
          employeeNumber,
          firstName,
          lastName,
          jobTitle,
          hireDate: new Date('2024-01-15'),
        },
      });

      return { user, employee };
    }

    // Company Alpha
    const alphaManager = await createPerson({
      email: 'manager.alpha@demo.local', role: 'MANAGER', company: alpha,
      employeeNumber: 'A-001', firstName: 'Selam', lastName: 'Tesfaye', jobTitle: 'General Manager',
    });
    const alphaEmployee1 = await createPerson({
      email: 'employee1.alpha@demo.local', role: 'EMPLOYEE', company: alpha,
      employeeNumber: 'A-002', firstName: 'Dawit', lastName: 'Bekele', jobTitle: 'Engineer',
    });
    await createPerson({
      email: 'employee2.alpha@demo.local', role: 'EMPLOYEE', company: alpha,
      employeeNumber: 'A-003', firstName: 'Hanna', lastName: 'Girma', jobTitle: 'Accountant',
    });

    // Company Beta
    const betaManager = await createPerson({
      email: 'manager.beta@demo.local', role: 'MANAGER', company: beta,
      employeeNumber: 'B-001', firstName: 'Yonas', lastName: 'Alemu', jobTitle: 'General Manager',
    });
    const betaEmployee1 = await createPerson({
      email: 'employee1.beta@demo.local', role: 'EMPLOYEE', company: beta,
      employeeNumber: 'B-002', firstName: 'Meron', lastName: 'Haile', jobTitle: 'Logistics Officer',
    });
    await createPerson({
      email: 'employee2.beta@demo.local', role: 'EMPLOYEE', company: beta,
      employeeNumber: 'B-003', firstName: 'Samuel', lastName: 'Tadesse', jobTitle: 'Driver Supervisor',
    });

    // ---- 5. Assign each Manager to their company -------------------------
    await tx.managerAssignment.createMany({
      data: [
        { companyId: alpha.id, managerUserId: alphaManager.user.id, assignedById: headUser.id },
        { companyId: beta.id, managerUserId: betaManager.user.id, assignedById: headUser.id },
      ],
    });

    // ---- 6. An evaluation period -----------------------------------------
    const period = await tx.evaluationPeriod.create({
      data: {
        name: '2026 Annual Evaluation',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'OPEN',
        createdById: headUser.id,
      },
    });

    // ---- 7. Evaluation criteria (weights in each list add up to 100) -----
    await tx.evaluationCriterion.createMany({
      data: [
        // For employees
        { name: 'Quality of work', appliesTo: 'EMPLOYEE', weight: 30 },
        { name: 'Productivity', appliesTo: 'EMPLOYEE', weight: 25 },
        { name: 'Teamwork', appliesTo: 'EMPLOYEE', weight: 20 },
        { name: 'Communication', appliesTo: 'EMPLOYEE', weight: 25 },
        // For managers
        { name: 'Leadership', appliesTo: 'MANAGER', weight: 30 },
        { name: 'Team results', appliesTo: 'MANAGER', weight: 30 },
        { name: 'Planning and organization', appliesTo: 'MANAGER', weight: 20 },
        { name: 'Communication with the Holding', appliesTo: 'MANAGER', weight: 20 },
      ],
    });

    // ---- 8. A sample goal in each company --------------------------------
    await tx.performanceGoal.create({
      data: {
        employeeId: alphaEmployee1.employee.id,
        periodId: period.id,
        createdById: alphaManager.user.id,
        title: 'Reduce equipment downtime',
        description: 'Plan preventive maintenance for the main generators.',
        kpi: 'Downtime hours per month',
        targetResult: 'Less than 5 hours per month',
        deadline: new Date('2026-12-31'),
        progressPercent: 40,
        status: 'IN_PROGRESS',
      },
    });

    await tx.performanceGoal.create({
      data: {
        employeeId: betaEmployee1.employee.id,
        periodId: period.id,
        createdById: betaManager.user.id,
        title: 'Improve on-time deliveries',
        kpi: 'Percentage of deliveries on time',
        targetResult: 'At least 95%',
        deadline: new Date('2026-12-31'),
      },
    });
  });

  console.log('Sample data created.');
  console.log(`All sample accounts use the password: ${SAMPLE_PASSWORD}`);
  console.log('(hr@demo.local must change it at first login; the others are ready to use.)');
  console.log('Accounts: head@demo.local, hr@demo.local,');
  console.log('          manager.alpha@demo.local, employee1.alpha@demo.local, employee2.alpha@demo.local,');
  console.log('          manager.beta@demo.local,  employee1.beta@demo.local,  employee2.beta@demo.local');
}

// Run main(). Whatever happens, close the database connection at the end.
main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
