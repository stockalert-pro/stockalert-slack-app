export { InstallationRepository } from './installations';
export { ChannelRepository } from './channels';
export { OAuthStateRepository } from './oauth-states';
export { WebhookEventRepository } from './webhook-events';

// Singleton instances
import { InstallationRepository } from './installations';
import { ChannelRepository } from './channels';
import { OAuthStateRepository } from './oauth-states';
import { WebhookEventRepository } from './webhook-events';

// Run auto-migrations when repositories are first accessed
import('../auto-migrate').catch((error) => {
  console.error('[DB] Failed to run auto-migrations:', error);
});

export const installationRepo = new InstallationRepository();
export const channelRepo = new ChannelRepository();
export const oauthStateRepo = new OAuthStateRepository();
export const webhookEventRepo = new WebhookEventRepository();
