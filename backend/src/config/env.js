// Reads the app's settings from environment variables (loaded from .env)
// and checks them once, when the app starts.
// Every other file imports settings from here instead of reading process.env directly.

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
};

// Stop immediately with a clear message if a setting is wrong,
// instead of failing later in a confusing way.
if (Number.isNaN(env.port)) {
  throw new Error('PORT in .env must be a number, for example PORT=4000');
}

export default env;