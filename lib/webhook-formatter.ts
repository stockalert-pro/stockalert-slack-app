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

  // Format threshold and current values
  let thresholdFormatted = '';
  let currentValueFormatted = '';

  if (isFundamentalAlert) {
    thresholdFormatted = data.threshold.toFixed(2);
    // Use the specific ratio value if available, otherwise fall back
    const ratioValue = displayValue ?? data.current_value;
    currentValueFormatted = ratioValue.toFixed(2);
  } else if (isRSIAlert) {
    thresholdFormatted = data.threshold.toFixed(2);
    currentValueFormatted = data.current_value.toFixed(2);
  } else if (isPercentageAlert) {
    thresholdFormatted = `${data.threshold}%`;
    currentValueFormatted = `${data.current_value}%`;
  } else {
    // Price alerts
    thresholdFormatted = `$${data.threshold.toFixed(2)}`;
    currentValueFormatted = `$${data.current_value.toFixed(2)}`;
  }

  // Calculate change text for non-fundamental alerts
  let changeText: string | undefined;
  if (!isFundamentalAlert && !isPercentageAlert && data.threshold !== 0) {
    const changePercent = (((data.current_value - data.threshold) / data.threshold) * 100).toFixed(
      2
    );
    changeText = changePercent.startsWith('-') ? `(${changePercent}%)` : `(+${changePercent}%)`;
  }

  return {
    ...baseData,
    displayValue,
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
} {
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
  } else {
    return {
      targetLabel: 'Target',
      currentLabel: 'Current',
      showStockPrice: false,
    };
  }
}
