import { z } from 'zod';

/**
 * StockAlert.pro webhook payload schema
 * This is the current schema used by the StockAlert.pro API
 */
export const AlertEventSchema = z.object({
  event: z.enum(['alert.triggered', 'alert.created', 'alert.updated', 'alert.deleted']),
  timestamp: z.string(),
  data: z.object({
    alert_id: z.string(),
    symbol: z.string(),
    condition: z.string(),
    threshold: z.number(),
    current_value: z.number(),
    triggered_at: z.string(),
    reason: z.string().optional(),
    parameters: z.record(z.unknown()).nullable(),
    test: z.boolean().optional(),
  }),
});

/**
 * Legacy webhook payload schema
 * Maintained for backward compatibility with older webhook formats
 * @deprecated Use AlertEventSchema for new implementations
 */
export const LegacyAlertEventSchema = z.object({
  event_id: z.string(),
  type: z.enum(['alert.triggered', 'alert.created', 'alert.updated', 'alert.deleted']),
  triggered_at: z.string(),
  data: z.object({
    alert: z.object({
      id: z.string(),
      symbol: z.string(),
      company_name: z.string(),
      condition: z.string(),
      threshold: z.number(),
      triggered_value: z.number().optional(),
      triggered_at: z.string().optional(),
      is_active: z.boolean(),
      notification_channel: z.enum(['email', 'sms', 'whatsapp']),
      parameters: z.record(z.any()).optional(),
    }),
  }),
});

/** Inferred type from the AlertEventSchema */
export type AlertEvent = z.infer<typeof AlertEventSchema>;

/**
 * Configuration for different alert types
 * Maps alert condition types to their display properties
 */
export const ALERT_TYPE_CONFIG = {
  price_above: {
    emoji: '📈',
    color: '#2ECC40',
    description: 'Price went above target',
  },
  price_below: {
    emoji: '📉',
    color: '#FF4136',
    description: 'Price went below target',
  },
  price_change_up: {
    emoji: '🚀',
    color: '#2ECC40',
    description: 'Price increased by target percentage',
  },
  price_change_down: {
    emoji: '💔',
    color: '#FF4136',
    description: 'Price decreased by target percentage',
  },
  new_high: {
    emoji: '🎯',
    color: '#3D9970',
    description: 'New 52-week high',
  },
  new_low: {
    emoji: '⚠️',
    color: '#FF851B',
    description: 'New 52-week low',
  },
  ma_crossover_golden: {
    emoji: '✨',
    color: '#FFDC00',
    description: 'Golden cross (bullish signal)',
  },
  ma_crossover_death: {
    emoji: '☠️',
    color: '#B10DC9',
    description: 'Death cross (bearish signal)',
  },
  ma_touch_above: {
    emoji: '👆',
    color: '#0074D9',
    description: 'Price touched MA from above',
  },
  ma_touch_below: {
    emoji: '👇',
    color: '#001F3F',
    description: 'Price touched MA from below',
  },
  rsi_limit: {
    emoji: '📊',
    color: '#7FDBFF',
    description: 'RSI limit reached',
  },
  volume_change: {
    emoji: '📢',
    color: '#39CCCC',
    description: 'Volume spike detected',
  },
  pe_ratio_below: {
    emoji: '💰',
    color: '#2ECC40',
    description: 'P/E ratio below target',
  },
  pe_ratio_above: {
    emoji: '💸',
    color: '#FF4136',
    description: 'P/E ratio above target',
  },
  forward_pe_below: {
    emoji: '🔮',
    color: '#2ECC40',
    description: 'Forward P/E ratio below target',
  },
  forward_pe_above: {
    emoji: '⚡',
    color: '#FF4136',
    description: 'Forward P/E ratio above target',
  },
  dividend_announcement: {
    emoji: '💵',
    color: '#3D9970',
    description: 'Dividend announced',
  },
  dividend_ex_date: {
    emoji: '📅',
    color: '#0074D9',
    description: 'Ex-dividend date approaching',
  },
  dividend_payment: {
    emoji: '💳',
    color: '#2ECC40',
    description: 'Dividend payment date',
  },
  earnings_announcement: {
    emoji: '📊',
    color: '#FF851B',
    description: 'Earnings announcement',
  },
  earnings_beat: {
    emoji: '🎉',
    color: '#2ECC40',
    description: 'Earnings beat expectations',
  },
  earnings_miss: {
    emoji: '😔',
    color: '#FF4136',
    description: 'Earnings missed expectations',
  },
  reminder: {
    emoji: '⏰',
    color: '#AAAAAA',
    description: 'Alert reminder',
  },
  daily_reminder: {
    emoji: '📆',
    color: '#7FDBFF',
    description: 'Daily reminder',
  },
} as const;

/** Valid alert type keys */
export type AlertType = keyof typeof ALERT_TYPE_CONFIG;
