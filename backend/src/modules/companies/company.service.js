// The business rules for companies.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import { buildPagination, toSkipTake } from '../../shared/validation.js';
import * as companyRepository from './company.repository.js';

const toResponse = companyRepository.toCompanyResponse;

export async function listCompanies(query) {
  const { items, total } = await companyRepository.findMany(query, toSkipTake(query));
  return { items: items.map(toResponse), pagination: buildPagination(query, total) };
}

export async function getCompany(id, user) {
  // Company wall: a Manager may only open the company they are assigned to.
  if (user.role === 'MANAGER' && user.companyId !== id) {
    throw AppError.forbidden('You can only view your own company.');
  }

  const company = await companyRepository.findById(id);
  if (!company) {
    throw AppError.notFound('Company not found.');
  }
  return toResponse(company);
}

async function ensureNameAndCodeAreFree({ name, code }, excludeId, db) {
  if (!name && !code) return;

  const existing = await companyRepository.findByNameOrCode({ name, code }, excludeId, db);
  if (existing) {
    const field = code && existing.code === code ? 'code' : 'name';
    throw AppError.conflict(`Another company already uses this ${field}.`);
  }
}

export async function createCompany(data, user) {
  // A transaction: the company and its audit entry are saved together, or not at all.
  const company = await prisma.$transaction(async (tx) => {
    await ensureNameAndCodeAreFree(data, null, tx);

    const holding = await companyRepository.findTheHolding(tx);
    if (!holding) {
      throw new Error('No Holding exists in the database. Run the seed script first.');
    }

    const created = await companyRepository.create({ ...data, holdingId: holding.id }, tx);

    await recordAudit(
      { userId: user.id, action: 'COMPANY_CREATED', entityType: 'Company', entityId: created.id, details: data },
      tx,
    );
    return created;
  });

  return toResponse(company);
}

export async function updateCompany(id, data, user) {
  const company = await prisma.$transaction(async (tx) => {
    const before = await companyRepository.findById(id, tx);
    if (!before) {
      throw AppError.notFound('Company not found.');
    }

    await ensureNameAndCodeAreFree(data, id, tx);
    const updated = await companyRepository.update(id, data, tx);

    // Record exactly what changed: the old and new value of each field.
    const changes = Object.fromEntries(
      Object.keys(data)
        .filter((field) => before[field] !== updated[field])
        .map((field) => [field, { from: before[field], to: updated[field] }]),
    );

    await recordAudit(
      { userId: user.id, action: 'COMPANY_UPDATED', entityType: 'Company', entityId: id, details: changes },
      tx,
    );
    return updated;
  });

  return toResponse(company);
}

export async function setCompanyStatus(id, { isActive }, user) {
  const company = await prisma.$transaction(async (tx) => {
    const before = await companyRepository.findById(id, tx);
    if (!before) {
      throw AppError.notFound('Company not found.');
    }
    if (before.isActive === isActive) {
      throw AppError.conflict(`The company is already ${isActive ? 'active' : 'inactive'}.`);
    }

    const updated = await companyRepository.update(id, { isActive }, tx);

    await recordAudit(
      {
        userId: user.id,
        action: isActive ? 'COMPANY_ACTIVATED' : 'COMPANY_DEACTIVATED',
        entityType: 'Company',
        entityId: id,
      },
      tx,
    );
    return updated;
  });

  return toResponse(company);
}