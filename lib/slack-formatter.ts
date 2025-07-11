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
      return `${emoji} ${symbol} Alert: Price Up ${event.data.price_change_percentage ?? event.data.current_value}%`;
    case 'price_change_down':
      return `${emoji} ${symbol} Alert: Price Down ${Math.abs(event.data.price_change_percentage ?? event.data.current_value)}%`;
    case 'new_high':
      return `${emoji} ${symbol} Alert: New 52-Week High!`;
    case 'new_low':
      return `${emoji} ${symbol} Alert: New 52-Week Low`;
    case 'ma_crossover_golden':
      return `${emoji} ${symbol} Alert: Golden Cross (50d/200d MA)`;
    case 'ma_crossover_death':
      return `${emoji} ${symbol} Alert: Death Cross (50d/200d MA)`;
    case 'ma_touch_above':
      return `${emoji} ${symbol} Alert: Price Above ${threshold ?? 0}-day MA`;
    case 'ma_touch_below':
      return `${emoji} ${symbol} Alert: Price Below ${threshold ?? 0}-day MA`;
    case 'rsi_limit':
      return `${emoji} ${symbol} Alert: RSI Crossed ${threshold ?? 0}`;
    case 'reminder':
      return `${emoji} ${symbol} Reminder: ${threshold ?? 0}-Day Check`;
    case 'daily_reminder':
      return `${emoji} ${symbol} Daily Update`;
    case 'volume_change':
      return `${emoji} ${symbol} Alert: Volume Spike ${formatPercentage(event.data.volume_change_percentage ?? event.data.current_value)}`;
    case 'pe_ratio_below':
      return `${emoji} ${symbol} Alert: P/E Below ${threshold ?? 0}`;
    case 'pe_ratio_above':
      return `${emoji} ${symbol} Alert: P/E Above ${threshold ?? 0}`;
    case 'forward_pe_below':
      return `${emoji} ${symbol} Alert: Forward P/E Below ${threshold ?? 0}`;
    case 'forward_pe_above':
      return `${emoji} ${symbol} Alert: Forward P/E Above ${threshold ?? 0}`;
    case 'earnings_announcement':
      return `${emoji} ${symbol} Alert: Earnings in ${event.data.days_until_earnings ?? threshold ?? 0} Days`;
    case 'dividend_ex_date':
      return `${emoji} ${symbol} Alert: Ex-Dividend in ${event.data.days_until_ex_date ?? 0} Days`;
    case 'dividend_payment':
      return `${emoji} ${symbol} Alert: Dividend Payment in ${event.data.days_until_payment ?? 0} Days`;
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
  const changePercent = threshold ? ((priceValue - threshold) / threshold) * 100 : 0;

  return [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(priceValue)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Target Price:*\n${threshold ? formatCurrency(threshold) : 'N/A'}`,
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
  const {
    symbol,
    company_name,
    current_value,
    threshold,
    price,
    price_change_percentage,
    initial_price,
    reference_price,
    previous_close,
  } = event.data;
  const currentPrice = price ?? 0;
  const basePrice = initial_price ?? reference_price ?? previous_close ?? 0;
  const actualChangePercent = price_change_percentage ?? current_value;

  return [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Initial Price:*\n${formatCurrency(basePrice)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Change:*\n${isUp ? '🟢' : '🔴'} ${formatPercentage(Math.abs(actualChangePercent))}`,
        },
        {
          type: 'mrkdwn',
          text: `*Target Change:*\n${threshold ? formatPercentage(Math.abs(threshold)) : 'N/A'}`,
        },
      ],
    },
  ];
}

/**
 * Format 52-week high/low alerts
 */
