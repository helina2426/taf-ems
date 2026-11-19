// The business rules for weekly check-ins (version 2, Module 14).
//
// Each week, an employee writes 3 short answers: what I did, what I will do next, what is blocking me.
// Their Manager can reply. There is NO score: it is a memory aid, so that at evaluation time
// nothing is forgotten.
//
//                 Write own note        Reply           Read
//   Employee      this week / last      –               only their own notes
//   Manager       –                     their company   their company's notes
//   Holding       –                     –               every company (read only)
//
//   • An employee can change (or delete) a note until the Manager replies. After the reply it is frozen.
//   • The Head can switch check-ins off (Settings). Then nobody can write or reply,
//     but the old notes can still be read.
//   • The company wall: a note keeps the company the employee was in when they wrote it.
//     A Manager only ever reaches notes of their own company, whatever id is put in the URL.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { buildPagination, toDateOnly, toSkipTake } from '../../shared/validation.js';
import { todayInAddis } from '../plan-years/planYear.service.js';
import { getHoldingOrFail } from '../settings/settings.service.js';
import { isWritableWeek, mondayOf, weekEndOf, writableWeeks } from './checkIn.rules.js';
import * as repository from './checkIn.repository.js';

async function isEnabled(db) {
  const holding = await getHoldingOrFail(db);
  return holding.weeklyCheckInsEnabled;
}

async function assertEnabled(db) {
  if (!(await isEnabled(db))) {
    throw AppError.conflict('Weekly check-ins are switched off. The old notes can still be read.');
  }
}

const personName = (e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, jobTitle: e.jobTitle, company: e.company });

// What a check-in looks like in an answer, with the buttons this user may use.
function toResponse(checkIn, user, enabled, today) {
  const isAuthor = user.role === 'EMPLOYEE' && user.employeeId === checkIn.employeeId;
  const isManager = user.role === 'MANAGER' && Boolean(user.companyId) && user.companyId === checkIn.companyId;
  const weekStart = toDateOnly(checkIn.weekStart);
  return {
    id: checkIn.id,
    employeeId: checkIn.employeeId,
    companyId: checkIn.companyId,
    weekStart,
    weekEnd: weekEndOf(weekStart),
    done: checkIn.done,
    next: checkIn.next,
    blockers: checkIn.blockers,
    reply: checkIn.reply,
    repliedBy: checkIn.repliedBy?.email ?? null,
    repliedAt: checkIn.repliedAt,
    createdAt: checkIn.createdAt,
    updatedAt: checkIn.updatedAt,
    can: {
      edit: enabled && isAuthor && !checkIn.reply && isWritableWeek(weekStart, today),
      reply: enabled && isManager,
    },
  };
}

// ---------- Status (every role) ----------

export async function getStatus() {
  const today = todayInAddis();
  const [thisWeek, lastWeek] = writableWeeks(today);
  return { enabled: await isEnabled(), today, thisWeek, lastWeek };
}

// ---------- One employee's notes, newest first ----------

export async function listForEmployee(query, user) {
  let employeeId = query.employeeId;
  if (user.role === 'EMPLOYEE') {
    if (employeeId && employeeId !== user.employeeId) throw AppError.forbidden('You can only read your own check-ins.');
    employeeId = user.employeeId;
  }
  if (!employeeId) throw AppError.badRequest('Some fields are missing or invalid.', [{ field: 'employeeId', message: 'Choose an employee.' }]);

  const employee = await repository.findEmployee(employeeId);
  // A Manager may only open employees of their own company — anything else looks "not found".
  if (!employee || (user.role === 'MANAGER' && employee.companyId !== user.companyId)) {
    throw AppError.notFound('Employee not found.');
  }

  const where = { employeeId };
  // A Manager only sees the notes written in their company (not the ones from an earlier company).
  if (user.role === 'MANAGER') where.companyId = user.companyId;

  const [enabled, { items, total }] = await Promise.all([isEnabled(), repository.listForEmployee(where, toSkipTake(query))]);
  const today = todayInAddis();
  return {
    enabled,
    employee: personName(employee),
    items: items.map((c) => toResponse(c, user, enabled, today)),
    pagination: buildPagination(query, total),
  };
}

// ---------- One week, every employee of a company (Manager, Holding) ----------

