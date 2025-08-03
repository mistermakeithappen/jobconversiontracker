import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

async function testContactSync() {
  try {
    console.log('🚀 Starting contact sync test...');
    console.log('=' .repeat(80));
    
    // Trigger sync
    console.log('\n📤 Triggering contact sync...');
    const syncResponse = await fetch(`${appUrl}/api/ghl/contacts/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!syncResponse.ok) {
      const error = await syncResponse.text();
      console.error('❌ Sync request failed:', error);
      return;
    }

    const syncData = await syncResponse.json();
    console.log('✅ Sync started:', syncData);
    
    const syncLogId = syncData.syncLogId;
    if (!syncLogId) {
      console.log('⚠️  No sync log ID returned');
      return;
    }

    // Poll for sync status
    console.log('\n⏳ Checking sync status...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5 second intervals
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`${appUrl}/api/ghl/contacts/sync?syncLogId=${syncLogId}`);
      if (!statusResponse.ok) {
        console.error('❌ Failed to check status');
        break;
      }
      
      const status = await statusResponse.json();
      
      process.stdout.write(`\r📊 Status: ${status.status} | Processed: ${status.contacts_processed || 0} | Created: ${status.contacts_created || 0} | Updated: ${status.contacts_updated || 0}`);
      
      if (status.status === 'completed' || status.status === 'failed') {
        console.log('\n');
        if (status.status === 'completed') {
          console.log('✅ Sync completed successfully!');
          console.log(`   Total processed: ${status.contacts_processed}`);
          console.log(`   Created: ${status.contacts_created}`);
          console.log(`   Updated: ${status.contacts_updated}`);
        } else {
          console.log('❌ Sync failed!');
          console.log(`   Error: ${status.error_message}`);
        }
        break;
      }
      
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n⏱️  Sync is taking longer than expected. Check the logs for details.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testContactSync();