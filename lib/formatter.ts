import { AlertEvent, ALERT_TYPE_CONFIG, AlertType } from './types';
import { KnownBlock } from '@slack/web-api';

export function formatAlertMessage(event: AlertEvent): {
  text: string;
  blocks: KnownBlock[];
} {
  const data = event.data;
  const config = ALERT_TYPE_CONFIG[data.condition as AlertType] || {
    emoji: '📊',
    color: '#0074D9',
    description: data.condition,
  };

  // Calculate price change only if both values are present
  let changeText = '';

  if (
    typeof data.current_value === 'number' &&
    typeof data.threshold === 'number' &&
    data.threshold !== 0
  ) {
    const changePercent = (((data.current_value - data.threshold) / data.threshold) * 100).toFixed(
      2
    );
    changeText = changePercent.startsWith('-') ? `${changePercent}%` : `+${changePercent}%`;
  }

  const text = `${config.emoji} ${data.symbol} Alert: ${config.description}`;

  // Handle test alerts that might not have all fields
  const isTest = data.test === true;

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${config.emoji} ${data.symbol} Alert Triggered`,
        emoji: true,
      },
    },
  ];

  // Build section with fields only if we have the data
  const sectionBlock: any = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${data.symbol}*\n${config.description}`,
    },
  };

  const fields = [];
  if (typeof data.threshold === 'number') {
    fields.push({
      type: 'mrkdwn',
      text: `*Target:*\n$${data.threshold.toFixed(2)}`,
    });
  }
  if (typeof data.current_value === 'number') {
    fields.push({
      type: 'mrkdwn',
      text: `*Current:*\n$${data.current_value.toFixed(2)} ${changeText}`,
    });
  }

  if (fields.length > 0) {
    sectionBlock.fields = fields;
  }

  blocks.push(sectionBlock);

  // Use event.timestamp for the trigger time, fall back to data.triggered_at if available
  const triggerTime = event.timestamp || data.triggered_at;
  if (triggerTime) {
    const timestamp = new Date(triggerTime).toLocaleString();
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Triggered at ${timestamp}${isTest ? ' (Test Alert)' : ''}`,
        },
      ],
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Dashboard',
          emoji: true,
        },
        url: 'https://stockalert.pro/dashboard',
        action_id: 'view_dashboard',
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Manage Alert',
          emoji: true,
        },
        url: data.alert_id
          ? `https://stockalert.pro/dashboard/alerts/${data.alert_id}`
          : 'https://stockalert.pro/dashboard/alerts',
        action_id: 'manage_alert',
      },
    ],
  });

  blocks.push({ type: 'divider' });

  return { text, blocks };
}
