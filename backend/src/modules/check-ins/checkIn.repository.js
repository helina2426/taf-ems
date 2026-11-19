// Database access for weekly check-ins.

import prisma from '../../config/prisma.js';

const include = { repliedBy: { select: { email: true } } };

export function findById(id, db = prisma) {
  return db.weeklyCheckIn.findUnique({ where: { id }, include });
}

export function findForWeek(employeeId, weekStart, db = prisma) {
  return db.weeklyCheckIn.findUnique({ where: { employeeId_weekStart: { employeeId, weekStart } }, include });
}

export async function listForEmployee(where, { skip, take }, db = prisma) {
  const [items, total] = await Promise.all([
    db.weeklyCheckIn.findMany({ where, include, orderBy: { weekStart: 'desc' }, skip, take }),
    db.weeklyCheckIn.count({ where }),
  ]);
  return { items, total };
}

export function listForWeek(where, db = prisma) {
  return db.weeklyCheckIn.findMany({ where, include });
}

export function create(data, db = prisma) {
  return db.weeklyCheckIn.create({ data, include });
}

// Only changes the note while nobody has replied yet (a "conditional update"), so an employee
// can never change a note at the same moment the Manager replies to it.
export function updateIfNoReply(id, data, db = prisma) {
  return db.weeklyCheckIn.updateMany({ where: { id, reply: null }, data });
}

export function deleteIfNoReply(id, db = prisma) {
  return db.weeklyCheckIn.deleteMany({ where: { id, reply: null } });
}

export function update(id, data, db = prisma) {
  return db.weeklyCheckIn.update({ where: { id }, data, include });
}

export function findEmployee(id, db = prisma) {
  return db.employee.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, jobTitle: true, companyId: true, employmentStatus: true, company: { select: { id: true, name: true } } },
  });
}

export function listEmployees(where, db = prisma) {
  return db.employee.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, jobTitle: true, companyId: true, employmentStatus: true, company: { select: { id: true, name: true } } },
    orderBy: [{ company: { name: 'asc' } }, { firstName: 'asc' }, { lastName: 'asc' }],
  });
}
