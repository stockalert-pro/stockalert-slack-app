import { App, ExpressReceiver } from '@slack/bolt';
import express from 'express';
import { loadConfig } from './utils/config';
import { WebhookHandler } from './handlers/webhook';
import { CommandHandler } from './handlers/commands';

async function start() {
  try {
    // Load configuration
    const config = loadConfig();
    console.log('Configuration loaded');

    // Create Express receiver for custom routes
    const receiver = new ExpressReceiver({
      signingSecret: config.slack.signingSecret,
    });

    // Create Slack app
    const app = new App({
      token: config.slack.botToken,
      receiver,
      socketMode: true,
      appToken: config.slack.appToken,
    });

    // Initialize handlers
    const webhookHandler = new WebhookHandler(app, config);
    const commandHandler = new CommandHandler(app, config, webhookHandler);

    // Add webhook endpoint
    receiver.router.use(express.raw({ type: 'application/json' }));
    receiver.router.post('/webhooks/stockalert', (req, res) => {
      webhookHandler.handleWebhook(req, res);
    });

    // Health check endpoint
    receiver.router.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.server.environment,
      });
    });

    // Start the app
    await app.start(config.server.port);
    console.log(`⚡️ StockAlert Slack app is running on port ${config.server.port}!`);
    console.log(`🔗 Webhook endpoint: http://localhost:${config.server.port}/webhooks/stockalert`);

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await app.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      await app.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start app:', error);
    process.exit(1);
  }
}

// Start the app
start();