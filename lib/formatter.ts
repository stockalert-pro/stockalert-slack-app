import { AlertEvent, ALERT_TYPE_CONFIG, AlertType } from './types';
import { Block, KnownBlock } from '@slack/web-api';

export function formatAlertMessage(event: AlertEvent): {
  text: string;
  blocks: (KnownBlock | Block)[];
} {
  const data = event.data;
  const config = ALERT_TYPE_CONFIG[data.condition as AlertType] || {
    emoji: '📊',
    color: '#0074D9',
    description: data.condition,
  };

  const priceChange = data.current_value && data.threshold
    ? ((data.current_value - data.threshold) / data.threshold * 100).toFixed(2)
    : null;

  const changeText = priceChange
    ? priceChange.startsWith('-')
      ? `${priceChange}%`
      : `+${priceChange}%`
    : '';

  const text = `${config.emoji} ${data.symbol} Alert: ${config.description}`;
  
  // Handle test alerts that might not have all fields
  const isTest = data.test === true;

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${config.emoji} ${data.symbol} Alert Triggered`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${data.symbol}*\n${config.description}`,
      },
      fields: [
        {
          type: 'mrkdwn',
          text: `*Target:*\n$${data.threshold.toFixed(2)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current:*\n$${data.current_value.toFixed(2)} ${changeText}`,
        },
      ],
    },
  ];

  if (data.triggered_at) {
    const timestamp = new Date(data.triggered_at).toLocaleString();
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
        url: `https://stockalert.pro/dashboard/alerts/${data.alert_id}`,
        action_id: 'manage_alert',
      },
    ],
  });

  blocks.push({ type: 'divider' });

  return { text, blocks };
}