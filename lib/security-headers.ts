import { VercelResponse } from '@vercel/node';

export function setSecurityHeaders(res: VercelResponse, options: { cors?: boolean } = {}) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // CORS headers for Slack
  if (options.cors) {
    res.setHeader('Access-Control-Allow-Origin', 'https://slack.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Slack-Signature, X-Slack-Request-Timestamp');
  }
}