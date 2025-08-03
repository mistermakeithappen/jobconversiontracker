import * as dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config({ path: '.env.local' });

// Now import after env vars are loaded
import { fetchCalendars } from '../lib/integrations/gohighlevel/workflow-helpers';

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function testCalendarFetch() {
  console.log('🔍 Testing calendar fetch for user:', mockUserId);
  
  try {
    const calendars = await fetchCalendars(mockUserId);
    
    console.log('\n📅 Fetched calendars:', calendars.length);
    
    if (calendars.length > 0) {
      console.log('\nCalendar details:');
      calendars.forEach((cal: any, index: number) => {
        console.log(`\n${index + 1}. ${cal.name} (${cal.id})`);
        console.log(`   Type: ${cal.calendarType || 'N/A'}`);
        console.log(`   Widget Type: ${cal.widgetType || 'N/A'}`);
        console.log(`   Description: ${cal.description || 'N/A'}`);
        console.log(`   Active: ${cal.isActive}`);
      });
    } else {
      console.log('\n❌ No calendars found');
      console.log('This could mean:');
      console.log('1. The location has no calendars configured');
      console.log('2. The location_id is not available');
      console.log('3. The API endpoint is not accessible');
    }
  } catch (error) {
    console.error('\n❌ Error fetching calendars:', error);
  }
}

// Run the test
testCalendarFetch().catch(console.error);