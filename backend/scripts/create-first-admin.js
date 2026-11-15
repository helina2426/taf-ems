// Prepares an EMPTY production database for its first use:
// creates the Holding and the PRIMARY Holding user (the head of the organization).
// Everything else (companies, managers, employees, criteria, periods) is then done in the app.
//
//   node --env-file=.env scripts/create-first-admin.js "Taf Energies" head@tafenergies.example
//
// It prints a random TEMPORARY password once. The person must change it at first login.
// It refuses to run if the database already has a Holding (so it can never be run twice by mistake).
// (The demo data script, prisma/seed.js, refuses to run in production.)

import { randomBytes } from 'node:crypto';
import { recordAudit } from '../src/shared/auditLog.js';
import { hashPassword } from '../src/shared/password.js';
import prisma from '../src/config/prisma.js';

const [holdingName, rawEmail] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

if (!holdingName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node --env-file=.env scripts/create-first-admin.js "<Holding name>" <email>');
  process.exit(1);
}

if (await prisma.holding.findFirst()) {
  console.error('This database already has a Holding. Nothing was changed.');
  await prisma.$disconnect();
  process.exit(1);
}

// A random temporary password with letters and numbers (meets the password rules).
const temporaryPassword = `${randomBytes(9).toString('base64url')}7a`;

await prisma.$transaction(async (tx) => {
  const holding = await tx.holding.create({ data: { name: holdingName.trim() } });
  const user = await tx.user.create({
    data: {
      email,
      passwordHash: await hashPassword(temporaryPassword),
      role: 'HOLDING',
      isPrimaryHoldingUser: true,
      canApproveEvaluations: true,
      mustChangePassword: true,
    },
  });
  await recordAudit(
    { userId: null, action: 'FIRST_ADMIN_CREATED', entityType: 'User', entityId: user.id, details: { email, holdingId: holding.id } },
    tx,
  );
});

console.log(`\nCreated the Holding "${holdingName.trim()}" and its primary user ${email}.`);
console.log(`Temporary password (shown only now): ${temporaryPassword}`);
console.log('Give it to the person privately. They must change it at first login.\n');
await prisma.$disconnect();
