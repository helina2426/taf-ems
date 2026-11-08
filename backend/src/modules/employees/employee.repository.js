// Database access for employees. An "employee" here is an Employee profile whose
// login account (User) has role EMPLOYEE. Managers' profiles are handled by the manager module.
// Functions accept an optional "db" so they can run inside a transaction.

import prisma from '../../config/prisma.js';

const employeeInclude = {
  user: true,
  company: true,
};

function buildWhere({ search, employmentStatus, department, companyId }) {
  return {
    user: { role: 'EMPLOYEE' },
    ...(companyId && { companyId }),
    ...(employmentStatus && { employmentStatus }),
    ...(department && { department: { equals: department, mode: 'insensitive' } }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeNumber: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };
}

export async function findMany(filters, { skip, take }) {
  const where = buildWhere(filters);
  const [items, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take,
    }),
    prisma.employee.count({ where }),
  ]);
  return { items, total };
}

export function findById(id, db = prisma) {
  return db.employee.findFirst({ where: { id, user: { role: 'EMPLOYEE' } }, include: employeeInclude });
}

export function findByUserId(userId, db = prisma) {
  return db.employee.findUnique({ where: { userId }, include: employeeInclude });
}

export function findCompanyById(id, db = prisma) {
  return db.company.findUnique({ where: { id } });
}

export function findUserByEmail(email, excludeUserId, db = prisma) {
  return db.user.findFirst({ where: { email, ...(excludeUserId && { NOT: { id: excludeUserId } }) } });
}

export function findEmployeeNumberInCompany(companyId, employeeNumber, excludeEmployeeId, db = prisma) {
  return db.employee.findFirst({
    where: { companyId, employeeNumber, ...(excludeEmployeeId && { NOT: { id: excludeEmployeeId } }) },
  });
}

export function createUser({ email, passwordHash }, db = prisma) {
  return db.user.create({ data: { email, passwordHash, role: 'EMPLOYEE', mustChangePassword: true } });
}

export function createEmployee(data, db = prisma) {
  return db.employee.create({ data, include: employeeInclude });
}

export function updateEmployee(id, data, db = prisma) {
  return db.employee.update({ where: { id }, data, include: employeeInclude });
}

export function updateUser(id, data, db = prisma) {
  return db.user.update({ where: { id }, data });
}

// Dates are sent as "YYYY-MM-DD" (no time), which is easier to read.
function toDateOnly(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

// Turns a database employee into the object the API sends back. Never includes the password.
export function toEmployeeResponse(employee) {
  return {
    id: employee.id,
    userId: employee.userId,
    email: employee.user.email,
    accountActive: employee.user.isActive,
    mustChangePassword: employee.user.mustChangePassword,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    jobTitle: employee.jobTitle,
    department: employee.department,
    phone: employee.phone,
    address: employee.address,
    emergencyContact: employee.emergencyContact,
    hireDate: toDateOnly(employee.hireDate),
    employmentStatus: employee.employmentStatus,
    company: { id: employee.company.id, name: employee.company.name, code: employee.company.code },
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}