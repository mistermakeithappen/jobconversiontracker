import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function createProductsTable() {
  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  console.log('Creating ghl_products table...\n');
  
  // Read the migration file
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20250229_sales_tracking_system.sql');
  const migrationContent = readFileSync(migrationPath, 'utf8');
  
  // Execute just the ghl_products table creation part
  const createTableSQL = `
-- First, ensure we have the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create GHL Products table for syncing products from GoHighLevel
CREATE TABLE IF NOT EXISTS ghl_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  ghl_product_id VARCHAR NOT NULL,
  
  -- Product details
  name VARCHAR NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  price_type VARCHAR(50) CHECK (price_type IN ('one_time', 'recurring')),
  recurring_interval VARCHAR(50) CHECK (recurring_interval IN ('daily', 'weekly', 'monthly', 'yearly', NULL)),
  recurring_interval_count INTEGER DEFAULT 1,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Status and metadata
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique products per integration
  UNIQUE(integration_id, ghl_product_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ghl_products_user_id ON ghl_products(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_products_integration_id ON ghl_products(integration_id);
CREATE INDEX IF NOT EXISTS idx_ghl_products_ghl_product_id ON ghl_products(ghl_product_id);
CREATE INDEX IF NOT EXISTS idx_ghl_products_active ON ghl_products(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_ghl_products_updated_at 
  BEFORE UPDATE ON ghl_products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ghl_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Users can view their own products" ON ghl_products
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can manage their own products" ON ghl_products
  FOR ALL USING (user_id = auth.uid());

-- Table comment
COMMENT ON TABLE ghl_products IS 'Stores products synced from GoHighLevel for sales tracking';
`;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (error) {
      console.error('Error creating ghl_products table:', error);
      
      // Try direct SQL execution as fallback
      console.log('Trying direct execution...');
      
      // Split into individual statements and execute
      const statements = createTableSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
        
      for (const statement of statements) {
        if (statement.includes('CREATE') || statement.includes('ALTER') || statement.includes('COMMENT')) {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (stmtError) {
            console.log(`  Error: ${stmtError.message}`);
          } else {
            console.log(`  ✓ Success`);
          }
        }
      }
    } else {
      console.log('✓ ghl_products table created successfully');
    }
  } catch (error) {
    console.error('Failed to create table:', error);
    
    console.log('\nPlease run this SQL in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new\n');
    console.log(createTableSQL);
  }
  
  // Verify table exists
  try {
    const { data, error } = await supabase
      .from('ghl_products')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Table verification failed:', error);
    } else {
      console.log('✓ Table verified - ghl_products exists and is accessible');
    }
  } catch (error) {
    console.error('Table verification error:', error);
  }
}

createProductsTable().catch(console.error);