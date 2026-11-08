// The business rules for employees.
//
// Who may do what (SRS 1.3, FR-04):
//   • Holding users: every company.
//   • Managers: ONLY the company they are assigned to (the "company wall").
//   • Employees: only their own profile, and only phone, address and emergency contact.
//
// The company wall is checked HERE, in the backend, on every request — not by hiding
// buttons in the frontend. Typing another company's id into the URL does not help.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { hashPassword } from '../../shared/password.js';
import { buildPagination, toSkipTake } from '../../shared/validation.js';
import * as employeeRepository from './employee.repository.js';

const toResponse = employeeRepository.toEmployeeResponse;

// Employees who are ACTIVE or ON_LEAVE can log in. SUSPENDED or TERMINATED cannot.
const CAN_LOG_IN = ['ACTIVE', 'ON_LEAVE'];

// ---------- Company wall helpers ----------

// The company a Manager is allowed to work in. Throws if they are not assigned anywhere.
function managersCompanyId(user) {
  if (!user.companyId) {
    throw AppError.forbidden('You are not assigned to a company yet.');
  }
  return user.companyId;
}

function assertCanAccessCompany(user, companyId) {
  if (user.role === 'HOLDING') return;
  if (user.role === 'MANAGER' && managersCompanyId(user) === companyId) return;
  throw AppError.forbidden('You can only manage employees of your own company.');
}

async function getEmployeeForUser(id, user, db) {
  const employee = await employeeRepository.findById(id, db);
  if (!employee) {
    throw AppError.notFound('Employee not found.');
  }
  assertCanAccessCompany(user, employee.companyId);
  return employee;
}

// Records old → new for every field that really changed.
function diff(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    const from = before[field] instanceof Date ? before[field].toISOString() : before[field];
    const to = after[field] instanceof Date ? after[field].toISOString() : after[field];
    if (from !== to) changes[field] = { from: from ?? null, to: to ?? null };
  }
  return changes;
}

// ---------- Holding and Managers ----------

export async function listEmployees(query, user) {
  // A Manager's list is ALWAYS limited to their own company, whatever they ask for.
  const filters = user.role === 'MANAGER' ? { ...query, companyId: managersCompanyId(user) } : query;

  if (user.role === 'MANAGER' && query.companyId && query.companyId !== filters.companyId) {
    throw AppError.forbidden('You can only list employees of your own company.');
  }

  const { items, total } = await employeeRepository.findMany(filters, toSkipTake(query));
  return { items: items.map(toResponse), pagination: buildPagination(query, total) };
}

export async function getEmployee(id, user) {
  return toResponse(await getEmployeeForUser(id, user));
}

export async function createEmployee(data, user) {
  const { email, temporaryPassword, companyId: requestedCompanyId, ...profile } = data;

  let companyId;
  if (user.role === 'MANAGER') {
    companyId = managersCompanyId(user);
    if (requestedCompanyId && requestedCompanyId !== companyId) {
      throw AppError.forbidden('You can only add employees to your own company.');
    }
  } else {
    if (!requestedCompanyId) {
      throw AppError.badRequest('Some fields are missing or invalid.', [
        { field: 'companyId', message: 'companyId is required.' },
      ]);
    }
    companyId = requestedCompanyId;
  }

  const passwordHash = await hashPassword(temporaryPassword);

  const employee = await prisma.$transaction(async (tx) => {
    const company = await employeeRepository.findCompanyById(companyId, tx);
    if (!company) throw AppError.notFound('Company not found.');
    if (!company.isActive) throw AppError.conflict('This company is inactive.');

    if (await employeeRepository.findUserByEmail(email, null, tx)) {
      throw AppError.conflict('An account with this email already exists.');
    }
    if (await employeeRepository.findEmployeeNumberInCompany(companyId, profile.employeeNumber, null, tx)) {
      throw AppError.conflict('This employee number is already used in this company.');
    }

    const newUser = await employeeRepository.createUser({ email, passwordHash }, tx);
    const created = await employeeRepository.createEmployee({ ...profile, userId: newUser.id, companyId }, tx);

    await recordAudit(
      {
        userId: user.id,
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: created.id,
        details: { email, companyId, employeeNumber: profile.employeeNumber },
      },
      tx,
    );
    return created;
  });

  return toResponse(employee);
}

