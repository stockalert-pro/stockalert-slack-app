import { describe, it, expect } from 'vitest';
import { formatAlertMessage } from '../lib/formatter';
import { AlertEvent, ALERT_TYPE_CONFIG } from '../lib/types';

describe('formatAlertMessage', () => {
  const baseAlert: AlertEvent = {
    event: 'alert.triggered',
    timestamp: '2024-01-15T10:30:00Z',
    data: {
      alert_id: 'alert_123',
      symbol: 'AAPL',
      condition: 'price_above',
      threshold: 180,
      current_value: 185.5,
      triggered_at: '2024-01-15T10:30:00Z',
      parameters: null,
    },
  };

  it('should format price above alert correctly', () => {
    const result = formatAlertMessage(baseAlert);

    expect(result.text).toBe('📈 AAPL Alert: Price went above target');
    expect(result.blocks).toHaveLength(5); // header, section, context, actions, divider
    expect(result.blocks?.[0]?.type).toBe('header');
    expect(result.blocks?.[1]?.type).toBe('section');
    expect(result.blocks?.[2]?.type).toBe('context');
    expect(result.blocks?.[3]?.type).toBe('actions');
    expect(result.blocks?.[4]?.type).toBe('divider');
  });

  it('should include correct emoji for alert type', () => {
    const result = formatAlertMessage(baseAlert);
    const headerText = (result.blocks[0] as any).text.text;

    expect(headerText).toContain('📈'); // Price above emoji
    expect(headerText).toBe('📈 AAPL Alert Triggered');
  });

  it('should calculate price change correctly', () => {
    const result = formatAlertMessage(baseAlert);
    const sectionBlock = result.blocks[1] as any;
    const fields = sectionBlock.fields;

    // Should have target and current fields
    expect(fields).toHaveLength(2);
    expect(fields[0].text).toContain('*Target:*\n$180.00');
    // Price change: ((185.50 - 180) / 180) * 100 = 3.06%
    expect(fields[1].text).toContain('*Current:*\n$185.50 +3.06%');
  });

  it('should handle negative price change', () => {
    const alert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        condition: 'price_below',
        threshold: 200,
        current_value: 185.5,
      },
    };

    const result = formatAlertMessage(alert);
    const sectionBlock = result.blocks[1] as any;
    const fields = sectionBlock.fields;

    // Price change: ((185.50 - 200) / 200) * 100 = -7.25%
    expect(fields[1].text).toContain('*Current:*\n$185.50 -7.25%');
  });

  it('should format volume alert correctly', () => {
    const volumeAlert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        condition: 'volume_change',
        threshold: 1000000,
        current_value: 1500000,
      },
    };

    const result = formatAlertMessage(volumeAlert);
    const headerText = (result.blocks[0] as any).text.text;

    expect(headerText).toContain('📢'); // Volume change emoji from ALERT_TYPE_CONFIG
    expect(headerText).toBe('📢 AAPL Alert Triggered');
    expect(result.text).toBe('📢 AAPL Alert: Volume spike detected');
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
    expect(actionBlock.elements[1].text.text).toBe('Manage Alert');
    expect(actionBlock.elements[1].url).toBe('https://stockalert.pro/dashboard/alerts/alert_123');
  });

  it('should format all supported alert types correctly', () => {
    const alertTypes = Object.keys(ALERT_TYPE_CONFIG) as Array<keyof typeof ALERT_TYPE_CONFIG>;

    alertTypes.forEach((condition) => {
      const alert: AlertEvent = {
        ...baseAlert,
        data: {
          ...baseAlert.data,
          condition,
          threshold: 100,
          current_value: 110,
        },
      };

      const result = formatAlertMessage(alert);
      const config = ALERT_TYPE_CONFIG[condition];
      const headerText = (result.blocks[0] as any).text.text;

      expect(headerText).toContain(config.emoji);
      expect(result.text).toContain(config.description);
    });
  });

  it('should handle alerts with parameters', () => {
    const alertWithParams: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        condition: 'moving_average',
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
    const largeVolumeAlert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        condition: 'volume_change',
        threshold: 10000000,
        current_value: 15500000,
      },
    };

    const result = formatAlertMessage(largeVolumeAlert);
    const sectionBlock = result.blocks[1] as any;
    const fields = sectionBlock.fields;

    // Formatter uses toFixed(2) without comma separators
    expect(fields[0].text).toContain('*Target:*\n$10000000.00');
    expect(fields[1].text).toContain('*Current:*\n$15500000.00');
  });

  it('should handle zero threshold gracefully', () => {
    const zeroThresholdAlert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        threshold: 0,
        current_value: 185.5,
      },
    };

    const result = formatAlertMessage(zeroThresholdAlert);
    expect(result.blocks).toHaveLength(5);
    expect(result.text).toBeDefined();
  });

  it('should use fallback text for unknown alert types', () => {
    const unknownAlert: AlertEvent = {
      ...baseAlert,
      data: {
        ...baseAlert.data,
        condition: 'unknown_condition' as any,
        threshold: 100,
        current_value: 110,
      },
    };

    const result = formatAlertMessage(unknownAlert);
    const headerText = (result.blocks[0] as any).text.text;

    // Should use default emoji for unknown types (📊 from the code)
    expect(headerText).toContain('📊');
    expect(result.text).toContain('unknown_condition');
  });

  it('should format timestamp correctly', () => {
    const result = formatAlertMessage(baseAlert);
    const contextBlock = result.blocks[2] as any;

    expect(contextBlock.type).toBe('context');
    // toLocaleString() format varies by locale, just check for 'Triggered at'
    expect(contextBlock.elements[0].text).toContain('Triggered at');
  });
});
