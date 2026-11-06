// The starting point of the backend.
// Imports the app and the settings, then starts listening for requests.

import app from './app.js';
import env from './config/env.js';

app.listen(env.port, (error) => {
  // Express calls this function with an error if the server could NOT start,
  // for example when another program is already using the port.
  if (error) {
    console.error(`Could not start the server on port ${env.port}: ${error.message}`);

    if (error.code === 'EADDRINUSE') {
      console.error('Another program (maybe another copy of this server) is already using this port.');
    }

    process.exit(1); // stop with an error code, so the problem is obvious
  }

  console.log(`Taf EMS backend running on http://localhost:${env.port} (${env.nodeEnv})`);
});