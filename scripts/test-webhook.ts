#!/usr/bin/env tsx

import crypto from 'crypto';
import fetch from 'node-fetch';
import { db } from '../lib/db';
import { installations } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

// Configuration - now with team ID support
const TEAM_ID = process.env.TEAM_ID || 'T1234567890';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WEBHOOK_URL = process.env.WEBHOOK_URL || `${BASE_URL}/api/webhooks/${TEAM_ID}/stockalert`;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.STOCKALERT_WEBHOOK_SECRET || null;

// Sample webhook payload matching the expected format
const payload = {
  event: 'alert.triggered',
  timestamp: new Date().toISOString(),
  data: {
    alert_id: 'alert_test_456',
    symbol: 'AAPL',
    company_name: 'Apple Inc.',
    alert_type: 'price_above',
    alert_name: 'Price went above $200',
    condition: 'Price went above target',
    target_value: '$200.00',
    current_value: '$205.50',
    price: 205.50,
    price_change: 2.75,
    price_change_percent: 1.35,
    dashboard_url: 'https://stockalert.pro/dashboard',
    alert_url: 'https://stockalert.pro/alerts/alert_test_456',
  },
};

// Send webhook
async function sendTestWebhook() {
  try {
    // Get webhook secret for the team if not provided
    let secret = WEBHOOK_SECRET;
    if (!secret) {
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
      
      secret = installation.webhookSecret || process.env.STOCKALERT_WEBHOOK_SECRET;
      if (!secret) {
        console.error('No webhook secret found for this team');
        process.exit(1);
      }
      console.log('Found webhook secret for team');
    }

    // Generate signature with the correct secret
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    console.log('Sending test webhook to:', WEBHOOK_URL);
    console.log('Team ID:', TEAM_ID);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('Signature:', signature);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-StockAlert-Signature': signature,
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
  } finally {
    // Close database connection
    process.exit();
  }
}

// Run the test
sendTestWebhook();