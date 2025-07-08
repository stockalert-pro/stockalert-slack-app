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
    description: data.condition.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
  };

  // Format values based on alert type
  const isFundamentalAlert = [
    'pe_ratio_below',
    'pe_ratio_above',
    'forward_pe_below',
    'forward_pe_above',
  ].includes(data.condition);
  const isPercentageAlert = ['price_change_up', 'price_change_down', 'volume_change'].includes(
    data.condition
  );
  const isRSIAlert = data.condition === 'rsi_limit';

  // Format threshold and current value
  let thresholdText = '';
  let currentText = '';

  if (isFundamentalAlert) {
    // P/E ratios - check for specific ratio fields first
    thresholdText = data.threshold.toFixed(2);

    // For forward PE, check if we have the actual forward_pe value
    if (data.condition.includes('forward_pe') && data.forward_pe !== undefined) {
      currentText = data.forward_pe.toFixed(2);
    } else if (data.condition.includes('pe_ratio') && data.pe_ratio !== undefined) {
      currentText = data.pe_ratio.toFixed(2);
    } else if (data.actual_value !== undefined) {
      // Fallback to actual_value if provided
      currentText = data.actual_value.toFixed(2);
    } else {
      // Last resort: use current_value
      currentText = data.current_value.toFixed(2);
    }
  } else if (isRSIAlert) {
    // RSI values
    thresholdText = data.threshold.toFixed(2);
    currentText = data.current_value.toFixed(2);
  } else if (isPercentageAlert) {
    // Percentage changes
    thresholdText = `${data.threshold}%`;
    currentText = `${data.current_value}%`;
  } else {
    // Price values
    thresholdText = `$${data.threshold.toFixed(2)}`;
    currentText = `$${data.current_value.toFixed(2)}`;
  }

  // Calculate price/value change for context
  let changeText = '';

  // For fundamental alerts, show if the condition is met rather than percentage change
  if (isFundamentalAlert) {
    // Don't show percentage for ratios
    changeText = '';
  } else if (!isPercentageAlert && data.threshold !== 0) {
    const changePercent = (((data.current_value - data.threshold) / data.threshold) * 100).toFixed(
      2
    );
    changeText = changePercent.startsWith('-') ? ` (${changePercent}%)` : ` (+${changePercent}%)`;
  }

  const text = `${data.symbol} Alert: ${config.description}`;

  // Handle test alerts that might not have all fields
  const isTest = data.test === true;

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${data.symbol} Alert Triggered`,
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

  // Customize field labels based on alert type
  let targetLabel = 'Target';
  let currentLabel = 'Current';

  if (isFundamentalAlert) {
    targetLabel = 'Target Ratio';
    currentLabel = 'Current Ratio';
  } else if (isRSIAlert) {
    targetLabel = 'RSI Threshold';
    currentLabel = 'Current RSI';
  } else if (isPercentageAlert) {
    targetLabel = 'Threshold';
    currentLabel = 'Change';
  }

  fields.push({
    type: 'mrkdwn',
    text: `*${targetLabel}:*\n${thresholdText}`,
  });

  fields.push({
    type: 'mrkdwn',
    text: `*${currentLabel}:*\n${currentText}${changeText}`,
  });

  sectionBlock.fields = fields;
  blocks.push(sectionBlock);

  // Add additional context for certain alert types
  const contextElements = [];

  // Add stock price context for fundamental alerts
  if (isFundamentalAlert && data.price !== undefined) {
    contextElements.push({
      type: 'mrkdwn' as const,
      text: `Stock Price: $${data.price.toFixed(2)}`,
    });
  }

  // Add moving average period for MA alerts
  if (data.parameters && data.condition.includes('ma_') && data.parameters.period) {
    contextElements.push({
      type: 'mrkdwn' as const,
      text: `📊 ${data.parameters.period}-day moving average`,
    });
  }

  // Add company name if available
  if (data.company_name) {
    contextElements.push({
      type: 'mrkdwn' as const,
      text: `Company: ${data.company_name}`,
    });
  }

  if (contextElements.length > 0) {
    blocks.push({
      type: 'context',
      elements: contextElements,
    });
  }

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
