// The business rules for self-assessments (SRS FR-06, assumption 11).
//
//   • An employee (or a Manager, about their own work) writes one self-assessment per period.
//   • It can be saved as a DRAFT many times, then SUBMITTED once. After submitting it is locked.
//   • Writing is only possible while the period is OPEN.
//   • A DRAFT is private: only its author can read it.
//   • Once SUBMITTED:
//       – an employee's self-assessment can be read by their Manager and by Holding users;
//       – a Manager's self-assessment can be read by Holding users.
//   • Self-assessment is optional: evaluations do not wait for it. The overview shows who has
//     not started, who is still drafting, and who has submitted.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { buildPagination, toSkipTake } from '../../shared/validation.js';
import * as repository from './selfAssessment.repository.js';
import { MIN_SUBMIT_LENGTH } from './selfAssessment.validation.js';

const toResponse = repository.toAssessmentResponse;

// ---------- Helpers ----------

async function myEmployeeOrFail(user, db) {
  const employee = await repository.findEmployeeByUserId(user.id, db);
  if (!employee) throw AppError.forbidden('You do not have an employee profile.');
  return employee;
}

async function getPeriodOrFail(periodId, db) {
  const period = await repository.findPeriodById(periodId, db);
  if (!period) throw AppError.notFound('Evaluation period not found.');
  return period;
}

function assertPeriodOpen(period) {
  if (period.status !== 'OPEN') {
    throw AppError.conflict(`Self-assessments can only be written while the period is open. "${period.name}" is ${period.status}.`);
  }
}

function managersCompanyId(user) {
  if (!user.companyId) throw AppError.forbidden('You are not assigned to a company yet.');
  return user.companyId;
}

// ---------- The author (employee or manager) ----------

export async function listMine(user) {
  const me = await myEmployeeOrFail(user);
  const assessments = await repository.findAllForEmployee(me.id);
  return { items: assessments.map(toResponse) };
}

// Everything the author needs on one screen: the period, their self-assessment, and their goals.
export async function getMineForPeriod(periodId, user) {
  const me = await myEmployeeOrFail(user);
  const period = await getPeriodOrFail(periodId);

  const [assessment, goals] = await Promise.all([
    repository.findForEmployeeAndPeriod(me.id, periodId),
    repository.findGoalsForEmployeeAndPeriod(me.id, periodId),
  ]);

  return {
    period: { id: period.id, name: period.name, status: period.status },
    selfAssessment: assessment ? toResponse(assessment) : null,
    goals: goals.map(repository.toGoalSummary),
  };
}

export async function saveMyDraft(periodId, { comments }, user) {
  const assessment = await prisma.$transaction(async (tx) => {
    const me = await myEmployeeOrFail(user, tx);
    assertPeriodOpen(await getPeriodOrFail(periodId, tx));

    const existing = await repository.findForEmployeeAndPeriod(me.id, periodId, tx);
    if (existing?.status === 'SUBMITTED') {
      throw AppError.conflict('This self-assessment has already been submitted and can no longer be changed.');
    }

    const saved = await repository.saveDraft(me.id, periodId, comments, tx);
    await recordAudit(
      { userId: user.id, action: 'SELF_ASSESSMENT_SAVED', entityType: 'SelfAssessment', entityId: saved.id },
      tx,
    );
    return saved;
  });

  return toResponse(assessment);
}

export async function submitMine(periodId, user) {
  const assessment = await prisma.$transaction(async (tx) => {
    const me = await myEmployeeOrFail(user, tx);
    assertPeriodOpen(await getPeriodOrFail(periodId, tx));

    const existing = await repository.findForEmployeeAndPeriod(me.id, periodId, tx);
    if (!existing) {
      throw AppError.conflict('Save a draft before submitting.');
    }
    if (existing.status === 'SUBMITTED') {
      throw AppError.conflict('This self-assessment has already been submitted.');
    }
    if ((existing.comments ?? '').trim().length < MIN_SUBMIT_LENGTH) {
      throw AppError.badRequest('Some fields are missing or invalid.', [
        { field: 'comments', message: `Write at least ${MIN_SUBMIT_LENGTH} characters before submitting.` },
      ]);
    }

    const submitted = await repository.markSubmitted(existing.id, tx);
    await recordAudit(
      { userId: user.id, action: 'SELF_ASSESSMENT_SUBMITTED', entityType: 'SelfAssessment', entityId: submitted.id },
      tx,
    );
    return submitted;
  });

  return toResponse(assessment);
}

// ---------- Readers (Manager, Holding) ----------

export async function getOverview(query, user) {
  await getPeriodOrFail(query.periodId);

  let filters;
  if (user.role === 'MANAGER') {
    const companyId = managersCompanyId(user);
    if (query.companyId && query.companyId !== companyId) {
      throw AppError.forbidden('You can only see your own company.');
    }
    // A Manager sees their employees — not their own (that one is for the Holding).
    filters = { ...query, companyId, roles: ['EMPLOYEE'] };
  } else {
    filters = { ...query, roles: ['EMPLOYEE', 'MANAGER'] };
  }

  const { items, total } = await repository.findOverview(filters, toSkipTake(query));
  return { items: items.map(repository.toOverviewRow), pagination: buildPagination(query, total) };
}

export async function getById(id, user) {
  const assessment = await repository.findById(id);
  if (!assessment) throw AppError.notFound('Self-assessment not found.');

  // The author can always read their own.
  const me = await repository.findEmployeeByUserId(user.id);
  if (me && assessment.employeeId === me.id) return toResponse(assessment);

  if (user.role === 'EMPLOYEE') {
    throw AppError.forbidden('You can only read your own self-assessment.');
  }
  if (user.role === 'MANAGER') {
    const sameCompany = assessment.employee.companyId === managersCompanyId(user);
    const isAnEmployee = assessment.employee.user.role === 'EMPLOYEE';
    if (!sameCompany || !isAnEmployee) {
      throw AppError.forbidden('You can only read self-assessments of employees in your own company.');
    }
  }
  if (assessment.status !== 'SUBMITTED') {
    throw AppError.forbidden('This self-assessment has not been submitted yet.');
  }
  return toResponse(assessment);
}