export async function updateEmployee(id, data, user) {
  const { email, ...profile } = data;

  const employee = await prisma.$transaction(async (tx) => {
    const before = await getEmployeeForUser(id, user, tx);

    if (email !== undefined && email !== before.user.email) {
      if (await employeeRepository.findUserByEmail(email, before.userId, tx)) {
        throw AppError.conflict('An account with this email already exists.');
      }
      await employeeRepository.updateUser(before.userId, { email }, tx);
    }

    if (profile.employeeNumber && profile.employeeNumber !== before.employeeNumber) {
      const clash = await employeeRepository.findEmployeeNumberInCompany(
        before.companyId,
        profile.employeeNumber,
        id,
        tx,
      );
      if (clash) throw AppError.conflict('This employee number is already used in this company.');
    }

    const after = await employeeRepository.updateEmployee(id, profile, tx);

    const changes = diff(before, after, Object.keys(profile));
    if (email !== undefined && email !== before.user.email) {
      changes.email = { from: before.user.email, to: email };
    }

    await recordAudit(
      { userId: user.id, action: 'EMPLOYEE_UPDATED', entityType: 'Employee', entityId: id, details: changes },
      tx,
    );
    return after;
  });

  return toResponse(employee);
}

export async function setEmploymentStatus(id, { employmentStatus }, user) {
  const employee = await prisma.$transaction(async (tx) => {
    const before = await getEmployeeForUser(id, user, tx);
    if (before.employmentStatus === employmentStatus) {
      throw AppError.conflict(`The employee's status is already ${employmentStatus}.`);
    }

    // The login account follows the employment status.
    await employeeRepository.updateUser(before.userId, { isActive: CAN_LOG_IN.includes(employmentStatus) }, tx);
    const after = await employeeRepository.updateEmployee(id, { employmentStatus }, tx);

    await recordAudit(
      {
        userId: user.id,
        action: 'EMPLOYEE_STATUS_CHANGED',
        entityType: 'Employee',
        entityId: id,
        details: { from: before.employmentStatus, to: employmentStatus },
      },
      tx,
    );
    return after;
  });

  return toResponse(employee);
}

// Holding only (checked in the routes). Old evaluations keep the old company,
// because Evaluation stores its own companyId.
export async function transferEmployee(id, { companyId }, user) {
  const employee = await prisma.$transaction(async (tx) => {
    const before = await getEmployeeForUser(id, user, tx);
    if (before.companyId === companyId) {
      throw AppError.conflict('The employee already belongs to this company.');
    }

    const company = await employeeRepository.findCompanyById(companyId, tx);
    if (!company) throw AppError.notFound('Company not found.');
    if (!company.isActive) throw AppError.conflict('The target company is inactive.');

    if (await employeeRepository.findEmployeeNumberInCompany(companyId, before.employeeNumber, null, tx)) {
      throw AppError.conflict(
        'The employee number is already used in the target company. Change it before transferring.',
      );
    }

    const after = await employeeRepository.updateEmployee(id, { companyId }, tx);

    await recordAudit(
      {
        userId: user.id,
        action: 'EMPLOYEE_TRANSFERRED',
        entityType: 'Employee',
        entityId: id,
        details: { fromCompanyId: before.companyId, toCompanyId: companyId },
      },
      tx,
    );
    return after;
  });

  return toResponse(employee);
}

// ---------- Employees: their own profile ----------

async function getMyEmployee(user, db) {
  const employee = await employeeRepository.findByUserId(user.id, db);
  if (!employee) {
    throw AppError.notFound('You do not have an employee profile.');
  }
  return employee;
}

export async function getMyProfile(user) {
  return toResponse(await getMyEmployee(user));
}

export async function updateMyProfile(data, user) {
  const employee = await prisma.$transaction(async (tx) => {
    const before = await getMyEmployee(user, tx);
    const after = await employeeRepository.updateEmployee(before.id, data, tx);

    await recordAudit(
      {
        userId: user.id,
        action: 'EMPLOYEE_SELF_UPDATED',
        entityType: 'Employee',
        entityId: before.id,
        details: diff(before, after, Object.keys(data)),
      },
      tx,
    );
    return after;
  });

  return toResponse(employee);
}