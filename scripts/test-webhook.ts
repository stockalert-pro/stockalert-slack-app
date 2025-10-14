#!/usr/bin/env tsx

import * as crypto from 'crypto';
import { db } from '../lib/db';
import { installations } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

// Configuration - now with team ID support
const TEAM_ID = process.env['TEAM_ID'] || 'T1234567890';
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';
const WEBHOOK_URL = process.env['WEBHOOK_URL'] || `${BASE_URL}/api/webhooks/${TEAM_ID}/stockalert`;
const WEBHOOK_SECRET =
  process.env['WEBHOOK_SECRET'] || process.env['STOCKALERT_WEBHOOK_SECRET'] || null;

// Helper function to create different alert payloads (v1 API)
// Updated to match the new nested structure from openapi.yaml
function createAlertPayload(type: string = 'price_above') {
  const basePayload = {
    event: 'alert.triggered' as const,
    timestamp: new Date().toISOString(),
    data: {
      // v1 API: Core alert information
      alert: {
        id: `alert_test_${Date.now()}`,
        symbol: 'AAPL',
        condition: 'price_above', // Will be overridden per alert type
        threshold: null as number | null,
        status: 'triggered' as const,
      },
      // v1 API: Stock price information
      stock: {
        symbol: 'AAPL',
        price: 205.5,
        change: 5.3,
        change_percent: 2.65,
      },
      // Extended fields (optional, for detailed alerts)
      company_name: 'Apple Inc.',
      triggered_at: new Date().toISOString(),
      reason: 'Alert condition met',
      parameters: null,
    },
  };

  // Add type-specific fields based on OpenAPI spec
  switch (type) {
    case 'forward_pe_below':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'forward_pe_below',
            threshold: 25.0,
          },
          stock: {
            ...basePayload.data.stock,
            price: 222.59,
            change: 5.3,
            change_percent: 2.65,
          },
          forward_pe: 22.5, // This is the actual Forward P/E ratio
          parameters: {
            forward_eps: null,
          },
        },
      };

    case 'pe_ratio_above':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'pe_ratio_above',
            threshold: 30.0,
          },
          stock: {
            ...basePayload.data.stock,
            price: 205.5,
            change: 5.3,
            change_percent: 2.65,
          },
          pe_ratio: 32.5, // Actual P/E ratio
          parameters: {
            eps: 6.32,
          },
        },
      };

    case 'pe_ratio_below':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'BAC',
            condition: 'pe_ratio_below',
            threshold: 15.0,
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'BAC',
            price: 35.75,
            change: 0.85,
            change_percent: 2.43,
          },
          pe_ratio: 12.8,
          parameters: {
            eps: 2.79,
          },
        },
      };

    case 'forward_pe_above':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'NFLX',
            condition: 'forward_pe_above',
            threshold: 35.0,
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'NFLX',
            price: 485.25,
            change: 12.5,
            change_percent: 2.64,
          },
          forward_pe: 38.2,
          parameters: {
            forward_eps: 12.7,
          },
        },
      };

    case 'price_above':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'price_above',
            threshold: 200.0,
          },
          stock: {
            ...basePayload.data.stock,
            price: 205.5,
            change: 5.3,
            change_percent: 2.65,
          },
        },
      };

    case 'price_change_up':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'GOOGL',
            condition: 'price_change_up',
            threshold: 5.0, // 5% increase threshold
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'GOOGL',
            price: 142.8,
            change: 9.55,
            change_percent: 7.2,
          },
          price_change_percentage: 7.2, // Actual percentage increase
        },
      };

    case 'price_change_down':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'AMZN',
            condition: 'price_change_down',
            threshold: 3.0, // 3% drop threshold
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'AMZN',
            price: 178.5,
            change: -10.39,
            change_percent: -5.5,
          },
          price_change_percentage: -5.5, // Actual percentage drop (negative)
        },
      };

    case 'rsi_limit':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'rsi_limit',
            threshold: 70.0,
          },
          stock: {
            ...basePayload.data.stock,
            price: 205.5,
            change: 5.3,
            change_percent: 2.65,
          },
          rsi: 72.5, // RSI value
          parameters: { direction: 'above' },
        },
      };

    case 'new_high':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'NVDA',
            condition: 'new_high',
            threshold: null, // Not used for 52-week alerts
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'NVDA',
            price: 850.0, // Current price at new high
            change: 25.0,
            change_percent: 3.03,
          },
          week_52_high: 850.0,
          previous_high: 825.0,
        },
      };

    case 'new_low':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'META',
            condition: 'new_low',
            threshold: null, // Not used for 52-week alerts
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'META',
            price: 450.0, // Current price at new low
            change: -15.0,
            change_percent: -3.23,
          },
          week_52_low: 450.0,
          previous_low: 465.0,
        },
      };

    case 'ma_crossover_golden':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'ma_crossover_golden',
            threshold: null, // Not used for crossovers
          },
          stock: {
            ...basePayload.data.stock,
            price: 205.5,
            change: 5.3,
            change_percent: 2.65,
          },
          ma50: 204.75,
          ma200: 203.9,
          parameters: {
            shortPeriod: 50,
            longPeriod: 200,
            ma_short: 204.75,
            ma_long: 203.9,
          },
        },
      };

    case 'ma_crossover_death':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'ma_crossover_death',
            threshold: null,
          },
          stock: {
            ...basePayload.data.stock,
            price: 195.5,
            change: -9.5,
            change_percent: -4.63,
          },
          ma50: 196.25,
          ma200: 197.1,
          parameters: {
            shortPeriod: 50,
            longPeriod: 200,
            ma_short: 196.25,
            ma_long: 197.1,
          },
        },
      };

    case 'ma_touch_above':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'ma_touch_above',
            threshold: 200, // 200-day MA
          },
          stock: {
            ...basePayload.data.stock,
            price: 210.5,
            change: 10.3,
            change_percent: 5.14,
          },
          ma_value: 200.0,
          parameters: {
            ma_value: 200.0,
          },
        },
      };

    case 'ma_touch_below':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'ma_touch_below',
            threshold: 50, // 50-day MA
          },
          stock: {
            ...basePayload.data.stock,
            price: 195.5,
            change: -9.5,
            change_percent: -4.63,
          },
          ma_value: 200.0,
          parameters: {
            ma_value: 200.0,
          },
        },
      };

    case 'volume_change':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'TSLA',
            condition: 'volume_change',
            threshold: 50, // 50% increase threshold
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'TSLA',
            price: 242.5,
            change: 8.5,
            change_percent: 3.63,
          },
          volume: 125000000,
          average_volume: 71250000,
          volume_change_percentage: 75.5, // 75.5% increase
          parameters: {
            current_volume: 125000000,
            average_volume: 71250000,
          },
        },
      };

    case 'reminder':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'reminder',
            threshold: 30, // 30 days
          },
          stock: {
            ...basePayload.data.stock,
            price: 215.5,
            change: 15.3,
            change_percent: 7.65,
          },
          price_change_percentage: 7.75,
          parameters: {
            price_change_percent: 7.75,
          },
        },
      };

    case 'daily_reminder':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: 'daily_reminder',
            threshold: null,
          },
          stock: {
            ...basePayload.data.stock,
            price: 220.5,
            change: 1.75,
            change_percent: 0.8,
          },
          previous_close: 218.75,
          week_52_high: 237.8,
          week_52_low: 164.3,
          volume: 28750000,
          parameters: {
            previous_close: 218.75,
            week_52_high: 237.8,
            week_52_low: 164.3,
            volume: 28750000,
          },
        },
      };

    case 'earnings_announcement':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'MSFT',
            condition: 'earnings_announcement',
            threshold: 3, // 3 days before
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'MSFT',
            price: 378.85,
            change: 5.25,
            change_percent: 1.41,
          },
          days_until_earnings: 3,
          earnings_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          reporting_time: 'After Market Close',
          estimated_eps: 2.93,
          parameters: {
            earnings_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            reporting_time: 'After Market Close',
            estimated_eps: 2.93,
          },
        },
      };

    case 'dividend_ex_date':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'JNJ',
            condition: 'dividend_ex_date',
            threshold: 2, // 2 days before
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'JNJ',
            price: 155.25,
            change: 1.25,
            change_percent: 0.81,
          },
          days_until_ex_date: 2,
          ex_dividend_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          dividend_amount: 1.19,
          dividend_yield: 3.06,
          parameters: {
            ex_dividend_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            dividend_amount: 1.19,
            dividend_yield: 3.06,
          },
        },
      };

    case 'dividend_payment':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            symbol: 'KO',
            condition: 'dividend_payment',
            threshold: null,
          },
          stock: {
            ...basePayload.data.stock,
            symbol: 'KO',
            price: 62.45,
            change: 0.35,
            change_percent: 0.56,
          },
          payment_date: new Date().toISOString(),
          dividend_amount: 0.46,
          shares: 500,
          total_payment: 230.0,
          parameters: {
            payment_date: new Date().toISOString(),
            dividend_amount: 0.46,
            shares: 500,
          },
        },
      };

    default:
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          alert: {
            ...basePayload.data.alert,
            condition: type,
            threshold: 200.0,
          },
          stock: {
            ...basePayload.data.stock,
            price: 205.5,
            change: 5.3,
            change_percent: 2.65,
          },
        },
      };
  }
}

