import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Serve the landing page HTML
    const htmlPath = join(process.cwd(), 'public', 'index.html');
    const html = readFileSync(htmlPath, 'utf-8');

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch {
    // Fallback if file reading fails
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>StockAlert Slack App</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <h1>StockAlert Slack App</h1>
        <p>Welcome! Click below to add StockAlert to your Slack workspace:</p>
        <a href="/api/slack/install">
          <img alt="Add to Slack" height="40" width="139" 
               src="https://platform.slack-edge.com/img/add_to_slack.png" 
               srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" />
        </a>
      </body>
      </html>
    `);
  }
}
