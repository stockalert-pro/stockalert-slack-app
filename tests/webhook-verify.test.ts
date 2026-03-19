import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from '../lib/webhook-verify';
import crypto from 'crypto';

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret';
  const payload = JSON.stringify({ test: 'data' });

  it('should return true for valid signature', () => {
    // Generate a valid signature
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const result = verifyWebhookSignature(payload, signature, secret);
    expect(result).toBe(true);
  });

  it('should return true for valid timestamped signature', () => {
    const timestamp = '2026-03-19T12:00:00.000Z';
    const signature =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');

    const result = verifyWebhookSignature(payload, signature, secret, timestamp);
    expect(result).toBe(true);
  });

  it('should support a legacy signature when a timestamp header is present', () => {
    const timestamp = '2026-03-19T12:00:00.000Z';
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const result = verifyWebhookSignature(payload, signature, secret, timestamp);
    expect(result).toBe(true);
  });

  it('should return false for invalid signature', () => {
    const invalidSignature = 'sha256=invalid';

    const result = verifyWebhookSignature(payload, invalidSignature, secret);
    expect(result).toBe(false);
  });

  it('should return true for signature without sha256= prefix', () => {
    const signatureWithoutPrefix = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const result = verifyWebhookSignature(payload, signatureWithoutPrefix, secret);
    expect(result).toBe(true); // Implementation handles both with and without prefix
  });

  it('should return false for different payload', () => {
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const differentPayload = JSON.stringify({ different: 'data' });

    const result = verifyWebhookSignature(differentPayload, signature, secret);
    expect(result).toBe(false);
  });

  it('should return false when timestamped signature is verified without the timestamp', () => {
    const timestamp = '2026-03-19T12:00:00.000Z';
    const signature =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');

    const result = verifyWebhookSignature(payload, signature, secret);
    expect(result).toBe(false);
  });

  it('should return false for empty signature', () => {
    const result = verifyWebhookSignature(payload, '', secret);
    expect(result).toBe(false);
  });

  it('should return false for null signature', () => {
    const result = verifyWebhookSignature(payload, null as any, secret);
    expect(result).toBe(false);
  });

  it('should return false for undefined signature', () => {
    const result = verifyWebhookSignature(payload, undefined as any, secret);
    expect(result).toBe(false);
  });

  it('should handle empty payload', () => {
    const emptyPayload = '';
    const signature =
      'sha256=' + crypto.createHmac('sha256', secret).update(emptyPayload).digest('hex');

    const result = verifyWebhookSignature(emptyPayload, signature, secret);
    expect(result).toBe(false); // Empty payload is considered invalid
  });

  it('should handle different secret lengths', () => {
    const longSecret = 'this-is-a-very-long-secret-key-that-should-still-work-correctly';
    const signature =
      'sha256=' + crypto.createHmac('sha256', longSecret).update(payload).digest('hex');

    const result = verifyWebhookSignature(payload, signature, longSecret);
    expect(result).toBe(true);
  });

  it('should be case sensitive for hex signature', () => {
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const upperCaseSignature = signature.toUpperCase();

    const result = verifyWebhookSignature(payload, upperCaseSignature, secret);
    expect(result).toBe(false);
  });

  it('should handle special characters in payload', () => {
    const specialPayload = '{"test": "special chars: 你好 🎉 \n\t"}';
    const signature =
      'sha256=' + crypto.createHmac('sha256', secret).update(specialPayload).digest('hex');

    const result = verifyWebhookSignature(specialPayload, signature, secret);
    expect(result).toBe(true);
  });

  it('should handle binary data in payload', () => {
    const binaryPayload = Buffer.from([0x00, 0x01, 0x02, 0xff]).toString();
    const signature =
      'sha256=' + crypto.createHmac('sha256', secret).update(binaryPayload).digest('hex');

    const result = verifyWebhookSignature(binaryPayload, signature, secret);
    expect(result).toBe(true);
  });

  it('should return false for wrong algorithm prefix', () => {
    const signature = 'sha1=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const result = verifyWebhookSignature(payload, signature, secret);
    expect(result).toBe(false);
  });

  it('should handle very large payloads', () => {
    const largePayload = 'x'.repeat(100000); // 100KB payload
    const signature =
      'sha256=' + crypto.createHmac('sha256', secret).update(largePayload).digest('hex');

    const result = verifyWebhookSignature(largePayload, signature, secret);
    expect(result).toBe(true);
  });
});
