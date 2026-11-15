// Reads the app's settings from environment variables (loaded from .env)
// and checks them once, when the app starts.
// Every other file imports settings from here instead of reading process.env directly.

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',

  // Security settings (Phase 7).
  // Which websites may call this API from a browser (comma-separated). 5173 = the React app (Vite).
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // How many API requests one computer (IP address) may make per 15 minutes.
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 1000),
  // How many FAILED logins are allowed for one email from one computer per 15 minutes.
  loginMaxFailures: Number(process.env.LOGIN_MAX_FAILURES ?? 5),

  // Deployment settings (Phase 12).
  // true = this backend also serves the built React app (frontend/dist), so the whole
  // system runs as ONE program on ONE address. In development we use Vite instead.
  serveFrontend: process.env.SERVE_FRONTEND === 'true',
  frontendDist: process.env.FRONTEND_DIST ?? '../frontend/dist',
  // How many proxies (for example nginx) sit in front of the backend. 0 = none.
  // Needed so the rate limits see each visitor's real address, not the proxy's.
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
};

// Stop immediately with a clear message if a setting is wrong or missing,
// instead of failing later in a confusing way.
if (Number.isNaN(env.port)) {
  throw new Error('PORT in .env must be a number, for example PORT=4000');
}

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is missing. Add it to backend/.env (see .env.example).');
}

// A short or example secret would make login tokens easy to fake.
if (!env.jwtSecret || env.jwtSecret.length < 32 || env.jwtSecret.startsWith('CHANGE_ME')) {
  throw new Error('JWT_SECRET in .env must be a long random string (at least 32 characters). See .env.example.');
}

if (!Number.isInteger(env.rateLimitMax) || env.rateLimitMax < 1) {
  throw new Error('RATE_LIMIT_MAX in .env must be a whole number of 1 or more, for example RATE_LIMIT_MAX=1000');
}

if (!Number.isInteger(env.loginMaxFailures) || env.loginMaxFailures < 1) {
  throw new Error('LOGIN_MAX_FAILURES in .env must be a whole number of 1 or more, for example LOGIN_MAX_FAILURES=5');
}

if (!Number.isInteger(env.trustProxy) || env.trustProxy < 0) {
  throw new Error('TRUST_PROXY in .env must be 0 or a positive whole number, for example TRUST_PROXY=1');
}

// Extra checks for production: mistakes here would be unsafe on a real server.
if (env.nodeEnv === 'production') {
  if (env.jwtSecret.length < 48) {
    throw new Error('In production, JWT_SECRET must be at least 48 characters long.');
  }
  if (!env.serveFrontend && env.corsOrigins.some((origin) => origin.includes('localhost'))) {
    console.warn('Warning: CORS_ORIGINS still allows localhost. Set it to the real address of the frontend.');
  }
}

export default env;