// Get alert type from command line or default
const alertType = process.argv[2] || 'price_above';
const payload = createAlertPayload(alertType);

// Validate alert type
const validAlertTypes = [
  'price_above',
  'price_below',
  'price_change_up',
  'price_change_down',
  'new_high',
  'new_low',
  'ma_crossover_golden',
  'ma_crossover_death',
  'ma_touch_above',
  'ma_touch_below',
  'rsi_limit',
  'volume_change',
  'pe_ratio_below',
  'pe_ratio_above',
  'forward_pe_below',
  'forward_pe_above',
  'earnings_announcement',
  'dividend_ex_date',
  'dividend_payment',
  'reminder',
  'daily_reminder',
];

if (!validAlertTypes.includes(alertType) && alertType !== '--help' && alertType !== '-h') {
  console.error(`\n❌ Invalid alert type: ${alertType}`);
  console.log('\nUse --help to see available alert types');
  process.exit(1);
}

// Send webhook
async function sendTestWebhook(): Promise<void> {
  try {
    // Get webhook secret for the team if not provided
    let secret = WEBHOOK_SECRET;
    if (!secret) {
      // eslint-disable-next-line no-console
      console.log(`Looking up webhook secret for team ${TEAM_ID}...`);
      const [installation] = await db
        .select()
        .from(installations)
        .where(eq(installations.teamId, TEAM_ID))
        .limit(1);

      if (!installation) {
        console.error(`No installation found for team ${TEAM_ID}`);
        process.exit(1);
      }

      secret =
        installation.stockalertWebhookSecret || process.env['STOCKALERT_WEBHOOK_SECRET'] || null;
      if (!secret) {
        console.error('No webhook secret found for this team');
        process.exit(1);
      }
      // eslint-disable-next-line no-console
      console.log('Found webhook secret for team');
    }

    // Generate signature with the correct secret
    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    // eslint-disable-next-line no-console
    console.log('\n📨 Sending test webhook');
    // eslint-disable-next-line no-console
    console.log('Alert Type:', alertType);
    // eslint-disable-next-line no-console
    console.log('Webhook URL:', WEBHOOK_URL);
    // eslint-disable-next-line no-console
    console.log('Team ID:', TEAM_ID);
    // eslint-disable-next-line no-console
    console.log('\nPayload:', JSON.stringify(payload, null, 2));
    // eslint-disable-next-line no-console
    console.log('\nSignature:', signature);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // v1 API: Primary header (plain hex, no prefix)
        'X-StockAlert-Signature': signature,
        // v1 API: Convenience headers
        'X-StockAlert-Event': 'alert.triggered',
        'X-StockAlert-Timestamp': new Date().toISOString(),
        // Legacy header (with sha256= prefix) for backward compatibility
        'X-Signature': `sha256=${signature}`,
      },
      body: payloadString,
    });

    const responseText = await response.text();
    // eslint-disable-next-line no-console
    console.log('\nResponse Status:', response.status);
    // eslint-disable-next-line no-console
    console.log('Response:', responseText);

    if (response.ok) {
      // eslint-disable-next-line no-console
      console.log('\n✅ Webhook sent successfully!');
    } else {
      console.error('\n❌ Webhook failed!');
    }
  } catch (error) {
    console.error('\n❌ Error sending webhook:', error);
  } finally {
    // Close database connection
    process.exit();
  }
}

