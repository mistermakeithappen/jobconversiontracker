-- Receipt Processing Log Table
-- Stores AI receipt processing attempts and user interactions

CREATE TABLE IF NOT EXISTS receipt_processing_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Receipt data extracted by AI
  receipt_data JSONB NOT NULL,
  
  -- Job matching results
  job_matches JSONB DEFAULT '[]'::jsonb,
  
  -- Response sent to user
  response_sent JSONB NOT NULL,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending_user_response' CHECK (
    status IN ('pending_user_response', 'confirmed', 'user_selected', 'cancelled', 'error')
  ),
  
  -- Selected opportunity (after user confirmation)
  selected_opportunity_id TEXT,
  
  -- Final receipt ID (if successfully logged)
  final_receipt_id UUID REFERENCES opportunity_receipts(id),
  
  -- User interaction data
  user_phone TEXT,
  user_email TEXT,
  user_response TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_responded_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipt_processing_user_id ON receipt_processing_log(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_status ON receipt_processing_log(status);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_created_at ON receipt_processing_log(created_at);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_phone ON receipt_processing_log(user_phone);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_email ON receipt_processing_log(user_email);

-- RLS Policies
ALTER TABLE receipt_processing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own receipt processing logs"
  ON receipt_processing_log FOR SELECT
  USING (user_id = auth.uid()::text::uuid);

CREATE POLICY "Users can insert their own receipt processing logs"
  ON receipt_processing_log FOR INSERT
  WITH CHECK (user_id = auth.uid()::text::uuid);

CREATE POLICY "Users can update their own receipt processing logs"
  ON receipt_processing_log FOR UPDATE
  USING (user_id = auth.uid()::text::uuid);

-- Add comment explaining the table
COMMENT ON TABLE receipt_processing_log IS 'Stores AI receipt processing attempts and user confirmation workflows';
COMMENT ON COLUMN receipt_processing_log.receipt_data IS 'JSON containing vendor_name, amount, date, etc. extracted by AI';
COMMENT ON COLUMN receipt_processing_log.job_matches IS 'JSON array of potential job matches with confidence scores';
COMMENT ON COLUMN receipt_processing_log.response_sent IS 'JSON containing the message sent to user and response options';
COMMENT ON COLUMN receipt_processing_log.status IS 'Current state of the receipt processing workflow';
COMMENT ON COLUMN receipt_processing_log.selected_opportunity_id IS 'Opportunity ID selected by user after confirmation';
COMMENT ON COLUMN receipt_processing_log.final_receipt_id IS 'Reference to the final receipt record if successfully created';