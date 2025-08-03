-- Migration: Update receipt_processing_log for message processing
-- This updates the existing receipt_processing_log table to support the new message-based workflow

-- First, let's add the missing fields that the new message processing system expects
DO $$
BEGIN
    -- Add phone_number field (maps to user_phone but with consistent naming)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'phone_number') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN phone_number text;
    END IF;
    
    -- Add attachment_url field for storing image URLs from messages
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'attachment_url') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN attachment_url text;
    END IF;
    
    -- Add processing_status field (different from status - tracks AI processing steps)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'processing_status') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN processing_status text DEFAULT 'pending';
    END IF;
    
    -- Add message_id field for linking to incoming_messages
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'message_id') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN message_id uuid;
    END IF;
    
    -- Add attachment_id field for tracking specific attachments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'attachment_id') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN attachment_id text;
    END IF;
    
    -- Add extracted_data field for AI vision results
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'extracted_data') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN extracted_data jsonb;
    END IF;
    
    -- Add ai_response field for storing raw AI response
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'ai_response') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN ai_response text;
    END IF;
    
    -- Add potential_matches field (similar to job_matches but different structure)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'potential_matches') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN potential_matches jsonb DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add response_message field for the message sent to user
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'response_message') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN response_message text;
    END IF;
    
    -- Add response_sent boolean field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'response_sent') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN response_sent boolean DEFAULT false;
    END IF;
    
    -- Add response_sent_at timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'response_sent_at') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN response_sent_at timestamp with time zone;
    END IF;
    
    -- Add response_error field for tracking send failures
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'response_error') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN response_error text;
    END IF;
    
    -- Add ghl_message_response field for storing GHL API response
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'ghl_message_response') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN ghl_message_response jsonb;
    END IF;
    
    -- Add error_message field for processing errors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_processing_log' AND column_name = 'error_message') THEN
        ALTER TABLE receipt_processing_log ADD COLUMN error_message text;
    END IF;

    RAISE NOTICE 'Successfully added message processing fields to receipt_processing_log';
END $$;

-- Add foreign key constraint to link with incoming_messages (only if that table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incoming_messages') THEN
        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_receipt_processing_log_message_id'
        ) THEN
            ALTER TABLE receipt_processing_log 
            ADD CONSTRAINT fk_receipt_processing_log_message_id 
            FOREIGN KEY (message_id) REFERENCES incoming_messages(id) ON DELETE SET NULL;
            
            RAISE NOTICE 'Added foreign key constraint for message_id';
        END IF;
    ELSE
        RAISE NOTICE 'incoming_messages table not found - skipping foreign key constraint';
    END IF;
END $$;

-- Update the processing_status check constraint to include new values
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'receipt_processing_log_processing_status_check'
    ) THEN
        ALTER TABLE receipt_processing_log DROP CONSTRAINT receipt_processing_log_processing_status_check;
    END IF;
    
    -- Add new constraint with expanded values
    ALTER TABLE receipt_processing_log 
    ADD CONSTRAINT receipt_processing_log_processing_status_check 
    CHECK (processing_status IN (
        'pending', 'processing', 'extracted', 'matched', 'response_ready', 
        'response_sent', 'response_failed', 'error', 'completed'
    ));
    
    RAISE NOTICE 'Updated processing_status constraint with new values';
END $$;

-- Add indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_receipt_processing_log_phone_number ON receipt_processing_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_log_processing_status ON receipt_processing_log(processing_status);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_log_message_id ON receipt_processing_log(message_id);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_log_response_sent ON receipt_processing_log(response_sent);

-- Update table comment
COMMENT ON TABLE receipt_processing_log IS 'Stores AI receipt processing attempts, user interactions, and message-based workflows';

-- Add comments for new fields
COMMENT ON COLUMN receipt_processing_log.phone_number IS 'Phone number of user who sent the receipt';
COMMENT ON COLUMN receipt_processing_log.attachment_url IS 'URL of the receipt image attachment';
COMMENT ON COLUMN receipt_processing_log.processing_status IS 'Current step in the AI processing workflow';
COMMENT ON COLUMN receipt_processing_log.message_id IS 'Reference to the incoming message that triggered processing';
COMMENT ON COLUMN receipt_processing_log.attachment_id IS 'ID of the specific attachment being processed';
COMMENT ON COLUMN receipt_processing_log.extracted_data IS 'Data extracted from receipt by AI (vendor, amount, date, etc.)';
COMMENT ON COLUMN receipt_processing_log.ai_response IS 'Raw response from OpenAI Vision API';
COMMENT ON COLUMN receipt_processing_log.potential_matches IS 'Array of potential opportunity matches with confidence scores';
COMMENT ON COLUMN receipt_processing_log.response_message IS 'Message sent to user for confirmation';
COMMENT ON COLUMN receipt_processing_log.response_sent IS 'Whether the response message was successfully sent';
COMMENT ON COLUMN receipt_processing_log.response_sent_at IS 'Timestamp when response was sent';
COMMENT ON COLUMN receipt_processing_log.response_error IS 'Error message if response sending failed';
COMMENT ON COLUMN receipt_processing_log.ghl_message_response IS 'Response from GoHighLevel messaging API';
COMMENT ON COLUMN receipt_processing_log.error_message IS 'Error message if processing failed';