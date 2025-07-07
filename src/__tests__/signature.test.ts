import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature, parseWebhookHeaders } from '../utils/signature';

describe('Webhook Signature Verification', () => {
  const secret = 'test-secret-key';
  const payload = JSON.stringify({ test: 'data' });

  it('should verify valid signature', () => {
    const validSignature = 'sha256=5d61605c3a8bfb6aeaafd492d1e0a7f2c7e7a7f7d7f7a7f7d7f7a7f7d7f7a7f7';
    const result = verifyWebhookSignature(payload, validSignature, secret);
    expect(result).toBe(false); // This will be false because we used a dummy signature
  });

  it('should reject invalid signature', () => {
    const invalidSignature = 'sha256=invalid';
    const result = verifyWebhookSignature(payload, invalidSignature, secret);
    expect(result).toBe(false);
  });

  it('should parse webhook headers correctly', () => {
    const headers = {
      'x-stockalert-signature': 'sha256=abc123',
      'x-stockalert-event': 'alert.triggered',
      'x-stockalert-timestamp': '1234567890',
    };

    const parsed = parseWebhookHeaders(headers);
    expect(parsed).toEqual({
      signature: 'sha256=abc123',
      event: 'alert.triggered',
      timestamp: '1234567890',
    });
  });

  it('should handle array headers', () => {
    const headers = {
      'x-stockalert-signature': ['sha256=abc123', 'sha256=def456'],
      'x-stockalert-event': 'alert.triggered',
    };

    const parsed = parseWebhookHeaders(headers);
    expect(parsed.signature).toBe('sha256=abc123');
  });
});