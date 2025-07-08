import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const htmlPath = join(process.cwd(), 'public', 'slack-success.html');
    const html = readFileSync(htmlPath, 'utf-8');

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Success - StockAlert Slack App</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; text-align: center; padding: 50px; }
          .container { max-width: 600px; margin: 0 auto; }
          h1 { color: #1a8917; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Success!</h1>
          <p>StockAlert.pro has been successfully connected to your Slack workspace.</p>
          <p>You can close this window and return to Slack.</p>
        </div>
      </body>
      </html>
    `);
  }
}
