import { pgTable, serial, text, timestamp, jsonb, unique, index } from 'drizzle-orm/pg-core';

export const installations = pgTable('slack_installations', {
  id: serial('id').primaryKey(),
  teamId: text('team_id').notNull(),
  teamName: text('team_name'),
  botToken: text('bot_token').notNull(),
  botId: text('bot_id').notNull(),
  botUserId: text('bot_user_id').notNull(),
  appId: text('app_id').notNull(),
  enterpriseId: text('enterprise_id'),
  enterpriseName: text('enterprise_name'),
  installerUserId: text('installer_user_id'),
  scope: text('scope'),
  tokenType: text('token_type').default('bot'),
  webhookSecret: text('webhook_secret'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  teamIdUnique: unique().on(table.teamId, table.enterpriseId),
  teamIdIndex: index('team_id_idx').on(table.teamId),
}));

export const channels = pgTable('slack_channels', {
  id: serial('id').primaryKey(),
  teamId: text('team_id').notNull(),
  channelId: text('channel_id').notNull(),
  channelName: text('channel_name'),
  isDefault: text('is_default').default('false'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  teamChannelUnique: unique().on(table.teamId, table.channelId),
  teamIdIndex: index('channel_team_id_idx').on(table.teamId),
}));

export const oauthStates = pgTable('oauth_states', {
  id: serial('id').primaryKey(),
  state: text('state').notNull().unique(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  stateIndex: index('state_idx').on(table.state),
  expiresAtIndex: index('expires_at_idx').on(table.expiresAt),
}));

export const webhookEvents = pgTable('webhook_events', {
  id: serial('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  teamId: text('team_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventIdIndex: index('event_id_idx').on(table.eventId),
  teamIdIndex: index('webhook_team_id_idx').on(table.teamId),
  createdAtIndex: index('created_at_idx').on(table.createdAt),
}));

export type Installation = typeof installations.$inferSelect;
export type NewInstallation = typeof installations.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type OAuthState = typeof oauthStates.$inferSelect;
export type NewOAuthState = typeof oauthStates.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;