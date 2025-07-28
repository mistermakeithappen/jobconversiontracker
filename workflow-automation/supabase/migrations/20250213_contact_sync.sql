-- Migration: Contact synchronization system
-- Creates tables for syncing and storing GHL contacts for message processing

-- Table: synced_contacts
-- Stores contacts from all connected GHL integrations
CREATE TABLE IF NOT EXISTS synced_contacts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    ghl_contact_id text NOT NULL,
    ghl_location_id text NOT NULL,
    
    -- Contact information
    first_name text,
    last_name text,
    full_name text,
    email text,
    phone text,
    phone_normalized text, -- Normalized phone number for lookup (+1234567890)
    
    -- Additional GHL data
    tags text[],
    status text,
    source text,
    date_added timestamp with time zone,
    date_updated timestamp with time zone,
    
    -- Sync metadata
    synced_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Ensure unique contact per integration
    UNIQUE(integration_id, ghl_contact_id)
);

-- Function to normalize phone numbers for consistent lookup
CREATE OR REPLACE FUNCTION normalize_phone_number(phone_input text)
RETURNS text AS $$
BEGIN
    -- Remove all non-digit characters
    phone_input := regexp_replace(phone_input, '[^0-9]', '', 'g');
    
    -- Handle US phone numbers
    IF length(phone_input) = 10 THEN
        -- Add +1 prefix for 10-digit US numbers
        RETURN '+1' || phone_input;
    ELSIF length(phone_input) = 11 AND left(phone_input, 1) = '1' THEN
        -- Add + prefix for 11-digit numbers starting with 1
        RETURN '+' || phone_input;
    ELSIF length(phone_input) > 0 THEN
        -- Keep as is for international numbers, just add + if missing
        IF left(phone_input, 1) != '+' THEN
            RETURN '+' || phone_input;
        END IF;
        RETURN phone_input;
    END IF;
    
    -- Return null for invalid/empty numbers
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-normalize phone numbers
CREATE OR REPLACE FUNCTION update_normalized_phone()
RETURNS trigger AS $$
BEGIN
    NEW.phone_normalized := normalize_phone_number(NEW.phone);
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_phone_contact
    BEFORE INSERT OR UPDATE ON synced_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_normalized_phone();

-- Create indexes after table creation
CREATE INDEX IF NOT EXISTS idx_synced_contacts_phone_normalized ON synced_contacts (phone_normalized);
CREATE INDEX IF NOT EXISTS idx_synced_contacts_user_id ON synced_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_synced_contacts_integration_id ON synced_contacts (integration_id);

-- Table: contact_sync_jobs
-- Tracks contact synchronization jobs and status
CREATE TABLE IF NOT EXISTS contact_sync_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    
    -- Job status
    status text NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    
    -- Results
    contacts_fetched integer DEFAULT 0,
    contacts_created integer DEFAULT 0,
    contacts_updated integer DEFAULT 0,
    error_message text,
    
    -- Metadata
    created_at timestamp with time zone DEFAULT now()
);

-- Table: incoming_messages
-- Stores incoming messages from GHL webhooks for processing
CREATE TABLE IF NOT EXISTS incoming_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES synced_contacts(id) ON DELETE SET NULL,
    
    -- Message details
    ghl_message_id text UNIQUE,
    ghl_conversation_id text,
    ghl_contact_id text,
    phone_number text,
    phone_normalized text,
    
    -- Message content
    message_type text NOT NULL, -- sms, mms, email, etc.
    body text,
    attachments jsonb, -- Array of attachment objects
    direction text NOT NULL, -- inbound, outbound
    
    -- Processing status
    processed boolean DEFAULT false,
    has_receipt boolean DEFAULT false,
    receipt_processed boolean DEFAULT false,
    processing_error text,
    
    -- GHL metadata
    ghl_created_at timestamp with time zone,
    received_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone
);

-- Function to lookup contact by phone number
CREATE OR REPLACE FUNCTION lookup_contact_by_phone(user_id_param uuid, phone_param text)
RETURNS uuid AS $$
DECLARE
    contact_uuid uuid;
    normalized_phone text;
