import { AlertEvent } from './types';

/**
 * Enhanced webhook data formatter that handles various field combinations
 * from the StockAlert.pro webhook payload according to the OpenAPI spec
 */

export interface FormattedAlertData {
  // Core identifiers
  alertId: string;
  symbol: string;
  companyName?: string;
  condition: string;

  // Values
  threshold: number;
  currentValue: number;
  displayValue?: number; // The actual metric value (e.g., P/E ratio)
  stockPrice?: number;

  // Metadata
  triggeredAt: string;
  reason?: string;
  parameters?: Record<string, unknown> | null;
  isTest?: boolean;

  // Computed display values
  thresholdFormatted: string;
  currentValueFormatted: string;
  changeText?: string;
}

/**
 * Extract and format webhook data based on alert type
 */
export function formatWebhookData(event: AlertEvent): FormattedAlertData {
  const data = event.data;

  // Base data that all alerts have
  const baseData = {
    alertId: data.alert_id,
    symbol: data.symbol,
    companyName: data.company_name,
    condition: data.condition,
    threshold: data.threshold,
    currentValue: data.current_value,
    stockPrice: data.price,
    triggeredAt: data.triggered_at,
    reason: data.reason,
    parameters: data.parameters,
    isTest: data.test,
  };

  // Determine the actual display value based on alert type
  let displayValue: number | undefined;

  // Fundamental ratio alerts
  if (data.condition.includes('forward_pe')) {
    displayValue = data.forward_pe;
  } else if (data.condition.includes('pe_ratio')) {
    displayValue = data.pe_ratio;
  } else if (data.actual_value !== undefined) {
    // Some alerts may provide actual_value separately
    displayValue = data.actual_value;
  }

  // Format values based on alert type
  const formattedData = formatAlertValues(
    data.condition,
    data.threshold,
    data.current_value,
    displayValue
  );

  return {
    ...baseData,
    displayValue,
    ...formattedData,
  };
}

/**
 * Format alert values based on alert type
 */
function formatAlertValues(
  condition: string,
  threshold: number,
  currentValue: number,
  displayValue?: number
): {
  thresholdFormatted: string;
  currentValueFormatted: string;
  changeText?: string;
} {
  // Categorize alert types
  const isFundamentalAlert = [
    'pe_ratio_below',
    'pe_ratio_above',
    'forward_pe_below',
    'forward_pe_above',
  ].includes(condition);

  const isPercentageAlert = ['price_change_up', 'price_change_down', 'volume_change'].includes(
    condition
  );

  const isRSIAlert = condition === 'rsi_limit';

  const is52WeekAlert = ['new_high', 'new_low'].includes(condition);

  const isMovingAverageAlert = condition.includes('ma_');

  const isEventAlert = [
    'earnings_announcement',
    'dividend_ex_date',
    'dividend_payment',
    'reminder',
    'daily_reminder',
  ].includes(condition);

  let thresholdFormatted = '';
  let currentValueFormatted = '';
  let changeText: string | undefined;

  if (isFundamentalAlert) {
    // P/E and Forward P/E ratios
    thresholdFormatted = threshold.toFixed(2);
    const ratioValue = displayValue ?? currentValue;
    currentValueFormatted = ratioValue.toFixed(2);
  } else if (isRSIAlert) {
    // RSI values
    thresholdFormatted = threshold.toFixed(0);
    currentValueFormatted = currentValue.toFixed(0);
  } else if (isPercentageAlert) {
    // For percentage alerts, the values are already percentages
    thresholdFormatted = `${threshold.toFixed(1)}%`;
    currentValueFormatted = `${Math.abs(currentValue).toFixed(1)}%`;
  } else if (is52WeekAlert) {
    // 52-week highs/lows don't have a threshold
    thresholdFormatted = 'N/A';
    currentValueFormatted = `$${currentValue.toFixed(2)}`;
  } else if (isMovingAverageAlert) {
    // Moving average alerts
    if (condition.includes('crossover')) {
      thresholdFormatted = 'Crossover';
      currentValueFormatted = `$${currentValue.toFixed(2)}`;
    } else {
      // MA touch alerts
      thresholdFormatted = `$${threshold.toFixed(2)}`;
      currentValueFormatted = `$${currentValue.toFixed(2)}`;
    }
  } else if (isEventAlert) {
    // Event-based alerts don't have meaningful thresholds
    thresholdFormatted = 'N/A';
    currentValueFormatted = 'Triggered';
  } else {
    // Price alerts
    thresholdFormatted = `$${threshold.toFixed(2)}`;
    currentValueFormatted = `$${currentValue.toFixed(2)}`;

    // Calculate percentage change for price alerts
    if (threshold !== 0) {
      const changePercent = (((currentValue - threshold) / threshold) * 100).toFixed(1);
      changeText = changePercent.startsWith('-') ? `(${changePercent}%)` : `(+${changePercent}%)`;
    }
  }

  return {
    thresholdFormatted,
    currentValueFormatted,
    changeText,
  };
}

/**
 * Get display labels for different alert types
 */
export function getAlertLabels(condition: string): {
  targetLabel: string;
  currentLabel: string;
  showStockPrice: boolean;
  hideThreshold?: boolean;
} {
  // Categorize alert types
  const isFundamentalAlert = [
    'pe_ratio_below',
    'pe_ratio_above',
    'forward_pe_below',
    'forward_pe_above',
  ].includes(condition);

  const isRSIAlert = condition === 'rsi_limit';

  const isPercentageAlert = ['price_change_up', 'price_change_down', 'volume_change'].includes(
    condition
  );

  const is52WeekAlert = ['new_high', 'new_low'].includes(condition);

  const isMovingAverageAlert = condition.includes('ma_');

  const isEventAlert = [
    'earnings_announcement',
    'dividend_ex_date',
    'dividend_payment',
    'reminder',
    'daily_reminder',
  ].includes(condition);

  if (isFundamentalAlert) {
    return {
      targetLabel: 'Target Ratio',
      currentLabel: 'Current Ratio',
      showStockPrice: true,
    };
  } else if (isRSIAlert) {
    return {
      targetLabel: 'RSI Threshold',
      currentLabel: 'Current RSI',
      showStockPrice: true,
    };
  } else if (isPercentageAlert) {
    return {
      targetLabel: 'Threshold',
      currentLabel: 'Change',
      showStockPrice: true,
    };
  } else if (is52WeekAlert) {
    return {
      targetLabel: '52-Week Range',
      currentLabel: 'Current Price',
      showStockPrice: false,
      hideThreshold: true,
    };
  } else if (isMovingAverageAlert) {
    if (condition.includes('crossover')) {
      return {
        targetLabel: 'Signal',
        currentLabel: 'Current Price',
        showStockPrice: false,
      };
    } else {
      return {
        targetLabel: 'MA Level',
        currentLabel: 'Current Price',
        showStockPrice: false,
      };
    }
  } else if (isEventAlert) {
    return {
      targetLabel: 'Event',
      currentLabel: 'Status',
      showStockPrice: true,
      hideThreshold: true,
    };
  } else {
    // Price alerts
    return {
      targetLabel: 'Target Price',
      currentLabel: 'Current Price',
      showStockPrice: false,
    };
  }
}
