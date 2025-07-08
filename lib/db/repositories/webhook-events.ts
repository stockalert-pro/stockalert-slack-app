import { eq, and, isNull, isNotNull, desc, lt } from 'drizzle-orm';
import { db } from '../index';
import { webhookEvents, type WebhookEvent, type NewWebhookEvent } from '../schema';

export class WebhookEventRepository {
  async create(data: NewWebhookEvent): Promise<WebhookEvent | null> {
    try {
      const result = await db.insert(webhookEvents).values(data).returning();

      if (!result.length || !result[0]) {
        return null;
      }

      return result[0];
    } catch (error) {
      // Handle duplicate event ID (idempotency)
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Record<string, unknown>).code === '23505'
      ) {
        // PostgreSQL unique violation
        return null;
      }
      throw error;
    }
  }

  async markProcessed(eventId: string): Promise<WebhookEvent | null> {
    const result = await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.eventId, eventId))
      .returning();

    return result[0] || null;
  }

  async findByEventId(eventId: string): Promise<WebhookEvent | null> {
    const result = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId))
      .limit(1);

    return result[0] || null;
  }

  async findUnprocessed(limit = 100): Promise<WebhookEvent[]> {
    return db
      .select()
      .from(webhookEvents)
      .where(isNull(webhookEvents.processedAt))
      .orderBy(webhookEvents.createdAt)
      .limit(limit);
  }

  async findByTeamId(teamId: string, limit = 50): Promise<WebhookEvent[]> {
    return db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.teamId, teamId))
      .orderBy(desc(webhookEvents.createdAt))
      .limit(limit);
  }

  async cleanup(olderThan: Date): Promise<number> {
    const result = await db
      .delete(webhookEvents)
      .where(and(lt(webhookEvents.createdAt, olderThan), isNotNull(webhookEvents.processedAt)));

    return result.rowCount ?? 0;
  }
}
