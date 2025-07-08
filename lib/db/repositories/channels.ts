import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { channels, type Channel, type NewChannel } from '../schema';

export class ChannelRepository {
  async create(data: NewChannel): Promise<Channel> {
    const result = await db
      .insert(channels)
      .values(data)
      .onConflictDoUpdate({
        target: [channels.teamId, channels.channelId],
        set: {
          channelName: data.channelName,
          isDefault: data.isDefault,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!result.length || !result[0]) {
      throw new Error('Failed to create channel');
    }

    return result[0];
  }

  async findByTeamId(teamId: string): Promise<Channel[]> {
    return db.select().from(channels).where(eq(channels.teamId, teamId));
  }

  async findDefaultChannel(teamId: string): Promise<Channel | null> {
    const [channel] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.teamId, teamId), eq(channels.isDefault, true)))
      .limit(1);

    return channel || null;
  }

  async setDefaultChannel(teamId: string, channelId: string): Promise<Channel | null> {
    // First, unset all default channels for this team
    await db
      .update(channels)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(channels.teamId, teamId));

    // Then set the new default
    const [updated] = await db
      .update(channels)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(channels.teamId, teamId), eq(channels.channelId, channelId)))
      .returning();

    return updated || null;
  }

  async delete(teamId: string, channelId: string): Promise<boolean> {
    const result = await db
      .delete(channels)
      .where(and(eq(channels.teamId, teamId), eq(channels.channelId, channelId)));

    return (result.rowCount ?? 0) > 0;
  }
}
