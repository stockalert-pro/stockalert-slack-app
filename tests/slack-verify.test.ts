import { describe, it, expect } from 'vitest';
import { verifySlackSignature, verifySlackRequest } from '../lib/slack-verify';
import crypto from 'crypto';
import { type VercelRequest } from '@vercel/node';

describe('verifySlackSignature', () => {
  const signingSecret = 'test-signing-secret';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({ test: 'data' });

  it('should return true for valid signature', () => {
    // Generate a valid signature
    const sigBasestring = `v0:${timestamp}:${body}`;
    const mySignature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const result = verifySlackSignature(signingSecret, mySignature, timestamp, body);

    expect(result).toBe(true);
  });

  it('should return false for invalid signature', () => {
    const result = verifySlackSignature(signingSecret, 'v0=invalid', timestamp, body);

    expect(result).toBe(false);
  });

  it('should return false for old timestamp', () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes old
    const sigBasestring = `v0:${oldTimestamp}:${body}`;
    const mySignature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const result = verifySlackSignature(signingSecret, mySignature, oldTimestamp, body);

    expect(result).toBe(false);
  });

  it('should return false for missing parameters', () => {
    const result = verifySlackSignature(
      signingSecret,
      '', // empty signature
      timestamp,
      body
    );

    expect(result).toBe(false);
  });

  it('should return false for null signature', () => {
    const result = verifySlackSignature(signingSecret, null as any, timestamp, body);

    expect(result).toBe(false);
  });

  it('should return false for undefined timestamp', () => {
    const sigBasestring = `v0:${timestamp}:${body}`;
    const mySignature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const result = verifySlackSignature(signingSecret, mySignature, undefined as any, body);

    expect(result).toBe(false);
  });

  it('should handle different body types', () => {
    const plainTextBody = 'plain text body';
    const sigBasestring = `v0:${timestamp}:${plainTextBody}`;
    const mySignature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const result = verifySlackSignature(signingSecret, mySignature, timestamp, plainTextBody);

    expect(result).toBe(true);
  });

  it('should be case sensitive for signature', () => {
    const sigBasestring = `v0:${timestamp}:${body}`;
    const mySignature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const result = verifySlackSignature(
      signingSecret,
      mySignature.toUpperCase(), // Change case
      timestamp,
      body
    );

    expect(result).toBe(false);
  });
});

describe('verifySlackRequest', () => {
  const signingSecret = 'test-signing-secret';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({ test: 'data' });

  const createMockRequest = (
    headers: Record<string, string>,
    body: string
  ): Partial<VercelRequest> => ({
    headers,
    body,
  });

  it('should verify valid request', async () => {
    const sigBasestring = `v0:${timestamp}:${body}`;
    const signature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const req = createMockRequest(
      {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp,
      },
      body
    );

    const result = await verifySlackRequest(req as VercelRequest, signingSecret);
    expect(result).toBe(true);
  });

  it('should reject request with missing signature header', async () => {
    const req = createMockRequest(
      {
        'x-slack-request-timestamp': timestamp,
      },
      body
    );

    const result = await verifySlackRequest(req as VercelRequest, signingSecret);
    expect(result).toBe(false);
  });

  it('should reject request with missing timestamp header', async () => {
    const sigBasestring = `v0:${timestamp}:${body}`;
    const signature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const req = createMockRequest(
      {
        'x-slack-signature': signature,
      },
      body
    );

    const result = await verifySlackRequest(req as VercelRequest, signingSecret);
    expect(result).toBe(false);
  });

  it('should handle form URL encoded body', async () => {
    const formBody = 'token=test&team_id=T123&text=hello';
    const sigBasestring = `v0:${timestamp}:${formBody}`;
    const signature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const req = createMockRequest(
      {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp,
        'content-type': 'application/x-www-form-urlencoded',
      },
      formBody
    );

    const result = await verifySlackRequest(req as VercelRequest, signingSecret);
    expect(result).toBe(true);
  });

  it('should handle JSON body', async () => {
    const jsonBody = JSON.stringify({ command: '/test', text: 'hello' });
    const sigBasestring = `v0:${timestamp}:${jsonBody}`;
    const signature =
      'v0=' +
      crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

    const req = createMockRequest(
      {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp,
        'content-type': 'application/json',
      },
      jsonBody
    );

    const result = await verifySlackRequest(req as VercelRequest, signingSecret);
    expect(result).toBe(true);
  });
});