BEGIN
    -- Normalize the phone number
    normalized_phone := normalize_phone_number(phone_param);
    
    IF normalized_phone IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Look up contact by normalized phone
    SELECT id INTO contact_uuid
    FROM synced_contacts
    WHERE user_id = user_id_param 
      AND phone_normalized = normalized_phone
    LIMIT 1;
    
    RETURN contact_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-normalize phone numbers in incoming messages and lookup contact
CREATE OR REPLACE FUNCTION process_incoming_message()
RETURNS trigger AS $$
BEGIN
    -- Normalize phone number
    NEW.phone_normalized := normalize_phone_number(NEW.phone_number);
    
    -- Lookup contact if not already set
    IF NEW.contact_id IS NULL AND NEW.phone_normalized IS NOT NULL THEN
        NEW.contact_id := lookup_contact_by_phone(NEW.user_id, NEW.phone_number);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_process_incoming_message
    BEFORE INSERT OR UPDATE ON incoming_messages
    FOR EACH ROW
    EXECUTE FUNCTION process_incoming_message();

-- Create indexes for contact_sync_jobs
CREATE INDEX IF NOT EXISTS idx_contact_sync_jobs_user_id ON contact_sync_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_contact_sync_jobs_status ON contact_sync_jobs (status);
CREATE INDEX IF NOT EXISTS idx_contact_sync_jobs_integration_id ON contact_sync_jobs (integration_id);

-- Create indexes for incoming_messages
CREATE INDEX IF NOT EXISTS idx_incoming_messages_phone_normalized ON incoming_messages (phone_normalized);
CREATE INDEX IF NOT EXISTS idx_incoming_messages_contact_id ON incoming_messages (contact_id);
CREATE INDEX IF NOT EXISTS idx_incoming_messages_processed ON incoming_messages (processed);
CREATE INDEX IF NOT EXISTS idx_incoming_messages_has_receipt ON incoming_messages (has_receipt);
CREATE INDEX IF NOT EXISTS idx_incoming_messages_user_id ON incoming_messages (user_id);

-- RLS Policies
ALTER TABLE synced_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_messages ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY synced_contacts_user_policy ON synced_contacts
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY contact_sync_jobs_user_policy ON contact_sync_jobs
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY incoming_messages_user_policy ON incoming_messages
    FOR ALL USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON synced_contacts TO authenticated;
GRANT ALL ON contact_sync_jobs TO authenticated;
GRANT ALL ON incoming_messages TO authenticated;

-- Add missing fields to receipt_processing_log for message processing (only if table exists)
DO $$
BEGIN
    -- Check if receipt_processing_log table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipt_processing_log') THEN
        -- Add message_id field if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'message_id') THEN
            ALTER TABLE receipt_processing_log ADD COLUMN message_id uuid REFERENCES incoming_messages(id) ON DELETE SET NULL;
        END IF;
        
        -- Add attachment_id field if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'attachment_id') THEN
            ALTER TABLE receipt_processing_log ADD COLUMN attachment_id text;
        END IF;
        
        -- Add response fields if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'response_sent') THEN
            ALTER TABLE receipt_processing_log ADD COLUMN response_sent boolean DEFAULT false;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'response_sent_at') THEN
            ALTER TABLE receipt_processing_log ADD COLUMN response_sent_at timestamp with time zone;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'response_error') THEN
            ALTER TABLE receipt_processing_log ADD COLUMN response_error text;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'ghl_message_response') THEN
            ALTER TABLE receipt_processing_log ADD COLUMN ghl_message_response jsonb;
        END IF;
    ELSE
        RAISE NOTICE 'receipt_processing_log table does not exist - skipping field additions. Please run receipt processing migration first.';
    END IF;
END $$;

-- Comments
COMMENT ON TABLE synced_contacts IS 'Stores synchronized contacts from GHL integrations for message processing';
COMMENT ON TABLE contact_sync_jobs IS 'Tracks contact synchronization job status and results';
COMMENT ON TABLE incoming_messages IS 'Stores incoming messages from GHL webhooks for receipt processing';
COMMENT ON FUNCTION normalize_phone_number IS 'Normalizes phone numbers to +1XXXXXXXXXX format for consistent lookup';
COMMENT ON FUNCTION lookup_contact_by_phone IS 'Looks up a synced contact by normalized phone number';