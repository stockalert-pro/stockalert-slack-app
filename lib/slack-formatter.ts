import { AlertEvent } from './types';
import { KnownBlock } from '@slack/web-api';

/**
 * Slack Alert Formatter
 * Formats alerts according to the Slack Alert Formatting Specification
 * with proper color coding, emojis, and mobile-friendly layouts
 */

// Color constants for Slack formatting (kept for future use)
// const COLORS = {
//   GREEN: '#2eb67d', // Positive changes, bullish signals
//   RED: '#e01e5a', // Negative changes, bearish signals
//   BLUE: '#1264a3', // Neutral information, links
//   YELLOW: '#f2c744', // Warnings, upcoming events
//   GRAY: '#616061', // Metadata, context
// } as const;

// Alert type emojis mapping
const ALERT_EMOJIS = {
  price_above: '📈',
  price_below: '📉',
  price_change_up: '🚀',
  price_change_down: '📉',
  new_high: '🎯',
  new_low: '⚠️',
  ma_crossover_golden: '✨',
  ma_crossover_death: '💀',
  ma_touch_above: '📊',
  ma_touch_below: '📊',
  rsi_limit: '📈',
  reminder: '⏰',
  daily_reminder: '📅',
  volume_change: '📊',
  pe_ratio_below: '📊',
  pe_ratio_above: '📊',
  forward_pe_below: '🔮',
  forward_pe_above: '🔮',
  earnings_announcement: '📢',
  dividend_ex_date: '💰',
  dividend_payment: '💸',
} as const;

/**
 * Format currency values
 */
function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage values
 */
function formatPercentage(value: number, showPlus = true): string {
  const formatted = value.toFixed(2);
  if (value > 0 && showPlus) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Format volume with commas
 */
function formatVolume(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Format date
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format timestamp with timezone
 */
function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Get alert header text based on alert type
 */
function getAlertHeader(event: AlertEvent): string {
  const { symbol, condition, threshold } = event.data;
  const emoji = ALERT_EMOJIS[condition as keyof typeof ALERT_EMOJIS] || '🚨';

  switch (condition) {
    case 'price_above':
      return `${emoji} ${symbol} Alert: Price Above Target`;
    case 'price_below':
      return `${emoji} ${symbol} Alert: Price Below Target`;
    case 'price_change_up':
      return `${emoji} ${symbol} Alert: Price Up ${threshold}%`;
    case 'price_change_down':
      return `${emoji} ${symbol} Alert: Price Down ${Math.abs(threshold)}%`;
    case 'new_high':
      return `${emoji} ${symbol} Alert: New 52-Week High!`;
    case 'new_low':
      return `${emoji} ${symbol} Alert: New 52-Week Low`;
    case 'ma_crossover_golden':
      return `${emoji} ${symbol} Alert: Golden Cross (${event.data.parameters?.shortPeriod || 50}d/${event.data.parameters?.longPeriod || 200}d MA)`;
    case 'ma_crossover_death':
      return `${emoji} ${symbol} Alert: Death Cross (${event.data.parameters?.shortPeriod || 50}d/${event.data.parameters?.longPeriod || 200}d MA)`;
    case 'ma_touch_above':
      return `${emoji} ${symbol} Alert: Price Above ${threshold}-day MA`;
    case 'ma_touch_below':
      return `${emoji} ${symbol} Alert: Price Below ${threshold}-day MA`;
    case 'rsi_limit':
      return `${emoji} ${symbol} Alert: RSI Crossed ${threshold}`;
    case 'reminder':
      return `${emoji} ${symbol} Reminder: ${threshold}-Day Check`;
    case 'daily_reminder':
      return `${emoji} ${symbol} Daily Update`;
    case 'volume_change':
      return `${emoji} ${symbol} Alert: Volume Spike ${formatPercentage(event.data.current_value)}`;
    case 'pe_ratio_below':
      return `${emoji} ${symbol} Alert: P/E Below ${threshold}`;
    case 'pe_ratio_above':
      return `${emoji} ${symbol} Alert: P/E Above ${threshold}`;
    case 'forward_pe_below':
      return `${emoji} ${symbol} Alert: Forward P/E Below ${threshold}`;
    case 'forward_pe_above':
      return `${emoji} ${symbol} Alert: Forward P/E Above ${threshold}`;
    case 'earnings_announcement':
      return `${emoji} ${symbol} Alert: Earnings in ${threshold} Days`;
    case 'dividend_ex_date':
      return `${emoji} ${symbol} Alert: Ex-Dividend in ${threshold} Days`;
    case 'dividend_payment':
      return `${emoji} ${symbol} Alert: Dividend Payment Today`;
    default:
      return `🚨 ${symbol} Alert: ${condition.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`;
  }
}

/**
 * Format price alerts (price_above, price_below)
 */
function formatPriceAlert(event: AlertEvent): KnownBlock[] {
  const { symbol, company_name, current_value, threshold, price } = event.data;
  const priceValue = price ?? current_value;
  const changePercent = ((priceValue - threshold) / threshold) * 100;

  return [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name || symbol} (${symbol})`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(priceValue)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Target Price:*\n${formatCurrency(threshold)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Change:*\n${formatPercentage(changePercent)}`,
        },
      ],
    },
  ];
}

