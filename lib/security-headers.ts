import type { VercelResponse } from '@vercel/node';

export interface SecurityHeaderOptions {
  cors?: boolean;
  csp?: string;
}

/**
 * Sets security headers on the response
 * @param res - Vercel response object
 * @param options - Security header options
 */
export function setSecurityHeaders(res: VercelResponse, options: SecurityHeaderOptions = {}): void {
  // Essential security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Content Security Policy
  const defaultCsp =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';";
  res.setHeader('Content-Security-Policy', options.csp || defaultCsp);

  // CORS headers for Slack
  if (options.cors) {
    // Only allow Slack domains
    res.setHeader('Access-Control-Allow-Origin', 'https://slack.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-Slack-Signature, X-Slack-Request-Timestamp'
    );
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.setHeader('Access-Control-Allow-Credentials', 'false');
  }
}
