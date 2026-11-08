// The business rules for performance goals (SRS FR-05).
//
// Who may do what:
//   • Managers create, edit, cancel and reopen goals for employees of THEIR OWN company.
//   • Employees see their own goals and report progress (a percentage and a comment).
//   • Holding users can see every goal (oversight), but do not change them.
//
// The goal's status follows its progress automatically:
//     0%        → NOT_STARTED
//     1–99%     → IN_PROGRESS
//     100%      → COMPLETED
//     CANCELLED → only set or removed by the Manager; no progress can be reported meanwhile.
//
// Goals that belong to a CLOSED evaluation period are locked.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { buildPagination, toDateOnly, toSkipTake } from '../../shared/validation.js';
import * as goalRepository from './goal.repository.js';

const toResponse = goalRepository.toGoalResponse;
const CAN_RECEIVE_GOALS = ['ACTIVE', 'ON_LEAVE'];

function statusForProgress(progressPercent) {
  if (progressPercent === 0) return 'NOT_STARTED';
  if (progressPercent === 100) return 'COMPLETED';
  return 'IN_PROGRESS';
}

// ---------- Access helpers ----------

function managersCompanyId(user) {
  if (!user.companyId) throw AppError.forbidden('You are not assigned to a company yet.');
  return user.companyId;
}

async function myEmployeeId(user, db) {
  const employee = await goalRepository.findEmployeeByUserId(user.id, db);
  if (!employee) throw AppError.forbidden('You do not have an employee profile.');
  return employee.id;
}

// Loads a goal and checks that this user may see it.
async function getGoalForUser(id, user, db) {
  const goal = await goalRepository.findById(id, db);
  if (!goal) throw AppError.notFound('Goal not found.');

  if (user.role === 'MANAGER' && goal.employee.companyId !== managersCompanyId(user)) {
    throw AppError.forbidden('You can only access goals of your own company.');
  }
  if (user.role === 'EMPLOYEE' && goal.employeeId !== (await myEmployeeId(user, db))) {
    throw AppError.forbidden('You can only access your own goals.');
  }
  return goal;
}

function assertPeriodNotClosed(period) {
  if (period?.status === 'CLOSED') {
    throw AppError.conflict(`The evaluation period "${period.name}" is closed. Its goals cannot be changed.`);
  }
}

async function getUsablePeriod(periodId, db) {
  if (!periodId) return null;
  const period = await goalRepository.findPeriodById(periodId, db);
  if (!period) throw AppError.notFound('Evaluation period not found.');
  assertPeriodNotClosed(period);
  return period;
}

// ---------- Reading ----------

export async function listGoals(query, user) {
  let filters = query;

  if (user.role === 'MANAGER') {
    const companyId = managersCompanyId(user);
    if (query.companyId && query.companyId !== companyId) {
      throw AppError.forbidden('You can only list goals of your own company.');
    }
    filters = { ...query, companyId };
  }
  if (user.role === 'EMPLOYEE') {
    const employeeId = await myEmployeeId(user);
    if (query.employeeId && query.employeeId !== employeeId) {
      throw AppError.forbidden('You can only list your own goals.');
    }
    filters = { ...query, employeeId, companyId: undefined };
  }

  const { items, total } = await goalRepository.findMany(filters, toSkipTake(query));
  return { items: items.map(toResponse), pagination: buildPagination(query, total) };
}

export async function getGoal(id, user) {
  return toResponse(await getGoalForUser(id, user));
}

// ---------- Managers ----------

