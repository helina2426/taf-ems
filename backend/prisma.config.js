// Prisma's settings file: where the schema and migrations are, and how to reach the database.
// Prisma 7 does not read .env by itself, so we load it here with Node's built-in loader
// (no extra library needed). On a real server there is no .env file, because settings come
// from the server itself, so we only load the file if it exists.

import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});