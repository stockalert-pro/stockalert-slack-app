import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const htmlPath = join(process.cwd(), 'public', 'slack-error.html');
    const html = readFileSync(htmlPath, 'utf-8');

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - StockAlert Slack App</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; text-align: center; padding: 50px; }
          .container { max-width: 600px; margin: 0 auto; }
          h1 { color: #d32f2f; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Installation Error</h1>
          <p>There was an error connecting StockAlert.pro to your Slack workspace.</p>
          <p>Please try again or contact support if the problem persists.</p>
        </div>
      </body>
      </html>
    `);
  }
}
