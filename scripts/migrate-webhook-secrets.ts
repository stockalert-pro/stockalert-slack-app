import { db } from '../lib/db';
import { installations } from '../lib/db/schema';
import { generateWebhookSecret } from '../lib/utils';
import { sql } from 'drizzle-orm';

async function migrateWebhookSecrets() {
  console.log('Migrating webhook secrets for existing installations...');
  
  try {
    // Get all installations without webhook secret
    const installationsWithoutSecret = await db
      .select()
      .from(installations)
      .where(sql`${installations.webhookSecret} IS NULL`);
    
    console.log(`Found ${installationsWithoutSecret.length} installations without webhook secret`);
    
    // Generate and update webhook secret for each installation
    for (const installation of installationsWithoutSecret) {
      const webhookSecret = generateWebhookSecret();
      
      await db
        .update(installations)
        .set({ webhookSecret })
        .where(sql`${installations.id} = ${installation.id}`);
      
      console.log(`Generated webhook secret for team ${installation.teamId}`);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

migrateWebhookSecrets();