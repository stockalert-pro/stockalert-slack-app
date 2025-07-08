import { describe, it, expect, vi } from 'vitest';
import { setSecurityHeaders } from '../lib/security-headers';
import type { VercelResponse } from '@vercel/node';

describe('Security Headers', () => {
  const createMockResponse = (): Partial<VercelResponse> & { headers: Record<string, string> } => {
    const headers: Record<string, string> = {};
    return {
      headers,
      setHeader: vi.fn((name: string, value: string) => {
        headers[name] = value;
      }) as any,
    };
  };

  it('should set all required security headers', () => {
    const res = createMockResponse();

    setSecurityHeaders(res as VercelResponse);

    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['X-Frame-Options']).toBe('DENY');
    expect(res.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    expect(res.headers['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains; preload'
    );
    expect(res.headers['Content-Security-Policy']).toBeDefined();
  });

  it('should set default Content-Security-Policy', () => {
    const res = createMockResponse();

    setSecurityHeaders(res as VercelResponse);

    const csp = res.headers['Content-Security-Policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: https:");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('should use custom CSP when provided', () => {
    const res = createMockResponse();
    const customCsp = "default-src 'none'; script-src 'self'; style-src 'self';";

    setSecurityHeaders(res as VercelResponse, { csp: customCsp });

    expect(res.headers['Content-Security-Policy']).toBe(customCsp);
  });

  it('should not set CORS headers by default', () => {
    const res = createMockResponse();

    setSecurityHeaders(res as VercelResponse);

    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(res.headers['Access-Control-Allow-Methods']).toBeUndefined();
    expect(res.headers['Access-Control-Allow-Headers']).toBeUndefined();
  });

  it('should set CORS headers when cors option is true', () => {
    const res = createMockResponse();

    setSecurityHeaders(res as VercelResponse, { cors: true });

    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://slack.com');
    expect(res.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(res.headers['Access-Control-Allow-Headers']).toBe(
      'Content-Type, X-Slack-Signature, X-Slack-Request-Timestamp'
    );
    expect(res.headers['Access-Control-Max-Age']).toBe('86400');
    expect(res.headers['Access-Control-Allow-Credentials']).toBe('false');
  });

  it('should call setHeader for each header', () => {
    const res = createMockResponse();

    setSecurityHeaders(res as VercelResponse);

    expect(res.setHeader).toHaveBeenCalledTimes(6); // 6 security headers by default
  });

  it('should call setHeader with CORS headers when enabled', () => {
    const res = createMockResponse();

    setSecurityHeaders(res as VercelResponse, { cors: true });

    expect(res.setHeader).toHaveBeenCalledTimes(11); // 6 security + 5 CORS headers
  });

  it('should handle empty options object', () => {
    const res = createMockResponse();

    setSecurityHeaders(res as VercelResponse, {});

    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('should not override existing headers', () => {
    const res = createMockResponse();
    res.headers['X-Custom-Header'] = 'custom-value';

    setSecurityHeaders(res as VercelResponse);

    expect(res.headers['X-Custom-Header']).toBe('custom-value');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