/**
 * Format percentage change alerts
 */
function formatPercentageChangeAlert(event: AlertEvent, isUp: boolean): KnownBlock[] {
  const { symbol, company_name, current_value, threshold, price, parameters } = event.data;
  const initialPrice = (parameters?.initial_price as number) || (price ?? 0);

  return [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name || symbol} (${symbol})`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Initial Price:*\n${formatCurrency(initialPrice)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Change:*\n${isUp ? ':green_circle:' : ':red_circle:'} ${formatPercentage(Math.abs(current_value))}`,
        },
        {
          type: 'mrkdwn',
          text: `*Target Change:*\n${formatPercentage(isUp ? threshold : -threshold)}`,
        },
      ],
    },
  ];
}

/**
 * Format 52-week high/low alerts
 */
function format52WeekAlert(event: AlertEvent, isHigh: boolean): KnownBlock[] {
  const { symbol, company_name, current_value, parameters } = event.data;
  const previousValue = parameters?.[isHigh ? 'previous_high' : 'previous_low'] as number;

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name || symbol} (${symbol})`,
        },
        {
          type: 'mrkdwn',
          text: `*New ${isHigh ? 'High' : 'Low'}:*\n${isHigh ? ':green_circle:' : ':red_circle:'} *${formatCurrency(current_value)}*`,
        },
      ],
    },
  ];

  if (previousValue) {
    const changePercent = ((current_value - previousValue) / previousValue) * 100;
    const sectionBlock = blocks[0] as {
      type: 'section';
      fields?: Array<{ type: string; text: string }>;
    };
    if (sectionBlock.fields) {
      sectionBlock.fields.push(
        {
          type: 'mrkdwn',
          text: `*Previous ${isHigh ? 'High' : 'Low'}:*\n${formatCurrency(previousValue)}`,
        },
        {
          type: 'mrkdwn',
          text: `*% ${isHigh ? 'Above' : 'Below'} Previous:*\n${formatPercentage(Math.abs(changePercent))}`,
        }
      );
    }
  }

  if (isHigh) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':star: *Achievement unlocked! New 52-week high reached!*',
      },
    });
  }

  return blocks;
}

/**
 * Format moving average crossover alerts
 */
function formatMACrossoverAlert(event: AlertEvent, isGolden: boolean): KnownBlock[] {
  const { symbol, company_name, current_value, parameters } = event.data;
  const shortPeriod = parameters?.shortPeriod || 50;
  const longPeriod = parameters?.longPeriod || 200;
  const maShort = parameters?.ma_short as number;
  const maLong = parameters?.ma_long as number;

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name || symbol} (${symbol})`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(current_value)}`,
        },
        {
          type: 'mrkdwn',
          text: `*${shortPeriod}-day MA:*\n${formatCurrency(maShort || current_value)}`,
        },
        {
          type: 'mrkdwn',
          text: `*${longPeriod}-day MA:*\n${formatCurrency(maLong || current_value)}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: isGolden
          ? ':green_circle: *Signal:* Bullish - Short MA crossed above Long MA'
          : ':red_circle: *Signal:* Bearish - Short MA crossed below Long MA',
      },
    },
  ];

  // Add educational note
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: isGolden
          ? '💡 A golden cross is typically considered a bullish signal'
          : '⚠️ A death cross is typically considered a bearish signal',
      },
    ],
  });

  return blocks;
}

