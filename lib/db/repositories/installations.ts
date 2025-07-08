import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { installations, type Installation, type NewInstallation } from '../schema';
export class InstallationRepository {
  async create(data: NewInstallation): Promise<Installation> {
    const [installation] = await db
      .insert(installations)
      .values(data)
      .onConflictDoUpdate({
        target: [installations.teamId, installations.enterpriseId],
        set: {
          teamName: data.teamName,
          botToken: data.botToken,
          botId: data.botId,
          botUserId: data.botUserId,
          appId: data.appId,
          installerUserId: data.installerUserId,
          scope: data.scope,
          tokenType: data.tokenType,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return installation;
  }

  async findByTeamId(teamId: string, enterpriseId?: string): Promise<Installation | null> {
    const conditions = enterpriseId 
      ? and(eq(installations.teamId, teamId), eq(installations.enterpriseId, enterpriseId))
      : and(eq(installations.teamId, teamId));

    const [installation] = await db
      .select()
      .from(installations)
      .where(conditions)
      .limit(1);

    return installation || null;
  }

  async update(teamId: string, data: Partial<NewInstallation>): Promise<Installation | null> {
    const [updated] = await db
      .update(installations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(installations.teamId, teamId))
      .returning();

    return updated || null;
  }

  async delete(teamId: string): Promise<boolean> {
    const result = await db
      .delete(installations)
      .where(eq(installations.teamId, teamId));

    return result.rowCount > 0;
  }

  async listAll(): Promise<Installation[]> {
    return db.select().from(installations);
  }
}