// Validate required environment variables at runtime
export function validateEnv() {
  const required = {
    // Slack credentials
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    // StockAlert credentials
    STOCKALERT_WEBHOOK_SECRET: process.env.STOCKALERT_WEBHOOK_SECRET,
    // Database (required for production)
    POSTGRES_URL: process.env.POSTGRES_URL,
  };

  const missing: string[] = [];
  
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file or Vercel environment settings.'
    );
  }

  // Optional but recommended
  const optional = {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN,
    KV_URL: process.env.KV_URL,
  };

  const notConfigured: string[] = [];
  
  for (const [key, value] of Object.entries(optional)) {
    if (!value) {
      notConfigured.push(key);
    }
  }

  if (notConfigured.length > 0) {
    console.warn(
      `Optional environment variables not configured: ${notConfigured.join(', ')}\n` +
      'Some features may be limited.'
    );
  }
}

// For endpoints that need specific variables
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}