/**
 * Format RSI alerts
 */
function formatRSIAlert(event: AlertEvent): KnownBlock[] {
  const { symbol, company_name, current_value, threshold, parameters, price } = event.data;
  const rsiValue = (parameters?.rsi_value as number) || current_value;
  const isOverbought = rsiValue > 70;
  const isOversold = rsiValue < 30;

  return [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name || symbol} (${symbol})`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
        },
        {
          type: 'mrkdwn',
          text: `*RSI Value:*\n${rsiValue.toFixed(2)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Threshold:*\n${threshold}`,
        },
        {
          type: 'mrkdwn',
          text: `*Condition:*\n${isOverbought ? ':red_circle: Overbought (>70)' : isOversold ? ':green_circle: Oversold (<30)' : 'Normal'}`,
        },
      ],
    },
  ];
}

/**
 * Format P/E ratio alerts
 */
function formatPERatioAlert(event: AlertEvent, isForward: boolean): KnownBlock[] {
  const {
    symbol,
    company_name,
    current_value,
    threshold,
    price,
    pe_ratio,
    forward_pe,
    parameters,
  } = event.data;
  const actualRatio = isForward ? (forward_pe ?? current_value) : (pe_ratio ?? current_value);
  const eps = parameters?.eps as number;
  const forwardEps = parameters?.forward_eps as number;

  const fields = [
    {
      type: 'mrkdwn' as const,
      text: `*Stock:*\n${company_name || symbol} (${symbol})`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*${isForward ? 'Forward P/E' : 'P/E Ratio'}:*\n${actualRatio.toFixed(2)}x`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Target ${isForward ? 'Forward P/E' : 'P/E'}:*\n${threshold.toFixed(2)}x`,
    },
  ];

  if (isForward && forwardEps) {
    fields.push({
      type: 'mrkdwn',
      text: `*Forward EPS:*\n${formatCurrency(forwardEps)}`,
    });
  } else if (!isForward && eps) {
    fields.push({
      type: 'mrkdwn',
      text: `*EPS:*\n${formatCurrency(eps)}`,
    });
  }

  return [
    {
      type: 'section',
      fields,
    },
  ];
}

/**
 * Format volume change alerts
 */
function formatVolumeChangeAlert(event: AlertEvent): KnownBlock[] {
  const { symbol, company_name, current_value, threshold, price, parameters } = event.data;
  const currentVolume = (parameters?.current_volume as number) || 0;
  const averageVolume = (parameters?.average_volume as number) || 0;

  return [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name || symbol} (${symbol})`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Volume:*\n${formatVolume(currentVolume)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Average Volume:*\n${formatVolume(averageVolume)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Volume Change:*\n:chart_with_upwards_trend: ${formatPercentage(Math.abs(current_value))}`,
        },
        {
          type: 'mrkdwn',
          text: `*Threshold:*\n${formatPercentage(threshold)}`,
        },
      ],
    },
  ];
}

/**
 * Format earnings announcement alerts
 */
function formatEarningsAlert(event: AlertEvent): KnownBlock[] {
  const { symbol, company_name, current_value, threshold, price, parameters } = event.data;
  const earningsDate = parameters?.earnings_date as string;
  const reportingTime = (parameters?.reporting_time as string) || 'After Market Close';
  const estimatedEps = parameters?.estimated_eps as number;

  const fields = [
    {
      type: 'mrkdwn' as const,
      text: `*Stock:*\n${company_name || symbol} (${symbol})`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Earnings Date:*\n*${formatDate(earningsDate || event.timestamp)}*`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Reporting Time:*\n${reportingTime}`,
    },
  ];

  if (estimatedEps) {
    fields.push({
      type: 'mrkdwn',
      text: `*Estimated EPS:*\n${formatCurrency(estimatedEps)}`,
    });
  }

  fields.push({
    type: 'mrkdwn',
    text: `*Days Until:*\n${threshold} days`,
  });

  return [
    {
      type: 'section',
      fields,
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: ':warning: Expect increased volatility around earnings announcements',
        },
      ],
    },
  ];
}

/**
 * Format dividend alerts
 */
function formatDividendAlert(event: AlertEvent, isPayment: boolean): KnownBlock[] {
  const { symbol, company_name, current_value, threshold, price, parameters } = event.data;
  const dividendAmount = (parameters?.dividend_amount as number) || 0;
  const dividendYield = parameters?.dividend_yield as number;
  const exDividendDate = parameters?.ex_dividend_date as string;
  const paymentDate = parameters?.payment_date as string;

  if (isPayment) {
    const shares = parameters?.shares as number;
    const totalPayment = shares ? shares * dividendAmount : 0;

    const fields = [
      {
        type: 'mrkdwn' as const,
        text: `*Stock:*\n${company_name || symbol} (${symbol})`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Payment Date:*\n${formatDate(paymentDate || event.timestamp)}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Dividend/Share:*\n${formatCurrency(dividendAmount)}`,
      },
    ];

    if (shares) {
      fields.push(
        {
          type: 'mrkdwn',
          text: `*Shares Owned:*\n${shares}`,
        },
        {
          type: 'mrkdwn',
          text: `*Total Payment:*\n:green_circle: *${formatCurrency(totalPayment)}*`,
        }
      );
    }

    return [
      {
        type: 'section',
        fields,
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':information_source: Payment will be credited to your account in 1-3 business days',
          },
        ],
      },
    ];
  } else {
    // Ex-dividend alert
    return [
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Stock:*\n${company_name || symbol} (${symbol})`,
          },
          {
            type: 'mrkdwn',
            text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Ex-Dividend Date:*\n*${formatDate(exDividendDate || event.timestamp)}*`,
          },
          {
            type: 'mrkdwn',
            text: `*Dividend Amount:*\n${formatCurrency(dividendAmount)} per share`,
          },
          {
            type: 'mrkdwn',
            text: `*Dividend Yield:*\n${dividendYield?.toFixed(2) || 'N/A'}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Days Until:*\n${threshold} days`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':warning: *Must own shares before ex-dividend date to receive payment*',
        },
      },
    ];
  }
}

