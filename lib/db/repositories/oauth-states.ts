import { eq, lt } from 'drizzle-orm';
import { db } from '../index';
import { oauthStates, type OAuthState, type NewOAuthState } from '../schema';
import * as crypto from 'crypto';

export class OAuthStateRepository {
  async create(metadata?: any): Promise<string> {
    const state = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db
      .insert(oauthStates)
      .values({
        state,
        metadata,
        expiresAt,
      });

    return state;
  }

  async verify(state: string): Promise<OAuthState | null> {
    // Get the state and delete it in one go (one-time use)
    const [oauthState] = await db
      .delete(oauthStates)
      .where(eq(oauthStates.state, state))
      .returning();

    if (!oauthState) {
      return null;
    }

    // Check if expired
    if (new Date() > oauthState.expiresAt) {
      return null;
    }

    return oauthState;
  }

  async cleanupExpired(): Promise<number> {
    const result = await db
      .delete(oauthStates)
      .where(lt(oauthStates.expiresAt, new Date()));

    return result.rowCount;
  }
}