import { AlertEvent, ALERT_TYPE_CONFIG, AlertType } from '../types';
import { Block, KnownBlock, SectionBlock } from '@slack/bolt';

/**
 * Format alert event into Slack blocks
 */
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

  // Simple text fallback
  const text = `${config.emoji} ${alert.symbol} Alert: ${alert.company_name} - ${config.description}`;

  // Rich block formatting
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

  // Add context for specific alert types
  if (alert.parameters && Object.keys(alert.parameters).length > 0) {
    const contextElements: any[] = [];

    if (alert.parameters.period) {
      contextElements.push({
        type: 'mrkdwn',
        text: `Period: ${alert.parameters.period} days`,
      });
    }

    if (alert.parameters.ma_type) {
      contextElements.push({
        type: 'mrkdwn',
        text: `MA Type: ${alert.parameters.ma_type}`,
      });
    }

    if (alert.parameters.direction) {
      contextElements.push({
        type: 'mrkdwn',
        text: `Direction: ${alert.parameters.direction}`,
      });
    }

    if (contextElements.length > 0) {
      blocks.push({
        type: 'context',
        elements: contextElements,
      });
    }
  }

  // Add timestamp
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

  // Add action buttons
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

  // Add divider
  blocks.push({ type: 'divider' });

  return { text, blocks };
}

/**
 * Format error message for Slack
 */
export function formatErrorMessage(error: Error): {
  text: string;
  blocks: (KnownBlock | Block)[];
} {
  return {
    text: `❌ Error: ${error.message}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *Error Processing Webhook*\n\`\`\`${error.message}\`\`\``,
        },
      },
    ],
  };
}

/**
 * Format test message
 */
export function formatTestMessage(): {
  text: string;
  blocks: (KnownBlock | Block)[];
} {
  return {
    text: '✅ StockAlert.pro Slack integration is working!',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '✅ *StockAlert.pro Slack Integration*\n\nYour Slack app is successfully connected and ready to receive webhook notifications!',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Tested at ${new Date().toLocaleString()}`,
          },
        ],
      },
    ],
  };
}