/**
 * Format reminder alerts
 */
function formatReminderAlert(event: AlertEvent, isDaily: boolean): KnownBlock[] {
  const { symbol, company_name, current_value, threshold, price, parameters } = event.data;

  if (isDaily) {
    const previousClose = (parameters?.previous_close as number) || current_value;
    const week52High = parameters?.week_52_high as number;
    const week52Low = parameters?.week_52_low as number;
    const volume = parameters?.volume as number;
    const changePercent = (((price ?? current_value) - previousClose) / previousClose) * 100;

    const fields = [
      {
        type: 'mrkdwn' as const,
        text: `*Stock:*\n${company_name || symbol} (${symbol})`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Previous Close:*\n${formatCurrency(previousClose)}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Change:*\n${changePercent > 0 ? ':green_circle:' : ':red_circle:'} ${formatPercentage(changePercent)}`,
      },
    ];

    if (week52High && week52Low) {
      fields.push(
        {
          type: 'mrkdwn',
          text: `*52-Week High:*\n${formatCurrency(week52High)}`,
        },
        {
          type: 'mrkdwn',
          text: `*52-Week Low:*\n${formatCurrency(week52Low)}`,
        }
      );
    }

    if (volume) {
      fields.push({
        type: 'mrkdwn',
        text: `*Volume:*\n${formatVolume(volume)}`,
      });
    }

    return [
      {
        type: 'section',
        fields,
      },
    ];
  } else {
    // Regular reminder
    const priceChangePercent = parameters?.price_change_percent as number;

    return [
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Stock:*\n${company_name || symbol} (${symbol})`,
          },
          {
            type: 'mrkdwn',
            text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Days Since Alert:*\n${threshold} days`,
          },
          {
            type: 'mrkdwn',
            text: `*Price Change:*\n${priceChangePercent ? formatPercentage(priceChangePercent) : 'N/A'}`,
          },
        ],
      },
    ];
  }
}

/**
 * Main formatter function
 */
export function formatSlackAlert(event: AlertEvent): {
  text: string;
  blocks: KnownBlock[];
} {
  const { condition, alert_id, triggered_at } = event.data;

  // Get header
  const headerText = getAlertHeader(event);

  // Build blocks
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText,
        emoji: true,
      },
    },
  ];

  // Add condition-specific fields
  switch (condition) {
    case 'price_above':
    case 'price_below':
      blocks.push(...formatPriceAlert(event));
      break;
    case 'price_change_up':
      blocks.push(...formatPercentageChangeAlert(event, true));
      break;
    case 'price_change_down':
      blocks.push(...formatPercentageChangeAlert(event, false));
      break;
    case 'new_high':
      blocks.push(...format52WeekAlert(event, true));
      break;
    case 'new_low':
      blocks.push(...format52WeekAlert(event, false));
      break;
    case 'ma_crossover_golden':
      blocks.push(...formatMACrossoverAlert(event, true));
      break;
    case 'ma_crossover_death':
      blocks.push(...formatMACrossoverAlert(event, false));
      break;
    case 'ma_touch_above':
    case 'ma_touch_below':
      blocks.push(...formatMATouchAlert(event));
      break;
    case 'rsi_limit':
      blocks.push(...formatRSIAlert(event));
      break;
    case 'pe_ratio_below':
    case 'pe_ratio_above':
      blocks.push(...formatPERatioAlert(event, false));
      break;
    case 'forward_pe_below':
    case 'forward_pe_above':
      blocks.push(...formatPERatioAlert(event, true));
      break;
    case 'volume_change':
      blocks.push(...formatVolumeChangeAlert(event));
      break;
    case 'earnings_announcement':
      blocks.push(...formatEarningsAlert(event));
      break;
    case 'dividend_ex_date':
      blocks.push(...formatDividendAlert(event, false));
      break;
    case 'dividend_payment':
      blocks.push(...formatDividendAlert(event, true));
      break;
    case 'reminder':
      blocks.push(...formatReminderAlert(event, false));
      break;
    case 'daily_reminder':
      blocks.push(...formatReminderAlert(event, true));
      break;
    default:
      blocks.push(formatDefaultAlert(event));
  }

  // Add context with timestamp
  const contextText =
    condition === 'reminder'
      ? `Reminder set ${event.data.threshold} days ago | Alert ID: ${alert_id}`
      : condition === 'daily_reminder'
        ? `Daily update at market open | Alert ID: ${alert_id}`
        : `Triggered at ${formatTimestamp(triggered_at || event.timestamp)} | Alert ID: ${alert_id}`;

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: contextText,
      },
    ],
  });

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
          text: 'View Stock',
          emoji: true,
        },
        url: `https://stockalert.pro/stocks/${event.data.symbol}`,
        action_id: 'view_stock',
      },
    ],
  });

  // Fallback text for notifications
  const text = `${event.data.symbol} Alert: ${condition.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`;

  return { text, blocks };
}

