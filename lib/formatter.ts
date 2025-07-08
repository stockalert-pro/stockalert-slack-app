import { AlertEvent, ALERT_TYPE_CONFIG, AlertType } from './types';
import { KnownBlock } from '@slack/web-api';
import { formatWebhookData, getAlertLabels } from './webhook-formatter';

export function formatAlertMessage(event: AlertEvent): {
  text: string;
  blocks: KnownBlock[];
} {
  const data = event.data;
  const config = ALERT_TYPE_CONFIG[data.condition as AlertType] || {
    emoji: '📊',
    color: '#0074D9',
    description: data.condition.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
  };

  // Use the enhanced webhook formatter
  const formattedData = formatWebhookData(event);
  const labels = getAlertLabels(data.condition);

  const text = `${formattedData.symbol} Alert: ${config.description}`;

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${formattedData.symbol} Alert Triggered`,
        emoji: true,
      },
    },
  ];

  // Build main section with alert icon and description
  const sectionBlock: any = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${config.emoji} *${config.description}*`,
    },
  };

  // Add fields for threshold and current value
  const fields = [];

  // Only show threshold if it's meaningful for this alert type
  if (!labels.hideThreshold) {
    fields.push({
      type: 'mrkdwn',
      text: `*${labels.targetLabel}:*\n${formattedData.thresholdFormatted}`,
    });
  }

  fields.push({
    type: 'mrkdwn',
    text: `*${labels.currentLabel}:*\n${formattedData.currentValueFormatted}${formattedData.changeText || ''}`,
  });

  // Only add fields if we have any
  if (fields.length > 0) {
    sectionBlock.fields = fields;
  }
  blocks.push(sectionBlock);

  // Add additional context for certain alert types
  const contextElements = [];

  // Add stock price context when appropriate
  if (labels.showStockPrice && formattedData.stockPrice !== undefined) {
    contextElements.push({
      type: 'mrkdwn' as const,
      text: `Stock Price: $${formattedData.stockPrice.toFixed(2)}`,
    });
  }

  // Add moving average period for MA alerts
  if (formattedData.parameters && data.condition.includes('ma_')) {
    const period = (formattedData.parameters as any).period;
    if (period) {
      contextElements.push({
        type: 'mrkdwn' as const,
        text: `📊 ${period}-day moving average`,
      });
    }
  }

  // Add RSI direction for RSI alerts
  if (data.condition === 'rsi_limit' && formattedData.parameters) {
    const direction = (formattedData.parameters as any).direction;
    if (direction) {
      contextElements.push({
        type: 'mrkdwn' as const,
        text: `Direction: ${direction}`,
      });
    }
  }

  // Add company name if available
  if (formattedData.companyName) {
    contextElements.push({
      type: 'mrkdwn' as const,
      text: `Company: ${formattedData.companyName}`,
    });
  }

  if (contextElements.length > 0) {
    blocks.push({
      type: 'context',
      elements: contextElements,
    });
  }

  // Use event.timestamp for the trigger time, fall back to data.triggered_at if available
  const triggerTime = event.timestamp || formattedData.triggeredAt;
  if (triggerTime) {
    const timestamp = new Date(triggerTime).toLocaleString();
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Triggered at ${timestamp}${formattedData.isTest ? ' (Test Alert)' : ''}`,
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
        url: formattedData.alertId
          ? `https://stockalert.pro/dashboard/alerts/${formattedData.alertId}`
          : 'https://stockalert.pro/dashboard/alerts',
        action_id: 'manage_alert',
      },
    ],
  });

  blocks.push({ type: 'divider' });

  return { text, blocks };
}