function format52WeekAlert(event: AlertEvent, isHigh: boolean): KnownBlock[] {
  const {
    symbol,
    company_name,
    current_value,
    week_52_high,
    week_52_low,
    previous_high,
    previous_low,
  } = event.data;
  const newValue = isHigh ? (week_52_high ?? current_value) : (week_52_low ?? current_value);
  const previousValue = isHigh ? previous_high : previous_low;

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
        },
        {
          type: 'mrkdwn',
          text: `*New ${isHigh ? 'High' : 'Low'}:*\n${isHigh ? '🟢' : '🔴'} *${formatCurrency(newValue)}*`,
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
        text: '⭐ *Achievement unlocked! New 52-week high reached!*',
      },
    });
  }

  return blocks;
}

/**
 * Format moving average crossover alerts
 */
function formatMACrossoverAlert(event: AlertEvent, isGolden: boolean): KnownBlock[] {
  const { symbol, company_name, current_value, price, ma50, ma200, ma_short, ma_long } = event.data;
  const currentPrice = price ?? current_value;
  const shortMA = ma50 ?? ma_short ?? current_value;
  const longMA = ma200 ?? ma_long ?? current_value;

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
        },
        {
          type: 'mrkdwn',
          text: `*50-day MA:*\n${formatCurrency(shortMA)}`,
        },
        {
          type: 'mrkdwn',
          text: `*200-day MA:*\n${formatCurrency(longMA)}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: isGolden
          ? '🟢 *Signal:* Bullish - Short MA crossed above Long MA'
          : '🔴 *Signal:* Bearish - Short MA crossed below Long MA',
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
  const { symbol, company_name, current_value, threshold, price, rsi, rsi_value, comparison } =
    event.data;
  const currentPrice = price ?? 0;
  const rsiVal = rsi ?? rsi_value ?? current_value;
  const isOverbought = rsiVal > 70;
  const isOversold = rsiVal < 30;
  const direction = comparison || (rsiVal > (threshold ?? 50) ? 'above' : 'below');

  const fields = [
    {
      type: 'mrkdwn' as const,
      text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*RSI Value:*\n${rsiVal.toFixed(2)}`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Threshold:*\n${threshold ?? 'N/A'}`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Condition:*\n${isOverbought ? '🔴 Overbought (>70)' : isOversold ? '🟢 Oversold (<30)' : `RSI ${direction} ${threshold}`}`,
    },
  ];

  if (currentPrice > 0) {
    fields.push({
      type: 'mrkdwn',
      text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
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
  const currentPrice = price ?? (parameters?.price as number) ?? 0;
  const eps = parameters?.eps as number;
  const forwardEps = parameters?.forward_eps as number;

  const fields = [
    {
      type: 'mrkdwn' as const,
      text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*${isForward ? 'Forward P/E' : 'P/E Ratio'}:*\n${actualRatio.toFixed(2)}x`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Target ${isForward ? 'Forward P/E' : 'P/E'}:*\n${threshold ? `${threshold.toFixed(2)}x` : 'N/A'}`,
    },
  ];

  if (currentPrice > 0) {
    fields.push({
      type: 'mrkdwn' as const,
      text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
    });
  }

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
  const {
    symbol,
    company_name,
    current_value,
    threshold,
    price,
    volume,
    average_volume,
    volume_change_percentage,
  } = event.data;
  const currentPrice = price ?? 0;
  const currentVolume = volume ?? 0;
  const avgVolume = average_volume ?? 0;
  const volumeChangePercent = volume_change_percentage ?? current_value;

  const fields = [
    {
      type: 'mrkdwn' as const,
      text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
    },
  ];

  if (currentVolume > 0) {
    fields.push({
      type: 'mrkdwn' as const,
      text: `*Current Volume:*\n${formatVolume(currentVolume)}`,
    });
  }

  if (avgVolume > 0) {
    fields.push({
      type: 'mrkdwn' as const,
      text: `*Average Volume:*\n${formatVolume(avgVolume)}`,
    });
  }

  fields.push(
    {
      type: 'mrkdwn' as const,
      text: `*Volume Change:*\n📈 ${formatPercentage(Math.abs(volumeChangePercent))}`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Threshold:*\n${threshold ? formatPercentage(threshold) : 'N/A'}`,
    }
  );

  if (currentPrice > 0) {
    fields.push({
      type: 'mrkdwn' as const,
      text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
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
 * Format earnings announcement alerts
 */
function formatEarningsAlert(event: AlertEvent): KnownBlock[] {
  const {
    symbol,
    company_name,
    price,
    earnings_date,
    days_until_earnings,
    reporting_time,
    estimated_eps,
    threshold,
  } = event.data;
  const currentPrice = price ?? 0;
  const daysUntil = days_until_earnings ?? threshold ?? 0;

  const fields = [
    {
      type: 'mrkdwn' as const,
      text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
    },
  ];

  if (currentPrice > 0) {
    fields.push({
      type: 'mrkdwn' as const,
      text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
    });
  }

  fields.push(
    {
      type: 'mrkdwn' as const,
      text: `*Earnings Date:*\n*${formatDate(earnings_date || event.timestamp)}*`,
    },
    {
      type: 'mrkdwn' as const,
      text: `*Reporting Time:*\n${reporting_time || 'After Market Close'}`,
    }
  );

  if (estimated_eps) {
    fields.push({
      type: 'mrkdwn',
      text: `*Estimated EPS:*\n${formatCurrency(estimated_eps)}`,
    });
  }

  fields.push({
    type: 'mrkdwn',
    text: `*Days Until:*\n${daysUntil} days`,
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
          text: '⚠️ Expect increased volatility around earnings announcements',
        },
      ],
    },
  ];
}

/**
 * Format dividend alerts
 */
function formatDividendAlert(event: AlertEvent, isPayment: boolean): KnownBlock[] {
  const {
    symbol,
    company_name,
    price,
    dividend_amount,
    dividend_yield,
    dividend_ex_date,
    ex_dividend_date,
    dividend_payment_date,
    payment_date,
    days_until_ex_date,
    days_until_payment,
    parameters,
  } = event.data;
  const currentPrice = price ?? 0;
  const dividendAmt = dividend_amount ?? (parameters?.dividend_amount as number) ?? 0;
  const dividendYld = dividend_yield ?? (parameters?.dividend_yield as number);
  const exDate = dividend_ex_date || ex_dividend_date || (parameters?.ex_dividend_date as string);
  const payDate = dividend_payment_date || payment_date || (parameters?.payment_date as string);

  if (isPayment) {
    const shares = parameters?.shares as number;
    const totalPayment = shares && dividendAmt > 0 ? shares * dividendAmt : 0;

    const fields = [
      {
        type: 'mrkdwn' as const,
        text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
      },
    ];

    if (currentPrice > 0) {
      fields.push({
        type: 'mrkdwn' as const,
        text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
      });
    }

    fields.push({
      type: 'mrkdwn' as const,
      text: `*Payment Date:*\n${formatDate(payDate || event.timestamp)}`,
    });

    if (dividendAmt > 0) {
      fields.push({
        type: 'mrkdwn' as const,
        text: `*Dividend/Share:*\n${formatCurrency(dividendAmt)}`,
      });
    }

    if (shares && totalPayment > 0) {
      fields.push(
        {
          type: 'mrkdwn',
          text: `*Shares Owned:*\n${shares}`,
        },
        {
          type: 'mrkdwn',
          text: `*Total Payment:*\n🟢 *${formatCurrency(totalPayment)}*`,
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
            text: 'ℹ️ Payment will be credited to your account in 1-3 business days',
          },
        ],
      },
    ];
  } else {
    // Ex-dividend alert
    const fields = [
      {
        type: 'mrkdwn' as const,
        text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
      },
    ];

    if (currentPrice > 0) {
      fields.push({
        type: 'mrkdwn' as const,
        text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
      });
    }

    fields.push({
      type: 'mrkdwn' as const,
      text: `*Ex-Dividend Date:*\n*${formatDate(exDate || event.timestamp)}*`,
    });

    if (dividendAmt > 0) {
      fields.push({
        type: 'mrkdwn' as const,
        text: `*Dividend Amount:*\n${formatCurrency(dividendAmt)} per share`,
      });
    }

    if (dividendYld && dividendYld > 0) {
      fields.push({
        type: 'mrkdwn' as const,
        text: `*Dividend Yield:*\n${dividendYld.toFixed(2)}%`,
      });
    }

    const daysUntil = isPayment ? days_until_payment : days_until_ex_date;
    fields.push({
      type: 'mrkdwn' as const,
      text: `*Days Until:*\n${daysUntil ?? 0} days`,
    });

    return [
      {
        type: 'section',
        fields,
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⚠️ *Must own shares before ex-dividend date to receive payment*',
        },
      },
    ];
  }
}

/**
 * Format reminder alerts
 */
function formatReminderAlert(event: AlertEvent, isDaily: boolean): KnownBlock[] {
  const {
    symbol,
    company_name,
    price,
    previous_close,
    week_52_high,
    week_52_low,
    volume,
    parameters,
    threshold,
  } = event.data;
  const currentPrice = price ?? 0;

  if (isDaily) {
    const prevClose = previous_close ?? currentPrice;
    const week52High = week_52_high;
    const week52Low = week_52_low;
    const vol = volume;
    const changePercent = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

    const fields = [
      {
        type: 'mrkdwn' as const,
        text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Previous Close:*\n${formatCurrency(prevClose)}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Change:*\n${changePercent > 0 ? '🟢' : changePercent < 0 ? '🔴' : ''} ${formatPercentage(changePercent)}`,
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

    if (vol) {
      fields.push({
        type: 'mrkdwn',
        text: `*Volume:*\n${formatVolume(vol)}`,
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
    const priceChangePercent = (parameters?.price_change_percent as number) ?? 0;

    const fields = [
      {
        type: 'mrkdwn' as const,
        text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Days Since Alert:*\n${threshold ?? 0} days`,
      },
    ];

    if (priceChangePercent !== undefined) {
      fields.push({
        type: 'mrkdwn' as const,
        text: `*Price Change:*\n${formatPercentage(priceChangePercent)}`,
      });
    }

    return [
      {
        type: 'section',
        fields,
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

  // Only process triggered alerts
  if (event.event !== 'alert.triggered') {
    return {
      text: `${event.data.symbol} Alert: ${event.event}`,
      blocks: [],
    };
  }

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
      ? `Reminder for ${formatDate(event.data.reminder_date || event.timestamp)} | Alert ID: ${alert_id}`
      : condition === 'daily_reminder'
        ? `Daily update at ${event.data.reminder_time || 'market open'} | Alert ID: ${alert_id}`
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
  const { symbol, company_name, current_value, threshold, condition, price, ma, ma_period } =
    event.data;
  const currentPrice = price ?? current_value;
  const maValue = ma ?? current_value;
  const period = ma_period ?? threshold ?? 0;
  const isAbove = condition === 'ma_touch_above';

  return [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
        },
        {
          type: 'mrkdwn',
          text: `*${period}-day MA:*\n${formatCurrency(maValue)}`,
        },
        {
          type: 'mrkdwn',
          text: isAbove
            ? '*Breakout:*\n🟢 Price broke above moving average'
            : '*Breakdown:*\n🔴 Price broke below moving average',
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
  const currentPrice = price ?? 0;

  const fields = [
    {
      type: 'mrkdwn' as const,
      text: `*Stock:*\n${company_name ? `${company_name} (${symbol})` : symbol}`,
    },
  ];

  if (currentPrice > 0) {
    fields.push({
      type: 'mrkdwn' as const,
      text: `*Current Price:*\n${formatCurrency(currentPrice)}`,
    });
  }

  if (threshold) {
    fields.push({
      type: 'mrkdwn' as const,
      text: `*Threshold:*\n${threshold}`,
    });
  }

  fields.push({
    type: 'mrkdwn' as const,
    text: `*Current Value:*\n${current_value}`,
  });

  return {
    type: 'section',
    fields,
  };
}