export async function weekOverview(query, user) {
  if (user.role === 'EMPLOYEE') throw AppError.forbidden();
  const today = todayInAddis();
  const weekStart = query.weekStart ?? mondayOf(today);

  let companyId = query.companyId;
  if (user.role === 'MANAGER') {
    if (!user.companyId) throw AppError.forbidden('You are not assigned to a company.');
    if (companyId && companyId !== user.companyId) throw AppError.forbidden('You can only see your own company.');
    companyId = user.companyId;
  }

  const week = new Date(weekStart);
  const [enabled, checkIns] = await Promise.all([
    isEnabled(),
    repository.listForWeek({ weekStart: week, ...(companyId && { companyId }) }),
  ]);
  // Everyone who works now, plus anyone who wrote a note that week (even if they left since).
  const employees = await repository.listEmployees({
    ...(companyId && { companyId }),
    OR: [{ employmentStatus: 'ACTIVE' }, { id: { in: checkIns.map((c) => c.employeeId) } }],
    // Only employees write check-ins (a Manager's own profile is not part of "the team").
    user: { role: 'EMPLOYEE' },
  });

  const byEmployee = new Map(checkIns.map((c) => [c.employeeId, c]));
  const rows = employees.map((e) => {
    const checkIn = byEmployee.get(e.id);
    return { employee: personName(e), checkIn: checkIn ? toResponse(checkIn, user, enabled, today) : null };
  });
  return {
    enabled,
    weekStart,
    weekEnd: weekEndOf(weekStart),
    thisWeek: mondayOf(today),
    counts: {
      employees: rows.length,
      written: rows.filter((r) => r.checkIn).length,
      replied: rows.filter((r) => r.checkIn?.reply).length,
    },
    rows,
  };
}

// ---------- The employee writes (or changes) their own note ----------

export async function saveMine(weekStart, data, user) {
  if (user.role !== 'EMPLOYEE' || !user.employeeId) throw AppError.forbidden('Only employees write weekly check-ins.');
  const today = todayInAddis();
  if (!isWritableWeek(weekStart, today)) {
    throw AppError.conflict('You can only write the check-in of this week or of last week.');
  }

  const checkIn = await prisma.$transaction(async (tx) => {
    await assertEnabled(tx);
    const employee = await repository.findEmployee(user.employeeId, tx);
    if (employee.employmentStatus !== 'ACTIVE') throw AppError.forbidden('Only active employees can write check-ins.');

    const values = { done: data.done, next: data.next, blockers: data.blockers ?? null };
    const existing = await repository.findForWeek(employee.id, new Date(weekStart), tx);
    let saved;
    if (!existing) {
      saved = await repository.create({ ...values, employeeId: employee.id, companyId: employee.companyId, weekStart: new Date(weekStart) }, tx);
    } else {
      const { count } = await repository.updateIfNoReply(existing.id, values, tx);
      if (count === 0) throw AppError.conflict('Your Manager has already replied, so this check-in cannot be changed any more.');
      saved = await repository.findById(existing.id, tx);
    }
    await recordAudit(
      { userId: user.id, action: existing ? 'CHECK_IN_UPDATED' : 'CHECK_IN_CREATED', entityType: 'WeeklyCheckIn', entityId: saved.id, details: { weekStart } },
      tx,
    );
    return saved;
  });
  return toResponse(checkIn, user, true, today);
}

// ---------- The employee deletes their own note (only before the Manager replies) ----------

export async function deleteMine(weekStart, user) {
  if (user.role !== 'EMPLOYEE' || !user.employeeId) throw AppError.forbidden('Only employees write weekly check-ins.');
  if (!isWritableWeek(weekStart, todayInAddis())) {
    throw AppError.conflict('Only the check-in of this week or of last week can be deleted.');
  }
  await prisma.$transaction(async (tx) => {
    await assertEnabled(tx);
    const existing = await repository.findForWeek(user.employeeId, new Date(weekStart), tx);
    if (!existing) throw AppError.notFound('You have no check-in for this week.');
    const { count } = await repository.deleteIfNoReply(existing.id, tx);
    if (count === 0) throw AppError.conflict('Your Manager has already replied, so this check-in cannot be deleted.');
    await recordAudit({ userId: user.id, action: 'CHECK_IN_DELETED', entityType: 'WeeklyCheckIn', entityId: existing.id, details: { weekStart } }, tx);
  });
}

// ---------- The Manager replies ----------

export async function reply(id, data, user) {
  if (user.role !== 'MANAGER') throw AppError.forbidden("Only the employee's Manager can reply to a check-in.");

  const checkIn = await prisma.$transaction(async (tx) => {
    const existing = await repository.findById(id, tx);
    // The company wall: another company's note is "not found", so its existence is not revealed.
    if (!existing || !user.companyId || existing.companyId !== user.companyId) throw AppError.notFound('Check-in not found.');
    await assertEnabled(tx);

    const saved = await repository.update(id, { reply: data.reply, repliedById: user.id, repliedAt: new Date() }, tx);
    await recordAudit(
      {
        userId: user.id,
        action: existing.reply ? 'CHECK_IN_REPLY_UPDATED' : 'CHECK_IN_REPLIED',
        entityType: 'WeeklyCheckIn',
        entityId: id,
        details: { employeeId: existing.employeeId, weekStart: toDateOnly(existing.weekStart) },
      },
      tx,
    );
    return saved;
  });
  return toResponse(checkIn, user, true, todayInAddis());
}
