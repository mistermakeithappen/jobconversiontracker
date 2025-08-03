import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuthTrigger() {
  console.log('Checking if auth trigger exists...\n');

  try {
    // Check if the trigger exists
    const { data: triggers, error: triggerError } = await supabase
      .from('pg_trigger')
      .select('*')
      .eq('tgname', 'on_auth_user_created')
      .single();

    if (triggerError && triggerError.code !== 'PGRST116') {
      console.error('Error checking trigger:', triggerError);
      return;
    }

    if (triggers) {
      console.log('✅ Trigger "on_auth_user_created" exists');
    } else {
      console.log('❌ Trigger "on_auth_user_created" does NOT exist');
      console.log('\nThe trigger needs to be created. Run the migration:');
      console.log('npm run setup-db');
    }

    // Check if the function exists
    const { data: functions, error: funcError } = await supabase.rpc('to_regproc', {
      funcname: 'public.handle_new_user'
    });

    if (!funcError && functions) {
      console.log('✅ Function "handle_new_user" exists');
    } else {
      console.log('❌ Function "handle_new_user" does NOT exist');
    }

    // Check for any recent users without organizations
    const { data: orphanedUsers, error: orphanError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        created_at,
        organization_members!left(organization_id)
      `)
      .is('organization_members.organization_id', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!orphanError && orphanedUsers && orphanedUsers.length > 0) {
      console.log(`\n⚠️  Found ${orphanedUsers.length} users without organizations:`);
      orphanedUsers.forEach(user => {
        console.log(`  - ${user.email} (created: ${new Date(user.created_at).toLocaleString()})`);
      });
    } else {
      console.log('\n✅ No orphaned users found');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAuthTrigger();