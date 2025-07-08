import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { startMetricsCollection, requestMonitoring } from './lib/monitoring';

// Import API handlers
import healthHandler from './api/health';
import slackCommandsHandler from './api/slack/commands';
import slackInstallHandler from './api/slack/install';
import slackInteractivityHandler from './api/slack/interactivity';
import slackOAuthHandler from './api/slack/oauth';
import webhookHandler from './api/webhooks/[teamId]/stockalert';

const app = express();
const port = process.env.PORT || 3000;

// Trust proxy for proper IP handling
app.set('trust proxy', true);

// Add request monitoring middleware
app.use(requestMonitoring());

// Parse JSON bodies
app.use(
  express.json({
    verify: (req, _, buf) => {
      // Store raw body for Slack signature verification
      (req as any).rawBody = buf.toString('utf8');
    },
  })
);

// Parse URL-encoded bodies (for Slack slash commands)
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, _, buf) => {
      // Store raw body for Slack signature verification
      (req as any).rawBody = buf.toString('utf8');
    },
  })
);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Convert Express handlers to Vercel-compatible format
const wrapHandler = (handler: any) => {
  return async (req: express.Request, res: express.Response) => {
    const vercelReq = {
      ...req,
      query: req.query,
      cookies: req.cookies || {},
      body: req.body,
      headers: req.headers,
      method: req.method,
      url: req.url,
    };

    const vercelRes = {
      status: (code: number) => {
        res.status(code);
        return vercelRes;
      },
      json: (data: any) => res.json(data),
      send: (data: any) => res.send(data),
      setHeader: (name: string, value: string) => res.setHeader(name, value),
      end: () => res.end(),
      redirect: (url: string) => res.redirect(url),
    };

    try {
      await handler(vercelReq, vercelRes);
    } catch (error) {
      console.error('Handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// API Routes
app.get('/api/health', wrapHandler(healthHandler));
app.post('/api/slack/commands', wrapHandler(slackCommandsHandler));
app.get('/api/slack/install', wrapHandler(slackInstallHandler));
app.post('/api/slack/interactivity', wrapHandler(slackInteractivityHandler));
app.get('/api/slack/oauth', wrapHandler(slackOAuthHandler));

// Dynamic webhook route
app.post('/api/webhooks/:teamId/stockalert', (req, res) => {
  (req as any).query = { teamId: req.params.teamId };
  wrapHandler(webhookHandler)(req, res);
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server
const server = createServer(app);

// Start metrics collection
const metricsInterval = startMetricsCollection(60000); // Collect every minute

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down gracefully...');

  // Stop metrics collection
  clearInterval(metricsInterval);

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/api/health`);
  console.log(`Detailed health check: http://localhost:${port}/api/health?detailed=true`);
  console.log('Performance monitoring enabled');
});
