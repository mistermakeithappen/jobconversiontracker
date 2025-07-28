-- Safe Receipt Tracking Migration
-- Creates receipt tracking tables only if they don't exist

-- Create table for tracking receipts/expenses for opportunities
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunity_receipts') THEN
        CREATE TABLE opportunity_receipts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL,
          opportunity_id TEXT NOT NULL, -- GHL opportunity ID
          integration_id UUID NOT NULL,
          
          -- Receipt details
          vendor_name TEXT NOT NULL,
          description TEXT,
          amount DECIMAL(10, 2) NOT NULL,
          category TEXT NOT NULL, -- materials, labor, equipment, etc.
          receipt_date DATE NOT NULL,
          receipt_number TEXT,
          
          -- File storage
          receipt_url TEXT, -- URL to uploaded receipt image/pdf
          receipt_filename TEXT,
          
          -- Metadata
          notes TEXT,
          tags TEXT[], -- Array of tags for categorization
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );
        RAISE NOTICE 'Created opportunity_receipts table';
    ELSE
        RAISE NOTICE 'opportunity_receipts table already exists';
    END IF;
END $$;

-- Create table for caching opportunity data with profitability metrics
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunity_cache') THEN
        CREATE TABLE opportunity_cache (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL,
          opportunity_id TEXT NOT NULL UNIQUE, -- GHL opportunity ID
          integration_id UUID NOT NULL,
          
          -- GHL opportunity data
          name TEXT NOT NULL,
          contact_id TEXT,
          contact_name TEXT,
          pipeline_id TEXT NOT NULL,
          pipeline_name TEXT,
          pipeline_stage_id TEXT,
          pipeline_stage_name TEXT,
          status TEXT,
          monetary_value DECIMAL(10, 2),
          
          -- Profitability tracking
          total_expenses DECIMAL(10, 2) DEFAULT 0,
          net_profit DECIMAL(10, 2) GENERATED ALWAYS AS (COALESCE(monetary_value, 0) - COALESCE(total_expenses, 0)) STORED,
          profit_margin DECIMAL(5, 2) GENERATED ALWAYS AS (
            CASE 
              WHEN COALESCE(monetary_value, 0) = 0 THEN 0
              ELSE ((COALESCE(monetary_value, 0) - COALESCE(total_expenses, 0)) / COALESCE(monetary_value, 0)) * 100
            END
          ) STORED,
          
          -- GHL timestamps
          ghl_created_at TIMESTAMP WITH TIME ZONE,
          ghl_updated_at TIMESTAMP WITH TIME ZONE,
          
          -- Local timestamps
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );
        RAISE NOTICE 'Created opportunity_cache table';
    ELSE
        RAISE NOTICE 'opportunity_cache table already exists';
    END IF;
END $$;

-- Create indexes safely
CREATE INDEX IF NOT EXISTS idx_opportunity_receipts_user_id ON opportunity_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_receipts_opportunity_id ON opportunity_receipts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_receipts_integration_id ON opportunity_receipts(integration_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_receipts_receipt_date ON opportunity_receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_opportunity_receipts_category ON opportunity_receipts(category);
CREATE INDEX IF NOT EXISTS idx_opportunity_receipts_created_at ON opportunity_receipts(created_at);

CREATE INDEX IF NOT EXISTS idx_opportunity_cache_user_id ON opportunity_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_opportunity_id ON opportunity_cache(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_integration_id ON opportunity_cache(integration_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_pipeline_id ON opportunity_cache(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_status ON opportunity_cache(status);
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_synced_at ON opportunity_cache(synced_at);

-- Create foreign key constraints safely
DO $$
BEGIN
    -- Check if auth.users table exists (Supabase default) or use alternative
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        -- Add foreign key to auth.users if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'opportunity_receipts_user_id_fkey'
        ) THEN
            ALTER TABLE opportunity_receipts ADD CONSTRAINT opportunity_receipts_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'opportunity_cache_user_id_fkey'
        ) THEN
            ALTER TABLE opportunity_cache ADD CONSTRAINT opportunity_cache_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    ELSE
        RAISE NOTICE 'auth.users table not found - skipping user_id foreign key constraints';
    END IF;
    
    -- Add integrations foreign key if integrations table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'opportunity_receipts_integration_id_fkey'
        ) THEN
            ALTER TABLE opportunity_receipts ADD CONSTRAINT opportunity_receipts_integration_id_fkey 
            FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'opportunity_cache_integration_id_fkey'
        ) THEN
            ALTER TABLE opportunity_cache ADD CONSTRAINT opportunity_cache_integration_id_fkey 
            FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE;
        END IF;
    ELSE
        RAISE NOTICE 'integrations table not found - skipping integration_id foreign key constraints';
    END IF;