/**
 * Format MA touch alerts
 */
function formatMATouchAlert(event: AlertEvent): KnownBlock[] {
  const { symbol, company_name, current_value, threshold, condition, parameters } = event.data;
  const maValue = (parameters?.ma_value as number) || threshold;
  const isAbove = condition === 'ma_touch_above';

  return [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name || symbol} (${symbol})`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(current_value)}`,
        },
        {
          type: 'mrkdwn',
          text: `*${threshold}-day MA:*\n${formatCurrency(maValue)}`,
        },
        {
          type: 'mrkdwn',
          text: isAbove
            ? '*Breakout:*\n:green_circle: Price broke above moving average'
            : '*Breakdown:*\n:red_circle: Price broke below moving average',
        },
      ],
    },
  ];
}

/**
 * Format default alert (fallback)
 */
function formatDefaultAlert(event: AlertEvent): KnownBlock {
  const { symbol, company_name, current_value, threshold, price } = event.data;

  return {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Stock:*\n${company_name || symbol} (${symbol})`,
      },
      {
        type: 'mrkdwn',
        text: `*Current Price:*\n${formatCurrency(price ?? current_value)}`,
      },
      {
        type: 'mrkdwn',
        text: `*Threshold:*\n${threshold}`,
      },
      {
        type: 'mrkdwn',
        text: `*Current Value:*\n${current_value}`,
      },
    ],
  };
}
