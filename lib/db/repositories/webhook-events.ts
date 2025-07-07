import { eq, and, isNull, isNotNull, desc, lt } from 'drizzle-orm';
import { db } from '../index';
import { webhookEvents, type WebhookEvent, type NewWebhookEvent } from '../schema';

export class WebhookEventRepository {
  async create(data: NewWebhookEvent): Promise<WebhookEvent | null> {
    try {
      const [event] = await db
        .insert(webhookEvents)
        .values(data)
        .returning();
      
      return event;
    } catch (error: any) {
      // Handle duplicate event ID (idempotency)
      if (error.code === '23505') { // PostgreSQL unique violation
        return null;
      }
      throw error;
    }
  }

  async markProcessed(eventId: string): Promise<WebhookEvent | null> {
    const [updated] = await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.eventId, eventId))
      .returning();

    return updated || null;
  }

  async findByEventId(eventId: string): Promise<WebhookEvent | null> {
    const [event] = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId))
      .limit(1);

    return event || null;
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
      .where(and(
        lt(webhookEvents.createdAt, olderThan),
        isNotNull(webhookEvents.processedAt)
      ));

    return result.rowCount;
  }
}