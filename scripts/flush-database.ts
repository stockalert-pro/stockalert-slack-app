import { sql } from '@vercel/postgres';

async function flushDatabase() {
  try {
    console.log('🗑️  Flushing database...');
    
    // Delete all webhook events first (foreign key constraint)
    const eventsResult = await sql`DELETE FROM webhook_events`;
    console.log(`✅ Deleted ${eventsResult.rowCount} webhook events`);
    
    // Delete all channels
    const channelsResult = await sql`DELETE FROM slack_channels`;
    console.log(`✅ Deleted ${channelsResult.rowCount} channels`);
    
    // Delete all installations
    const installationsResult = await sql`DELETE FROM slack_installations`;
    console.log(`✅ Deleted ${installationsResult.rowCount} installations`);
    
    console.log('\n🎉 Database flushed successfully!');
    console.log('You can now reinstall the Slack app and go through the onboarding process again.');
    
  } catch (error) {
    console.error('❌ Error flushing database:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the flush
flushDatabase();