import { describe, expect, it } from 'vitest';
import { formatWebhookData, getAlertLabels } from '../lib/webhook-formatter';
import { AlertEventSchema } from '../lib/types';

describe('webhook-formatter', () => {
  it('formats missing stock data as N/A instead of NaN strings', () => {
    const event = AlertEventSchema.parse({
      event: 'alert.triggered',
      timestamp: '2024-01-15T10:30:00Z',
      data: {
        alert: {
          id: 'alert_789',
          symbol: 'AAPL',
          condition: 'price_above',
          threshold: 180,
        },
        triggered_at: '2024-01-15T10:30:00Z',
      },
    });

    const formatted = formatWebhookData(event);

    expect(formatted.currentValue).toBeNaN();
    expect(formatted.thresholdFormatted).toBe('$180.00');
    expect(formatted.currentValueFormatted).toBe('N/A');
    expect(formatted.changeText).toBeUndefined();
  });

  it('keeps label metadata stable for price alerts', () => {
    expect(getAlertLabels('price_above')).toEqual({
      targetLabel: 'Target Price',
      currentLabel: 'Current Price',
      showStockPrice: false,
    });
  });
});
