// The starting point of the backend.
// Imports the app and the settings, then starts listening for requests.

import app from './app.js';
import env from './config/env.js';
import prisma from './config/prisma.js';

const server = app.listen(env.port, (error) => {
  if (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use. Is the backend already running in another terminal?`);
    } else {
      console.error('The backend could not start:', error.message);
    }
    process.exit(1);
  }
  console.log(`Taf EMS backend running on http://localhost:${env.port} (${env.nodeEnv})`);
  if (env.serveFrontend) console.log('Also serving the React app from', env.frontendDist);
});

// Graceful shutdown (Phase 12): when the server is asked to stop (Ctrl+C, or a server manager
// restarting it), finish the requests in progress and close the database connections cleanly.
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`\n${signal} received: stopping…`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Stopped.');
    process.exit(0);
  });
  // If something hangs, stop anyway after 10 seconds.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
