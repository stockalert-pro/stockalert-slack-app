// Type definitions for environment variables
export type RequiredEnvVars = {
  SLACK_CLIENT_ID: string;
  SLACK_CLIENT_SECRET: string;
  SLACK_SIGNING_SECRET: string;
  STOCKALERT_WEBHOOK_SECRET: string;
  POSTGRES_URL: string;
};

export type OptionalEnvVars = {
  SLACK_BOT_TOKEN?: string;
  SLACK_APP_TOKEN?: string;
  KV_URL?: string;
};

export type EnvVars = RequiredEnvVars & OptionalEnvVars;

// Validate required environment variables at runtime
export function validateEnv(): void {
  const required: Record<keyof RequiredEnvVars, string | undefined> = {
    // Slack credentials
    SLACK_CLIENT_ID: process.env['SLACK_CLIENT_ID'],
    SLACK_CLIENT_SECRET: process.env['SLACK_CLIENT_SECRET'],
    SLACK_SIGNING_SECRET: process.env['SLACK_SIGNING_SECRET'],
    // StockAlert credentials
    STOCKALERT_WEBHOOK_SECRET: process.env['STOCKALERT_WEBHOOK_SECRET'],
    // Database (required for production)
    POSTGRES_URL: process.env['POSTGRES_URL'],
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
  const optional: Record<keyof OptionalEnvVars, string | undefined> = {
    SLACK_BOT_TOKEN: process.env['SLACK_BOT_TOKEN'],
    SLACK_APP_TOKEN: process.env['SLACK_APP_TOKEN'],
    KV_URL: process.env['KV_URL'],
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

// Type-safe environment variable getter with validation
export function getEnv<K extends keyof EnvVars>(key: K): EnvVars[K] {
  const value = process.env[key];

  // Check if it's a required variable
  const requiredKeys: (keyof RequiredEnvVars)[] = [
    'SLACK_CLIENT_ID',
    'SLACK_CLIENT_SECRET',
    'SLACK_SIGNING_SECRET',
    'STOCKALERT_WEBHOOK_SECRET',
    'POSTGRES_URL',
  ];

  if (requiredKeys.includes(key as keyof RequiredEnvVars) && !value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }

  return value as EnvVars[K];
}

// Check if all required environment variables are set
export function hasRequiredEnvVars(): boolean {
  const requiredKeys: (keyof RequiredEnvVars)[] = [
    'SLACK_CLIENT_ID',
    'SLACK_CLIENT_SECRET',
    'SLACK_SIGNING_SECRET',
    'STOCKALERT_WEBHOOK_SECRET',
    'POSTGRES_URL',
  ];

  return requiredKeys.every((key) => Boolean(process.env[key]));
}
