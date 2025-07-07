import crypto from 'crypto';

/**
 * Verify webhook signature from StockAlert.pro
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}

/**
 * Parse webhook headers
 */
export interface WebhookHeaders {
  signature?: string;
  event?: string;
  timestamp?: string;
}

export function parseWebhookHeaders(headers: Record<string, string | string[] | undefined>): WebhookHeaders {
  return {
    signature: getHeaderValue(headers['x-stockalert-signature']),
    event: getHeaderValue(headers['x-stockalert-event']),
    timestamp: getHeaderValue(headers['x-stockalert-timestamp']),
  };
}

function getHeaderValue(header: string | string[] | undefined): string | undefined {
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
}