// Show usage if help is requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npm run test:webhook [alert-type]

Available alert types (21 total):

Price Alerts:
  - price_above         Price above threshold
  - price_below         Price below threshold
  - price_change_up     Price increased by percentage (GOOGL)
  - price_change_down   Price decreased by percentage (AMZN)
  
52-Week Alerts:
  - new_high           52-week high (NVDA)
  - new_low            52-week low (META)
  
Moving Average Alerts:
  - ma_crossover_golden Golden cross signal
  - ma_crossover_death  Death cross signal
  - ma_touch_above     Price broke above MA
  - ma_touch_below     Price broke below MA
  
Technical Indicators:
  - rsi_limit          RSI limit reached
  - volume_change      Volume spike (TSLA)
  
Fundamental Alerts:
  - pe_ratio_below     P/E below threshold
  - pe_ratio_above     P/E above threshold
  - forward_pe_below   Forward P/E below threshold
  - forward_pe_above   Forward P/E above threshold
  
Corporate Events:
  - earnings_announcement  Earnings coming up (MSFT)
  - dividend_ex_date      Ex-dividend date (JNJ)
  - dividend_payment      Dividend payment (KO)
  
Reminders:
  - reminder           Periodic reminder
  - daily_reminder     Daily update

Examples:
  npm run test:webhook price_change_up
  npm run test:webhook ma_crossover_golden
  npm run test:webhook earnings_announcement
`);
  process.exit(0);
}

// Run the test
sendTestWebhook();
