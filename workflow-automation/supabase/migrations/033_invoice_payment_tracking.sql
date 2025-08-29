-- 033_invoice_payment_tracking.sql
-- Add payment tracking capabilities to invoices

-- Add payment tracking columns to ghl_invoices
ALTER TABLE ghl_invoices 
ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(12,2) GENERATED ALWAYS AS (amount - amount_paid) STORED;

-- Update invoice status to include more payment-related statuses
ALTER TABLE ghl_invoices 
DROP CONSTRAINT IF EXISTS ghl_invoices_status_check;

ALTER TABLE ghl_invoices 
ADD CONSTRAINT ghl_invoices_status_check 
CHECK (status IN (
  'draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'void', 'cancelled'
));

-- Create a function to record payments
CREATE OR REPLACE FUNCTION record_invoice_payment(
  p_invoice_id UUID,
  p_amount DECIMAL(12,2),
  p_payment_method VARCHAR(50),
  p_payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_transaction_id VARCHAR(255) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_invoice ghl_invoices%ROWTYPE;
  v_new_payment JSONB;
  v_new_total_paid DECIMAL(12,2);
  v_new_status VARCHAR(50);
BEGIN
  -- Get current invoice
  SELECT * INTO v_invoice FROM ghl_invoices WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;
  
  -- Validate payment amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;
  
  -- Calculate new totals
  v_new_total_paid := v_invoice.amount_paid + p_amount;
  
  IF v_new_total_paid > v_invoice.amount THEN
    RAISE EXCEPTION 'Payment amount (%) would exceed invoice total (%). Remaining balance is %', 
      p_amount, v_invoice.amount, (v_invoice.amount - v_invoice.amount_paid);
  END IF;
  
  -- Determine new status
  IF v_new_total_paid >= v_invoice.amount THEN
    v_new_status := 'paid';
  ELSIF v_new_total_paid > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := v_invoice.status;
  END IF;
  
  -- Create payment record
  v_new_payment := jsonb_build_object(
    'id', gen_random_uuid(),
    'amount', p_amount,
    'payment_method', p_payment_method,
    'payment_date', p_payment_date,
    'transaction_id', p_transaction_id,
    'notes', p_notes,
    'recorded_at', NOW(),
    'recorded_by', auth.uid()
  );
  
  -- Update invoice
  UPDATE ghl_invoices 
  SET 
    amount_paid = v_new_total_paid,
    status = v_new_status,
    payment_history = COALESCE(payment_history, '[]'::jsonb) || v_new_payment,
    last_payment_date = p_payment_date,
    last_payment_method = p_payment_method,
    paid_date = CASE WHEN v_new_status = 'paid' THEN p_payment_date ELSE paid_date END,
    updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to void/refund payments
CREATE OR REPLACE FUNCTION void_invoice_payment(
  p_invoice_id UUID,
  p_payment_id UUID,
  p_reason TEXT DEFAULT 'Payment voided'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_invoice ghl_invoices%ROWTYPE;
  v_payment JSONB;
  v_payment_amount DECIMAL(12,2);
  v_updated_history JSONB;
  v_new_total_paid DECIMAL(12,2);
  v_new_status VARCHAR(50);
BEGIN
  -- Get current invoice
  SELECT * INTO v_invoice FROM ghl_invoices WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;
  
  -- Find the payment in history
  SELECT payment INTO v_payment 
  FROM jsonb_array_elements(v_invoice.payment_history) AS payment
  WHERE (payment->>'id')::uuid = p_payment_id;
  
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;
  
  -- Get payment amount
  v_payment_amount := (v_payment->>'amount')::DECIMAL(12,2);
  
  -- Mark payment as voided in history
  SELECT jsonb_agg(
    CASE 
      WHEN (payment->>'id')::uuid = p_payment_id 
      THEN payment || jsonb_build_object(
        'voided', true,
        'voided_at', NOW(),
        'voided_by', auth.uid(),
        'void_reason', p_reason
      )
      ELSE payment
    END
  ) INTO v_updated_history
  FROM jsonb_array_elements(v_invoice.payment_history) AS payment;
  
  -- Calculate new totals (subtract voided payment)
  v_new_total_paid := v_invoice.amount_paid - v_payment_amount;
  
  -- Determine new status
  IF v_new_total_paid <= 0 THEN
    v_new_status := CASE WHEN v_invoice.status = 'paid' THEN 'sent' ELSE v_invoice.status END;
  ELSIF v_new_total_paid >= v_invoice.amount THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;
  
  -- Update invoice
  UPDATE ghl_invoices 
  SET 
    amount_paid = v_new_total_paid,
    status = v_new_status,
    payment_history = v_updated_history,
    paid_date = CASE WHEN v_new_status != 'paid' THEN NULL ELSE paid_date END,
    updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for payment queries
CREATE INDEX IF NOT EXISTS idx_ghl_invoices_payment_status ON ghl_invoices(status) WHERE status IN ('partially_paid', 'paid');
CREATE INDEX IF NOT EXISTS idx_ghl_invoices_amount_paid ON ghl_invoices(amount_paid) WHERE amount_paid > 0;
CREATE INDEX IF NOT EXISTS idx_ghl_invoices_last_payment ON ghl_invoices(last_payment_date) WHERE last_payment_date IS NOT NULL;

-- Update the organization settings to include invoice pipeline settings
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS invoice_pipeline_settings JSONB DEFAULT '{
  "move_on_invoice_sent": false,
  "target_pipeline_id": null,
  "target_stage_id": null,
  "move_on_payment_received": false,
  "payment_received_pipeline_id": null,
  "payment_received_stage_id": null
}';

COMMENT ON COLUMN organizations.invoice_pipeline_settings IS 'Settings for automatically moving opportunities through pipelines when invoices are created or paid';

-- Create a view for invoice payment summaries
CREATE OR REPLACE VIEW invoice_payment_summary AS
SELECT 
  i.id,
  i.ghl_invoice_id,
  i.invoice_number,
  i.name,
  i.amount,
  i.amount_paid,
  i.remaining_balance,
  i.status,
  i.last_payment_date,
  i.last_payment_method,
  jsonb_array_length(COALESCE(i.payment_history, '[]'::jsonb)) as payment_count,
  (
    SELECT COUNT(*)::int 
    FROM jsonb_array_elements(i.payment_history) AS payment
    WHERE (payment->>'voided')::boolean IS NOT TRUE
  ) as active_payment_count,
  (
    SELECT COALESCE(SUM((payment->>'amount')::decimal), 0)
    FROM jsonb_array_elements(i.payment_history) AS payment
    WHERE (payment->>'voided')::boolean IS NOT TRUE
  ) as total_payments_received
FROM ghl_invoices i;