END $$;

-- Create trigger function for updating total_expenses
CREATE OR REPLACE FUNCTION update_opportunity_total_expenses()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE opportunity_cache 
        SET total_expenses = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM opportunity_receipts 
            WHERE opportunity_id = NEW.opportunity_id
        ),
        updated_at = TIMEZONE('utc', NOW())
        WHERE opportunity_id = NEW.opportunity_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE opportunity_cache 
        SET total_expenses = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM opportunity_receipts 
            WHERE opportunity_id = OLD.opportunity_id
        ),
        updated_at = TIMEZONE('utc', NOW())
        WHERE opportunity_id = OLD.opportunity_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger safely
DROP TRIGGER IF EXISTS trigger_update_opportunity_expenses ON opportunity_receipts;
CREATE TRIGGER trigger_update_opportunity_expenses
    AFTER INSERT OR UPDATE OR DELETE ON opportunity_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_opportunity_total_expenses();

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update triggers safely
DROP TRIGGER IF EXISTS trigger_opportunity_receipts_updated_at ON opportunity_receipts;
CREATE TRIGGER trigger_opportunity_receipts_updated_at
    BEFORE UPDATE ON opportunity_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_opportunity_cache_updated_at ON opportunity_cache;
CREATE TRIGGER trigger_opportunity_cache_updated_at
    BEFORE UPDATE ON opportunity_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS safely
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunity_receipts') THEN
        ALTER TABLE opportunity_receipts ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunity_cache') THEN
        ALTER TABLE opportunity_cache ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create RLS policies safely
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own receipts" ON opportunity_receipts;
    DROP POLICY IF EXISTS "Users can insert their own receipts" ON opportunity_receipts;
    DROP POLICY IF EXISTS "Users can update their own receipts" ON opportunity_receipts;
    DROP POLICY IF EXISTS "Users can delete their own receipts" ON opportunity_receipts;
    
    DROP POLICY IF EXISTS "Users can view their own opportunity cache" ON opportunity_cache;
    DROP POLICY IF EXISTS "Users can insert their own opportunity cache" ON opportunity_cache;
    DROP POLICY IF EXISTS "Users can update their own opportunity cache" ON opportunity_cache;
    DROP POLICY IF EXISTS "Users can delete their own opportunity cache" ON opportunity_cache;
    
    -- Create new policies
    CREATE POLICY "Users can view their own receipts"
        ON opportunity_receipts FOR SELECT
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert their own receipts"
        ON opportunity_receipts FOR INSERT
        WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own receipts"
        ON opportunity_receipts FOR UPDATE
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own receipts"
        ON opportunity_receipts FOR DELETE
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can view their own opportunity cache"
        ON opportunity_cache FOR SELECT
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert their own opportunity cache"
        ON opportunity_cache FOR INSERT
        WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own opportunity cache"
        ON opportunity_cache FOR UPDATE
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own opportunity cache"
        ON opportunity_cache FOR DELETE
        USING (auth.uid() = user_id);
        
    RAISE NOTICE 'Created RLS policies for receipt tracking tables';
END $$;

-- Grant permissions
GRANT ALL ON opportunity_receipts TO authenticated;
GRANT ALL ON opportunity_cache TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add table comments
COMMENT ON TABLE opportunity_receipts IS 'Stores receipts and expenses for GoHighLevel opportunities';
COMMENT ON TABLE opportunity_cache IS 'Cached opportunity data with calculated profitability metrics';