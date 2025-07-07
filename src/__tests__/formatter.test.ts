import { describe, it, expect } from 'vitest';
import { formatAlertMessage, formatErrorMessage } from '../utils/formatter';
import { AlertEvent } from '../types';

describe('Message Formatter', () => {
  const mockAlertEvent: AlertEvent = {
    id: 'evt_123',
    type: 'alert.triggered',
    created_at: '2024-01-01T12:00:00Z',
    data: {
      alert: {
        id: 'alert_456',
        symbol: 'AAPL',
        company_name: 'Apple Inc.',
        condition: 'price_above',
        threshold: 200,
        triggered_value: 205.50,
        triggered_at: '2024-01-01T12:00:00Z',
        is_active: true,
        notification_channel: 'email',
      },
    },
  };

  it('should format alert message correctly', () => {
    const result = formatAlertMessage(mockAlertEvent);

    expect(result.text).toContain('AAPL Alert');
    expect(result.text).toContain('Apple Inc.');
    expect(result.blocks).toHaveLength(6); // header, section, timestamp, actions, divider

    const headerBlock = result.blocks[0] as any;
    expect(headerBlock.type).toBe('header');
    expect(headerBlock.text.text).toContain('AAPL Alert Triggered');

    const sectionBlock = result.blocks[1] as any;
    expect(sectionBlock.type).toBe('section');
    expect(sectionBlock.fields[0].text).toContain('$200.00');
    expect(sectionBlock.fields[1].text).toContain('$205.50');
  });

  it('should handle missing triggered value', () => {
    const eventWithoutValue = {
      ...mockAlertEvent,
      data: {
        alert: {
          ...mockAlertEvent.data.alert,
          triggered_value: undefined,
        },
      },
    };

    const result = formatAlertMessage(eventWithoutValue);
    const sectionBlock = result.blocks[1] as any;
    expect(sectionBlock.fields[1].text).toContain('N/A');
  });

  it('should format error message', () => {
    const error = new Error('Test error message');
    const result = formatErrorMessage(error);

    expect(result.text).toBe('❌ Error: Test error message');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toHaveProperty('type', 'section');
  });

  it('should include parameters in context', () => {
    const eventWithParams = {
      ...mockAlertEvent,
      data: {
        alert: {
          ...mockAlertEvent.data.alert,
          parameters: {
            period: 14,
            ma_type: 'SMA',
          },
        },
      },
    };

    const result = formatAlertMessage(eventWithParams);
    const contextBlock = result.blocks.find((b: any) => 
      b.type === 'context' && b.elements.some((e: any) => e.text?.includes('Period'))
    ) as any;

    expect(contextBlock).toBeDefined();
    expect(contextBlock.elements[0].text).toContain('Period: 14');
  });
});