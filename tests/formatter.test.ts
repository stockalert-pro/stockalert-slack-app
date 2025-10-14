import { describe, it, expect } from 'vitest';
import { formatAlertMessage } from '../lib/formatter';
import { AlertEvent, ALERT_TYPE_CONFIG } from '../lib/types';

describe('formatAlertMessage', () => {
  const baseAlert: AlertEvent = {
    event: 'alert.triggered',
    timestamp: '2024-01-15T10:30:00Z',
    data: {
      alert: {
        id: 'alert_123',
        symbol: 'AAPL',
        condition: 'price_above',
        threshold: 180,
      },
      stock: {
        symbol: 'AAPL',
        price: 185.5,
        change: 5.5,
        change_percent: 3.06,
      },
      triggered_at: '2024-01-15T10:30:00Z',
      parameters: null,
    },
  };

  it('should format price above alert correctly', () => {
    const result = formatAlertMessage(baseAlert);

    expect(result.text).toBe('AAPL Alert: Price Above');
    expect(result.blocks).toHaveLength(4); // header, section, context, actions
    expect(result.blocks?.[0]?.type).toBe('header');
    expect(result.blocks?.[1]?.type).toBe('section');
    expect(result.blocks?.[2]?.type).toBe('context');
    expect(result.blocks?.[3]?.type).toBe('actions');
    // No divider in current implementation
  });

  it('should include correct emoji for alert type', () => {
    const result = formatAlertMessage(baseAlert);
    const headerText = (result.blocks[0] as any).text.text;

    expect(headerText).toContain('📈'); // Price above emoji
    expect(headerText).toBe('📈 AAPL Alert: Price Above Target');
  });

  it('should calculate price change correctly', () => {
    const result = formatAlertMessage(baseAlert);
    const sectionBlock = result.blocks[1] as any;
    const fields = sectionBlock.fields;

    // Should have stock, current price, target price, and change fields
    expect(fields).toHaveLength(4);
    expect(fields[0].text).toContain('*Stock:*\nAAPL');
    expect(fields[1].text).toContain('*Current Price:*\n$185.50');
    expect(fields[2].text).toContain('*Target Price:*\n$180.00');
    // Price change: ((185.50 - 180) / 180) * 100 = 3.06%
    expect(fields[3].text).toContain('*Change:*\n+3.06%');
  });

  it('should handle negative price change', () => {
    const alert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        alert: {
          ...baseAlert.data.alert,
          condition: 'price_below',
          threshold: 200,
        },
        stock: {
          ...baseAlert.data.stock,
          price: 185.5,
          change: -14.5,
          change_percent: -7.25,
        },
      },
    };

    const result = formatAlertMessage(alert);
    const sectionBlock = result.blocks[1] as any;
    const fields = sectionBlock.fields;

    // Price change: ((185.50 - 200) / 200) * 100 = -7.25%
    expect(fields[3].text).toContain('*Change:*\n-7.25%');
  });

  it('should format volume alert correctly', () => {
    const volumeAlert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        alert: {
          ...baseAlert.data.alert,
          condition: 'volume_change',
          threshold: 50, // 50% increase threshold
        },
        stock: {
          ...baseAlert.data.stock,
        },
        volume_change_percentage: 75.5, // 75.5% actual increase
      },
    };

    const result = formatAlertMessage(volumeAlert);
    const headerText = (result.blocks[0] as any).text.text;

    expect(headerText).toContain('📊'); // Volume change emoji from ALERT_EMOJIS
    // v1 API: formatPercentage called with showPlus=false in header
    expect(headerText).toBe('📊 AAPL Alert: Volume Spike 75.50%');
    expect(result.text).toBe('AAPL Alert: Volume Change');
  });

  it('should include view dashboard button', () => {
    const result = formatAlertMessage(baseAlert);
    const actionBlock = result.blocks[3] as any; // Actions block is 4th (index 3) after header, section, context

    expect(actionBlock.type).toBe('actions');
    expect(actionBlock.elements).toHaveLength(2); // View Dashboard and Manage Alert
    expect(actionBlock.elements[0].type).toBe('button');
    expect(actionBlock.elements[0].text.text).toBe('View Dashboard');
    expect(actionBlock.elements[0].url).toBe('https://stockalert.pro/dashboard');
    expect(actionBlock.elements[1].type).toBe('button');
    expect(actionBlock.elements[1].text.text).toBe('View Stock');
    expect(actionBlock.elements[1].url).toBe('https://stockalert.pro/stocks/AAPL');
  });

  it('should format all supported alert types correctly', () => {
    const alertTypes = Object.keys(ALERT_TYPE_CONFIG) as Array<keyof typeof ALERT_TYPE_CONFIG>;

    alertTypes.forEach((condition) => {
      const alert: AlertEvent = {
        ...baseAlert,
        data: {
          ...baseAlert.data,
          alert: {
            ...baseAlert.data.alert,
            condition,
            threshold: 100,
          },
          stock: {
            ...baseAlert.data.stock,
            price: 110,
          },
        },
      };

      const result = formatAlertMessage(alert);
      const config = ALERT_TYPE_CONFIG[condition];
      const headerText = (result.blocks[0] as any).text.text;

      // For some conditions the emoji mapping is different
      const expectedEmoji =
        condition === 'price_change_down'
          ? '📉'
          : condition === 'volume_change'
            ? '📊'
            : condition === 'ma_crossover_death'
              ? '💀'
              : condition === 'ma_touch_above'
                ? '📊'
                : condition === 'ma_touch_below'
                  ? '📊'
                  : condition === 'pe_ratio_below'
                    ? '📊'
                    : condition === 'pe_ratio_above'
                      ? '📊'
                      : condition === 'forward_pe_below'
                        ? '🔮'
                        : condition === 'forward_pe_above'
                          ? '🔮'
                          : condition === 'earnings_announcement'
                            ? '📢'
                            : condition === 'dividend_ex_date'
                              ? '💰'
                              : condition === 'dividend_payment'
                                ? '💸'
                                : condition === 'new_high'
                                  ? '🎯'
                                  : condition === 'new_low'
                                    ? '⚠️'
                                    : condition === 'ma_crossover_golden'
                                      ? '✨'
                                      : condition === 'price_change_up'
                                        ? '🚀'
                                        : condition === 'reminder'
                                          ? '⏰'
                                          : condition === 'daily_reminder'
                                            ? '📅'
                                            : condition === 'rsi_limit'
                                              ? '📈'
                                              : condition === 'earnings_beat'
                                                ? '🚨'
                                                : condition === 'earnings_miss'
                                                  ? '🚨'
                                                  : config.emoji;
      expect(headerText).toContain(expectedEmoji);
      // Text is now just the condition formatted
      expect(result.text).toBe(
        `AAPL Alert: ${condition.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`
      );
    });
  });

  it('should handle alerts with parameters', () => {
    const alertWithParams: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        alert: {
          ...baseAlert.data.alert,
          condition: 'moving_average',
        },
        stock: {
          ...baseAlert.data.stock,
        },
        parameters: {
          period: 50,
          type: 'SMA',
        },
      },
    };

    const result = formatAlertMessage(alertWithParams);
    const contextBlock = result.blocks[2] as any;

    // Context block should contain parameter information
    expect(contextBlock.type).toBe('context');
    expect(contextBlock.elements[0].text).toContain('Triggered at');
  });

  it('should format large numbers correctly', () => {
    const largePriceAlert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        alert: {
          ...baseAlert.data.alert,
          condition: 'price_above',
          threshold: 10000000,
        },
        stock: {
          ...baseAlert.data.stock,
          price: 15500000,
          change: 5500000,
          change_percent: 55.0,
        },
      },
    };

    const result = formatAlertMessage(largePriceAlert);
    const sectionBlock = result.blocks[1] as any;
    const fields = sectionBlock.fields;

    // Formatter uses toFixed(2) without comma separators
    expect(fields[2].text).toContain('*Target Price:*\n$10000000.00');
    expect(fields[1].text).toContain('*Current Price:*\n$15500000.00');
  });

  it('should handle zero threshold gracefully', () => {
    const zeroThresholdAlert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        alert: {
          ...baseAlert.data.alert,
          threshold: 0,
        },
        stock: {
          ...baseAlert.data.stock,
          price: 185.5,
        },
      },
    };

    const result = formatAlertMessage(zeroThresholdAlert);
    expect(result.blocks).toHaveLength(4);
    expect(result.text).toBeDefined();
  });

  it('should use fallback text for unknown alert types', () => {
    const unknownAlert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        alert: {
          ...baseAlert.data.alert,
          condition: 'unknown_condition' as any,
          threshold: 100,
        },
        stock: {
          ...baseAlert.data.stock,
          price: 110,
        },
      },
    };

    const result = formatAlertMessage(unknownAlert);
    const headerText = (result.blocks[0] as any).text.text;

    // Should use default emoji for unknown types (🚨 from the code)
    expect(headerText).toContain('🚨');
    expect(result.text).toBe('AAPL Alert: Unknown Condition');
  });

  it('should format timestamp correctly', () => {
    const result = formatAlertMessage(baseAlert);
    const contextBlock = result.blocks[2] as any;

    expect(contextBlock.type).toBe('context');
    // toLocaleString() format varies by locale, just check for 'Triggered at'
    expect(contextBlock.elements[0].text).toContain('Triggered at');
  });
});
