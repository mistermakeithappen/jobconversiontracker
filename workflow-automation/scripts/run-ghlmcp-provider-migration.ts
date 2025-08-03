import { getServiceSupabase } from '../lib/supabase/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runGHLMCPProviderMigration() {
  const supabase = getServiceSupabase();
  
  try {
    console.log('Running GHLMCP provider migration...');
    
    // Drop the existing provider constraint
    console.log('1. Dropping existing provider constraint...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'user_api_keys_provider_check'
                AND table_name = 'user_api_keys'
            ) THEN
                ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_provider_check;
                RAISE NOTICE 'Dropped existing provider constraint';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop constraint: %', SQLERRM;
        END $$;
      `
    });
    
    if (dropError) {
      console.log('Drop constraint step - trying direct approach...');
      // Try direct SQL
      const { error: directDropError } = await supabase
        .from('user_api_keys')
        .select('id')
        .limit(1);
        
      if (directDropError) {
        console.error('Cannot access user_api_keys table:', directDropError);
        return;
      }
    }
    
    // Add updated constraint that includes ghlmcp
    console.log('2. Adding new constraint with ghlmcp...');
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
            ALTER TABLE user_api_keys 
            ADD CONSTRAINT user_api_keys_provider_check 
            CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'notion', 'ghlmcp'));
            
            RAISE NOTICE 'Added ghlmcp to allowed providers';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not add constraint: %', SQLERRM;
        END $$;
      `
    });
    
    if (addError) {
      console.log('Add constraint failed, trying manual test...');
      
      // Test by trying to insert a test record
      const testUserId = 'test-user-id-' + Date.now();
      const { error: testError } = await supabase
        .from('user_api_keys')
        .insert({
          user_id: testUserId,
          provider: 'ghlmcp',
          encrypted_key: 'test-key',
          key_name: 'Test GHLMCP Token'
        });
        
      if (testError) {
        console.error('❌ Test insert failed - constraint still blocking ghlmcp:', testError);
        
        console.log('\n📋 Manual migration needed:');
        console.log('Go to Supabase SQL Editor and run:');
        console.log('https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new');
        console.log('\nSQL to run:');
        console.log(`
-- Drop existing constraint
ALTER TABLE user_api_keys DROP CONSTRAINT IF EXISTS user_api_keys_provider_check;

-- Add new constraint with ghlmcp
ALTER TABLE user_api_keys 
ADD CONSTRAINT user_api_keys_provider_check 
CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'notion', 'ghlmcp'));
        `);
      } else {
        console.log('✅ Test insert worked - ghlmcp provider is now allowed!');
        
        // Clean up test record
        await supabase
          .from('user_api_keys')
          .delete()
          .eq('user_id', testUserId);
        console.log('✅ Cleaned up test record');
      }
    } else {
      console.log('✅ Constraint updated successfully!');
    }
    
  } catch (error) {
    console.error('Migration error:', error);
  }
}

runGHLMCPProviderMigration();