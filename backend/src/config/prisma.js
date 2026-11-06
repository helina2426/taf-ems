// Creates ONE shared Prisma Client for the whole backend.
// Every repository imports this same object, so the app keeps a single pool of
// database connections instead of opening new ones everywhere.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import env from './env.js';

// The adapter is the piece that actually connects to PostgreSQL.
const adapter = new PrismaPg({ connectionString: env.databaseUrl });

const prisma = new PrismaClient({ adapter });

export default prisma;