// Fills the DEVELOPMENT database with fake sample data for testing.
// Every name, email and company here is invented. Never put real employee data here.
//
// Run with:  npm run db:seed
// To start again from an empty database:  npx prisma migrate reset  (then seed again)

import bcrypt from 'bcryptjs';
import env from '../src/config/env.js';
import prisma from '../src/config/prisma.js';
import { buildPlanYear } from '../src/shared/planYear.js';
import { splitYearTarget } from '../src/modules/plans/plan.rules.js';
import { randomUUID } from 'node:crypto';

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

    // ---- 7b. Version 2: the current plan year "2019 EFY" ------------------
    // Hamle 1, 2018 → Sene 30, 2019 (8 July 2026 → 7 July 2027), with its 19 periods.
    // ACTIVE: the year, and every half, quarter and month that has already started, are OPEN.
    const planYear = buildPlanYear('ETHIOPIAN', 2019);
    const cycle = await tx.performanceCycle.create({
      data: {
        holdingId: holding.id,
        name: planYear.name,
        calendar: 'ETHIOPIAN',
        year: 2019,
        startDate: new Date(planYear.startDate),
        endDate: new Date(planYear.endDate),
        status: 'ACTIVE',
        createdById: headUser.id,
      },
    });
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
    const periodIds = Object.fromEntries(planYear.periods.map((p) => [p.key, randomUUID()]));
    await tx.evaluationPeriod.createMany({
      data: planYear.periods.map((p) => ({
        id: periodIds[p.key],
        cycleId: cycle.id,
        parentId: p.parentKey ? periodIds[p.parentKey] : null,
        type: p.type,
        sequence: p.sequence,
        name: p.name,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        status: p.type === 'YEAR' || p.startDate <= today ? 'OPEN' : 'UPCOMING',
        createdById: headUser.id,
      })),
    });

    // ---- 7c. Version 2: demo plans for 2019 EFY (Module 12) ----------------
    // Holding plan → Alpha's company plan (Selam) → Dawit's plan, all ACTIVE and linked.
    // Beta, and Alpha's second employee, have no plan yet: you can practise on them.
    const months = await tx.evaluationPeriod.findMany({ where: { cycleId: cycle.id, type: 'MONTH' }, orderBy: { sequence: 'asc' } });
    const now = new Date();
    // Module 13: demo actual numbers. Months that are already over get CONFIRMED numbers;
    // the month we are in gets one number that is still waiting for the Manager's confirmation.
    const finished = months.filter((m) => m.endDate.toISOString().slice(0, 10) < today);
    const current = months.find((m) => m.startDate.toISOString().slice(0, 10) <= today && today <= m.endDate.toISOString().slice(0, 10));
    async function addActuals(kpiId, values, confirmer, enterer, currentValue) {
      for (const [i, month] of finished.entries()) {
        if (values[i] === undefined) break;
        await tx.kpiMonth.update({
          where: { kpiId_periodId: { kpiId, periodId: month.id } },
          data: { actual: values[i], enteredById: enterer, enteredAt: now, confirmedById: confirmer, confirmedAt: now },
        });
      }
      if (current && currentValue !== undefined) {
        await tx.kpiMonth.update({ where: { kpiId_periodId: { kpiId, periodId: current.id } }, data: { actual: currentValue, enteredById: enterer, enteredAt: now } });
      }
    }

    async function makePlan(level, scope, extra, kpis) {
      const plan = await tx.plan.create({
        data: { cycleId: cycle.id, level, scope, status: 'ACTIVE', createdById: headUser.id, approvedById: headUser.id, approvedAt: now, ...extra },
      });
      const created = {};
      for (const [index, kpi] of kpis.entries()) {
        const { key, parent, ...data } = kpi;
        const row = await tx.kpi.create({ data: { ...data, aggregation: data.aggregation ?? 'SUM', planId: plan.id, parentKpiId: parent ?? null, sortOrder: index } });
        const targets = splitYearTarget(data.yearTarget, data.aggregation ?? 'SUM', data.direction);
        await tx.kpiMonth.createMany({ data: months.map((m, i) => ({ kpiId: row.id, periodId: m.id, target: targets[i] })) });
        created[key] = row.id;
      }
      return created;
    }
    const H = await makePlan('HOLDING', 'HOLDING', {}, [
      { key: 'revenue', perspective: 'FINANCIAL', name: 'Group revenue', unit: 'million ETB', direction: 'HIGHER_IS_BETTER', yearTarget: 1200 },
      { key: 'onTime', perspective: 'CUSTOMER', name: 'On-time deliveries', unit: '%', direction: 'HIGHER_IS_BETTER', aggregation: 'AVERAGE', yearTarget: 95 },
      { key: 'deliveries', perspective: 'INTERNAL_PROCESS', name: 'Fuel deliveries completed', unit: 'deliveries', direction: 'HIGHER_IS_BETTER', yearTarget: 5000 },
      { key: 'safety', perspective: 'INTERNAL_PROCESS', name: 'Lost-time safety incidents', unit: 'incidents', direction: 'ZERO', yearTarget: 0 },
      { key: 'training', perspective: 'LEARNING_GROWTH', name: 'Training hours per employee', unit: 'hours', direction: 'HIGHER_IS_BETTER', yearTarget: 40 },
    ]);
    const A = await makePlan('COMPANY', `COMPANY:${alpha.id}`, { companyId: alpha.id, createdById: alphaManager.user.id, submittedAt: now }, [
      { key: 'revenue', parent: H.revenue, perspective: 'FINANCIAL', name: 'Alpha revenue', unit: 'million ETB', direction: 'HIGHER_IS_BETTER', yearTarget: 480, weight: 20 },
      { key: 'onTime', parent: H.onTime, perspective: 'CUSTOMER', name: 'On-time deliveries', unit: '%', direction: 'HIGHER_IS_BETTER', aggregation: 'AVERAGE', yearTarget: 96, weight: 20 },
      { key: 'deliveries', parent: H.deliveries, perspective: 'INTERNAL_PROCESS', name: 'Fuel deliveries completed', unit: 'deliveries', direction: 'HIGHER_IS_BETTER', yearTarget: 2400, weight: 20 },
      { key: 'safety', parent: H.safety, perspective: 'INTERNAL_PROCESS', name: 'Safety incidents', unit: 'incidents', direction: 'ZERO', yearTarget: 0, weight: 10 },
      { key: 'training', parent: H.training, perspective: 'LEARNING_GROWTH', name: 'Training hours per employee', unit: 'hours', direction: 'HIGHER_IS_BETTER', yearTarget: 40, weight: 10 },
    ]);
    const D = await makePlan('INDIVIDUAL', `EMPLOYEE:${alphaEmployee1.employee.id}`, {
      companyId: alpha.id, employeeId: alphaEmployee1.employee.id, createdById: alphaManager.user.id, approvedById: alphaManager.user.id,
    }, [
      { key: 'deliveries', parent: A.deliveries, perspective: 'INTERNAL_PROCESS', name: 'Fuel deliveries completed', unit: 'deliveries', direction: 'HIGHER_IS_BETTER', yearTarget: 1200, weight: 30 },
      { key: 'onTime', parent: A.onTime, perspective: 'CUSTOMER', name: 'On-time deliveries', unit: '%', direction: 'HIGHER_IS_BETTER', aggregation: 'AVERAGE', yearTarget: 96, weight: 20 },
      { key: 'safety', parent: A.safety, perspective: 'INTERNAL_PROCESS', name: 'Safety incidents', unit: 'incidents', direction: 'ZERO', yearTarget: 0, weight: 20 },
    ]);

    // Alpha's company numbers: entered by Selam, confirmed by the Head.
    const selam = alphaManager.user.id;
    await addActuals(A.revenue, [42, 38, 41, 39, 43, 40], headUser.id, selam);
    await addActuals(A.onTime, [96, 95, 97, 96, 98, 97], headUser.id, selam);
    await addActuals(A.deliveries, [210, 190, 205, 198, 212, 201], headUser.id, selam);
    await addActuals(A.safety, [0, 0, 1, 0, 0, 0], headUser.id, selam);
    await addActuals(A.training, [4, 2, 3, 5, 3, 4], headUser.id, selam);
    // Dawit's numbers: entered by Dawit, confirmed by Selam. This month's deliveries still wait for Selam.
    const dawit = alphaEmployee1.user.id;
    await addActuals(D.deliveries, [104, 98, 110, 95, 102, 99], selam, dawit, 60);
    await addActuals(D.onTime, [97, 94, 95, 98, 96, 97], selam, dawit);
    await addActuals(D.safety, [0, 0, 1, 0, 0, 0], selam, dawit);

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
