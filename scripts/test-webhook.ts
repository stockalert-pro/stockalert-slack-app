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

// Helper function to create different alert payloads
function createAlertPayload(type: string = 'price_above') {
  const basePayload = {
    event: 'alert.triggered' as const,
    timestamp: new Date().toISOString(),
    data: {
      alert_id: `alert_test_${Date.now()}`,
      symbol: 'AAPL',
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
          condition: 'forward_pe_below',
          threshold: 25.0,
          current_value: 222.59, // This is the stock price
          price: 222.59,
          forward_pe: 22.5, // This is the actual Forward P/E ratio
        },
      };

    case 'pe_ratio_above':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: 'pe_ratio_above',
          threshold: 30.0,
          current_value: 205.5, // Stock price
          price: 205.5,
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
          symbol: 'BAC',
          condition: 'pe_ratio_below',
          threshold: 15.0,
          current_value: 35.75,
          price: 35.75,
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
          symbol: 'NFLX',
          condition: 'forward_pe_above',
          threshold: 35.0,
          current_value: 485.25,
          price: 485.25,
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
          condition: 'price_above',
          threshold: 200.0,
          current_value: 205.5,
          price: 205.5,
        },
      };

    case 'price_change_up':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          symbol: 'GOOGL',
          condition: 'price_change_up',
          threshold: 5.0, // 5% increase threshold
          current_value: 7.2, // Actual percentage increase
          price: 142.8,
        },
      };

    case 'price_change_down':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          symbol: 'AMZN',
          condition: 'price_change_down',
          threshold: 3.0, // 3% drop threshold
          current_value: -5.5, // Actual percentage drop (negative)
          price: 178.5,
        },
      };

    case 'rsi_limit':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: 'rsi_limit',
          threshold: 70.0,
          current_value: 72.5, // RSI value
          price: 205.5,
          parameters: { direction: 'above' },
        },
      };

    case 'new_high':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          symbol: 'NVDA',
          condition: 'new_high',
          threshold: 0, // Not used for 52-week alerts
          current_value: 850.0, // Current price at new high
          price: 850.0,
        },
      };

    case 'new_low':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          symbol: 'META',
          condition: 'new_low',
          threshold: 0, // Not used for 52-week alerts
          current_value: 450.0, // Current price at new low
          price: 450.0,
        },
      };

    case 'ma_crossover_golden':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: 'ma_crossover_golden',
          threshold: 0, // Not used for crossovers
          current_value: 205.5,
          price: 205.5,
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
          condition: 'ma_crossover_death',
          threshold: 0,
          current_value: 195.5,
          price: 195.5,
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
          condition: 'ma_touch_above',
          threshold: 200, // 200-day MA
          current_value: 210.5,
          price: 210.5,
          parameters: {
            ma_value: 200,
          },
        },
      };

    case 'ma_touch_below':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: 'ma_touch_below',
          threshold: 50, // 50-day MA
          current_value: 195.5,
          price: 195.5,
          parameters: {
            ma_value: 200,
          },
        },
      };

    case 'volume_change':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          symbol: 'TSLA',
          condition: 'volume_change',
          threshold: 50, // 50% increase threshold
          current_value: 75.5, // 75.5% increase
          price: 242.5,
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
          condition: 'reminder',
          threshold: 30, // 30 days
          current_value: 215.5,
          price: 215.5,
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
          condition: 'daily_reminder',
          threshold: 1,
          current_value: 220.5,
          price: 220.5,
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
          symbol: 'MSFT',
          condition: 'earnings_announcement',
          threshold: 3, // 3 days before
          current_value: 378.85,
          price: 378.85,
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
          symbol: 'JNJ',
          condition: 'dividend_ex_date',
          threshold: 2, // 2 days before
          current_value: 155.25,
          price: 155.25,
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
          symbol: 'KO',
          condition: 'dividend_payment',
          threshold: 0,
          current_value: 62.45,
          price: 62.45,
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
          condition: type,
          threshold: 200.0,
          current_value: 205.5,
          price: 205.5,
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
        'X-Signature': `sha256=${signature}`, // Match OpenAPI spec format
        'X-StockAlert-Event': 'alert.triggered',
        'X-StockAlert-Timestamp': Date.now().toString(),
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
