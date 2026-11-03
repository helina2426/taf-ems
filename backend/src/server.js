// The starting point of the backend.
// Imports the app and the settings, then starts listening for requests.

import app from './app.js';
import env from './config/env.js';

app.listen(env.port, () => {
  console.log(`Taf EMS backend running on http://localhost:${env.port} (${env.nodeEnv})`);
});