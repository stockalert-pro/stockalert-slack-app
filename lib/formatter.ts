import { AlertEvent } from './types';
import { KnownBlock } from '@slack/web-api';
import { formatSlackAlert } from './slack-formatter';

export function formatAlertMessage(event: AlertEvent): {
  text: string;
  blocks: KnownBlock[];
} {
  // Use the new Slack formatter that follows the specification
  return formatSlackAlert(event);
}
