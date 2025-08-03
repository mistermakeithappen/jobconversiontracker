const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function createTable() {
  console.log('🚀 Creating ghl_user_commissions table...');
  
  // Since we can't run raw SQL directly, let's verify if table exists by trying to query it
  const { data: testData, error: testError } = await supabase
    .from('ghl_user_commissions')
    .select('id')
    .limit(1);
  
  if (!testError || testError.code !== '42P01') {
    console.log('✅ Table ghl_user_commissions already exists!');
    return;
  }
  
  console.log('❌ Table does not exist. Please run the following SQL in Supabase dashboard:');
  console.log('\n📋 SQL to run in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new\n');
  
  const sql = `-- Create table for storing GoHighLevel user commission defaults
CREATE TABLE IF NOT EXISTS ghl_user_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  ghl_user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  user_email VARCHAR NOT NULL,
  
  -- One-time sale commission settings
  commission_type VARCHAR(50) NOT NULL DEFAULT 'gross',
  commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 10 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  
  -- Subscription/recurring commission settings
  subscription_commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 5 CHECK (subscription_commission_percentage >= 0 AND subscription_commission_percentage <= 100),
  subscription_commission_type VARCHAR(50) NOT NULL DEFAULT 'first_payment_only',
  subscription_duration_months INTEGER DEFAULT 12,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique user per integration
  UNIQUE(integration_id, ghl_user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ghl_user_commissions_user_id ON ghl_user_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_user_commissions_integration_id ON ghl_user_commissions(integration_id);
CREATE INDEX IF NOT EXISTS idx_ghl_user_commissions_ghl_user_id ON ghl_user_commissions(ghl_user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_user_commissions_active ON ghl_user_commissions(is_active) WHERE is_active = true;

-- Create updated_at trigger
CREATE TRIGGER update_ghl_user_commissions_updated_at 
    BEFORE UPDATE ON ghl_user_commissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE ghl_user_commissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for mock auth
CREATE POLICY "Users can view their own GHL user commissions" ON ghl_user_commissions
    FOR SELECT USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');

CREATE POLICY "Users can manage their own GHL user commissions" ON ghl_user_commissions
    FOR ALL USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');`;
  
  console.log(sql);
}

createTable();