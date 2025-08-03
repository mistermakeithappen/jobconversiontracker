-- Migration: Add message processing fields to receipt_processing_log
-- Run this AFTER both receipt_processing_log and contact_sync migrations

-- Add missing fields to receipt_processing_log for message processing
DO $$
BEGIN
    -- Check if receipt_processing_log table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipt_processing_log') THEN
        -- Add message_id field if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'message_id') THEN
            ALTER TABLE receipt_processing_log ADD COLUMN message_id uuid;
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
        
        RAISE NOTICE 'Successfully added message processing fields to receipt_processing_log';
    ELSE
        RAISE EXCEPTION 'receipt_processing_log table does not exist. Please run the receipt processing migration first.';
    END IF;
END $$;

-- Add foreign key constraint after both tables exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipt_processing_log') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incoming_messages') THEN
        
        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_receipt_processing_log_message_id'
        ) THEN
            ALTER TABLE receipt_processing_log 
            ADD CONSTRAINT fk_receipt_processing_log_message_id 
            FOREIGN KEY (message_id) REFERENCES incoming_messages(id) ON DELETE SET NULL;
        END IF;
        
        RAISE NOTICE 'Successfully added foreign key constraint for message_id';
    END IF;
END $$;