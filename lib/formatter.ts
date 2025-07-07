import { AlertEvent, ALERT_TYPE_CONFIG, AlertType } from './types';
import { Block, KnownBlock } from '@slack/web-api';

export function formatAlertMessage(event: AlertEvent): {
  text: string;
  blocks: (KnownBlock | Block)[];
} {
  const { alert } = event.data;
  const config = ALERT_TYPE_CONFIG[alert.condition as AlertType] || {
    emoji: '📊',
    color: '#0074D9',
    description: alert.condition,
  };

  const priceChange = alert.triggered_value && alert.threshold
    ? ((alert.triggered_value - alert.threshold) / alert.threshold * 100).toFixed(2)
    : null;

  const changeText = priceChange
    ? priceChange.startsWith('-')
      ? `${priceChange}%`
      : `+${priceChange}%`
    : '';

  const text = `${config.emoji} ${alert.symbol} Alert: ${alert.company_name} - ${config.description}`;

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${config.emoji} ${alert.symbol} Alert Triggered`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${alert.company_name}*\n${config.description}`,
      },
      fields: [
        {
          type: 'mrkdwn',
          text: `*Target:*\n$${alert.threshold.toFixed(2)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current:*\n$${alert.triggered_value?.toFixed(2) || 'N/A'} ${changeText}`,
        },
      ],
    },
  ];

  if (alert.triggered_at) {
    const timestamp = new Date(alert.triggered_at).toLocaleString();
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Triggered at ${timestamp}`,
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
        url: `https://stockalert.pro/dashboard/alerts/${alert.id}`,
        action_id: 'manage_alert',
      },
    ],
  });

  blocks.push({ type: 'divider' });

  return { text, blocks };
}