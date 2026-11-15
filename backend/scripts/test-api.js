// Runs the whole Postman collection against a FRESH test database, automatically.
//
//   npm run test:api
//
// Steps:
//   1. Read the settings from .env.test (and refuse to continue unless the database name ends in "_test").
//   2. Wipe the test database and rebuild it from our migrations (prisma migrate reset).
//   3. Fill it with the demo data (prisma/seed.js).
//   4. Start the backend on the test port (4001) and wait until /api/health answers.
//   5. Run the Postman collection with Newman (Postman's command-line runner).
//   6. Stop the backend. The exit code is 0 only if every check passed.
//
// Your normal database (taf_ems_dev) and your normal server (port 4000) are never touched.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const ENV_FILE = '.env.test';
const COLLECTION = 'postman/taf-ems.postman_collection.json';
const ENVIRONMENT = 'postman/taf-ems.postman_environment.json';
const NEWMAN = 'newman@6.2.3'; // run with npx, so it is not added to the project's packages

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// Runs a command and resolves with its exit code. Output is shown in this terminal.
function run(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function waitForHealth(url, seconds = 20) {
  for (let i = 0; i < seconds * 2; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ---------- 1. Settings and safety check ----------

if (!existsSync(ENV_FILE)) fail(`${ENV_FILE} is missing. Copy .env.test.example to ${ENV_FILE} and fill it in.`);
process.loadEnvFile(ENV_FILE);

const databaseName = new URL(process.env.DATABASE_URL).pathname.slice(1);
if (!databaseName.endsWith('_test')) {
  fail(`Refusing to run: the database "${databaseName}" does not end in "_test". The tests wipe the database they use.`);
}
const port = process.env.PORT;
const env = { ...process.env }; // the test settings, passed to every command below

// ---------- 2 + 3. Fresh database with demo data ----------

console.log(`\n▶ Resetting the test database "${databaseName}"…`);
if ((await run('npx', ['prisma', 'migrate', 'reset', '--force'], env)) !== 0) fail('Could not reset the test database.');

console.log('\n▶ Loading the demo data…');
if ((await run('node', ['prisma/seed.js'], env)) !== 0) fail('Could not load the demo data.');

// ---------- 4. Start the backend on the test port ----------

console.log(`\n▶ Starting the backend on port ${port}…`);
const server = spawn('node', ['src/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => (serverOutput += chunk));
server.stderr.on('data', (chunk) => (serverOutput += chunk));

const stopServer = () => server.exitCode === null && server.kill();
process.on('exit', stopServer);

if (!(await waitForHealth(`http://localhost:${port}/api/health`))) {
  console.error(serverOutput);
  fail(`The backend did not start on port ${port}. Is something else using that port?`);
}

// ---------- 5. Run the collection ----------

console.log('\n▶ Running the Postman collection…\n');
const code = await run(
  'npx',
  ['--yes', NEWMAN, 'run', COLLECTION, '-e', ENVIRONMENT, '--env-var', `baseUrl=http://localhost:${port}/api`],
  env,
);

// ---------- 6. Stop and report ----------

stopServer();
console.log(code === 0 ? '\n✔ All API checks passed.\n' : '\n✖ Some API checks failed (see the list above).\n');
process.exit(code);
