import { Config } from '../types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export function loadConfig(): Config {
  const requiredEnvVars = [
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'SLACK_APP_TOKEN',
    'STOCKALERT_WEBHOOK_SECRET',
  ];

  // Check required environment variables
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      appToken: process.env.SLACK_APP_TOKEN!,
      defaultChannel: process.env.DEFAULT_CHANNEL,
    },
    stockalert: {
      webhookSecret: process.env.STOCKALERT_WEBHOOK_SECRET!,
    },
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
    },
  };
}