export async function createGoal(data, user) {
  const { employeeId, periodId, ...fields } = data;

  const goal = await prisma.$transaction(async (tx) => {
    const employee = await goalRepository.findEmployeeById(employeeId, tx);
    if (!employee || employee.user.role !== 'EMPLOYEE') throw AppError.notFound('Employee not found.');
    if (employee.companyId !== managersCompanyId(user)) {
      throw AppError.forbidden('You can only set goals for employees of your own company.');
    }
    if (!CAN_RECEIVE_GOALS.includes(employee.employmentStatus)) {
      throw AppError.conflict(`Goals cannot be given to an employee who is ${employee.employmentStatus}.`);
    }
    await getUsablePeriod(periodId, tx);

    const created = await goalRepository.create(
      { ...fields, employeeId, periodId: periodId ?? null, createdById: user.id },
      tx,
    );

    await recordAudit(
      {
        userId: user.id,
        action: 'GOAL_CREATED',
        entityType: 'PerformanceGoal',
        entityId: created.id,
        details: { employeeId, periodId: periodId ?? null, title: fields.title },
      },
      tx,
    );
    return created;
  });

  return toResponse(goal);
}

export async function updateGoal(id, data, user) {
  const goal = await prisma.$transaction(async (tx) => {
    const before = await getGoalForUser(id, user, tx);
    assertPeriodNotClosed(before.period);
    if (before.status === 'CANCELLED') {
      throw AppError.conflict('A cancelled goal cannot be changed. Reopen it first.');
    }
    if (data.periodId !== undefined) {
      await getUsablePeriod(data.periodId, tx);
    }

    const after = await goalRepository.update(id, data, tx);

    const changes = {};
    for (const field of Object.keys(data)) {
      const from = field === 'deadline' ? toDateOnly(before.deadline) : before[field];
      const to = field === 'deadline' ? toDateOnly(after.deadline) : after[field];
      if (from !== to) changes[field] = { from: from ?? null, to: to ?? null };
    }
    await recordAudit(
      { userId: user.id, action: 'GOAL_UPDATED', entityType: 'PerformanceGoal', entityId: id, details: changes },
      tx,
    );
    return after;
  });

  return toResponse(goal);
}

export async function cancelGoal(id, user) {
  const goal = await prisma.$transaction(async (tx) => {
    const before = await getGoalForUser(id, user, tx);
    assertPeriodNotClosed(before.period);
    if (before.status === 'CANCELLED') throw AppError.conflict('This goal is already cancelled.');

    const after = await goalRepository.update(id, { status: 'CANCELLED' }, tx);
    await recordAudit(
      { userId: user.id, action: 'GOAL_CANCELLED', entityType: 'PerformanceGoal', entityId: id, details: { from: before.status } },
      tx,
    );
    return after;
  });

  return toResponse(goal);
}

export async function reopenGoal(id, user) {
  const goal = await prisma.$transaction(async (tx) => {
    const before = await getGoalForUser(id, user, tx);
    assertPeriodNotClosed(before.period);
    if (before.status !== 'CANCELLED') throw AppError.conflict('Only a cancelled goal can be reopened.');

    // The status goes back to whatever the progress says.
    const status = statusForProgress(before.progressPercent);
    const after = await goalRepository.update(id, { status }, tx);
    await recordAudit(
      { userId: user.id, action: 'GOAL_REOPENED', entityType: 'PerformanceGoal', entityId: id, details: { to: status } },
      tx,
    );
    return after;
  });

  return toResponse(goal);
}

// ---------- Employees ----------

export async function reportProgress(id, { progressPercent, comment }, user) {
  const goal = await prisma.$transaction(async (tx) => {
    const before = await getGoalForUser(id, user, tx);
    assertPeriodNotClosed(before.period);
    if (before.status === 'CANCELLED') {
      throw AppError.conflict('This goal was cancelled. Progress cannot be reported on it.');
    }

    // Keep the history row AND update the goal itself, together.
    await goalRepository.createProgressUpdate(
      { goalId: id, updatedById: user.id, progressPercent, comment: comment ?? null },
      tx,
    );
    const after = await goalRepository.update(id, { progressPercent, status: statusForProgress(progressPercent) }, tx);

    await recordAudit(
      {
        userId: user.id,
        action: 'GOAL_PROGRESS_UPDATED',
        entityType: 'PerformanceGoal',
        entityId: id,
        details: { from: before.progressPercent, to: progressPercent },
      },
      tx,
    );
    return after;
  });

  return toResponse(goal);
}