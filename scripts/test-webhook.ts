#!/usr/bin/env tsx

import crypto from 'crypto';
import fetch from 'node-fetch';

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhooks/stockalert';
const WEBHOOK_SECRET = process.env.STOCKALERT_WEBHOOK_SECRET || 'test-secret';

// Sample webhook payload
const payload = {
  event_id: 'evt_test_123',
  type: 'alert.triggered',
  triggered_at: new Date().toISOString(),
  data: {
    alert: {
      id: 'alert_test_456',
      symbol: 'AAPL',
      company_name: 'Apple Inc.',
      condition: 'price_above',
      threshold: 200,
      triggered_value: 205.50,
      triggered_at: new Date().toISOString(),
      is_active: true,
      notification_channel: 'email' as const,
      parameters: {
        created_at: new Date().toISOString(),
      },
    },
  },
};

// Generate signature
const payloadString = JSON.stringify(payload);
const signature = 'sha256=' + crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payloadString)
  .digest('hex');

// Send webhook
async function sendTestWebhook() {
  console.log('Sending test webhook to:', WEBHOOK_URL);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('Signature:', signature);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-StockAlert-Event': 'alert.triggered',
        'X-StockAlert-Timestamp': Date.now().toString(),
      },
      body: payloadString,
    });

    const responseText = await response.text();
    console.log('\nResponse Status:', response.status);
    console.log('Response:', responseText);

    if (response.ok) {
      console.log('\n✅ Webhook sent successfully!');
    } else {
      console.error('\n❌ Webhook failed!');
    }
  } catch (error) {
    console.error('\n❌ Error sending webhook:', error);
  }
}

// Run the test
sendTestWebhook();