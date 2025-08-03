-- Receipt Management Enhancements
-- Adds submitted_by, reimbursable tracking, company credit cards, and user payment structures

-- Add new fields to opportunity_receipts table
ALTER TABLE opportunity_receipts 
ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS reimbursable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50), -- 'credit_card', 'cash', 'check', 'other'
ADD COLUMN IF NOT EXISTS last_four_digits VARCHAR(4), -- For credit card identification
ADD COLUMN IF NOT EXISTS submitter_user_id UUID; -- Link to actual user who submitted

-- Create company credit cards table
CREATE TABLE IF NOT EXISTS company_credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- Owner/manager of the card setup
  card_name VARCHAR(100) NOT NULL, -- Friendly name like "Company Amex", "Fleet Card"
  last_four_digits VARCHAR(4) NOT NULL,
  card_type VARCHAR(50), -- 'amex', 'visa', 'mastercard', etc.
  is_reimbursable BOOLEAN DEFAULT true, -- Whether expenses on this card are reimbursable
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Constraints
  UNIQUE(user_id, last_four_digits),
  CHECK (LENGTH(last_four_digits) = 4 AND last_four_digits ~ '^[0-9]{4}$')
);

-- Create user payment structures table
CREATE TABLE IF NOT EXISTS user_payment_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payment_type VARCHAR(50) NOT NULL, -- 'hourly', 'salary', 'commission_gross', 'commission_profit', 'hybrid'
  hourly_rate DECIMAL(10,2), -- For hourly workers
  annual_salary DECIMAL(12,2), -- For salaried workers  
  commission_percentage DECIMAL(5,2), -- For commission workers (0.00 to 100.00)
  base_salary DECIMAL(12,2), -- For hybrid salary + commission
  overtime_rate DECIMAL(10,2), -- Overtime hourly rate
  notes TEXT,
  effective_date DATE DEFAULT CURRENT_DATE,
  end_date DATE, -- For historical records
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Constraints
  CHECK (payment_type IN ('hourly', 'salary', 'commission_gross', 'commission_profit', 'hybrid', 'contractor')),
  CHECK (commission_percentage IS NULL OR (commission_percentage >= 0 AND commission_percentage <= 100))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_credit_cards_user_id ON company_credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_company_credit_cards_last_four ON company_credit_cards(last_four_digits);
CREATE INDEX IF NOT EXISTS idx_company_credit_cards_active ON company_credit_cards(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_payment_structures_user_id ON user_payment_structures(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_structures_active ON user_payment_structures(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_payment_structures_effective ON user_payment_structures(effective_date);

CREATE INDEX IF NOT EXISTS idx_opportunity_receipts_submitted_by ON opportunity_receipts(submitted_by);
CREATE INDEX IF NOT EXISTS idx_opportunity_receipts_reimbursable ON opportunity_receipts(reimbursable);
CREATE INDEX IF NOT EXISTS idx_opportunity_receipts_submitter_user ON opportunity_receipts(submitter_user_id);

-- Enable RLS for new tables
ALTER TABLE company_credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_payment_structures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_credit_cards
CREATE POLICY "Users can manage their own company credit cards" ON company_credit_cards
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for user_payment_structures  
CREATE POLICY "Users can manage their own payment structures" ON user_payment_structures
  FOR ALL USING (user_id = auth.uid());

-- Function to automatically determine reimbursable status based on credit card
CREATE OR REPLACE FUNCTION auto_determine_reimbursable()
RETURNS TRIGGER AS $$
BEGIN
  -- If last_four_digits is provided, check against company credit cards
  IF NEW.last_four_digits IS NOT NULL THEN
    -- Look up the card in company_credit_cards table
    SELECT is_reimbursable INTO NEW.reimbursable
    FROM company_credit_cards 
    WHERE last_four_digits = NEW.last_four_digits 
    AND is_active = true
    LIMIT 1;
    
    -- If no matching card found, default to not reimbursable for credit cards
    IF NEW.reimbursable IS NULL THEN
      NEW.reimbursable = false;
    END IF;
  ELSE
    -- For non-credit card payments, default based on payment method
    CASE NEW.payment_method
      WHEN 'cash' THEN NEW.reimbursable = true;
      WHEN 'check' THEN NEW.reimbursable = true;
      ELSE NEW.reimbursable = false;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-determine reimbursable status
DROP TRIGGER IF EXISTS trigger_auto_determine_reimbursable ON opportunity_receipts;
CREATE TRIGGER trigger_auto_determine_reimbursable
  BEFORE INSERT OR UPDATE ON opportunity_receipts
  FOR EACH ROW
  EXECUTE FUNCTION auto_determine_reimbursable();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_credit_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_payment_structures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_company_credit_cards_updated_at ON company_credit_cards;
CREATE TRIGGER trigger_update_company_credit_cards_updated_at
  BEFORE UPDATE ON company_credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_company_credit_cards_updated_at();

DROP TRIGGER IF EXISTS trigger_update_user_payment_structures_updated_at ON user_payment_structures;
CREATE TRIGGER trigger_update_user_payment_structures_updated_at
  BEFORE UPDATE ON user_payment_structures
  FOR EACH ROW
  EXECUTE FUNCTION update_user_payment_structures_updated_at();

-- Grant necessary permissions
GRANT ALL ON company_credit_cards TO authenticated;
GRANT ALL ON user_payment_structures TO authenticated;
GRANT EXECUTE ON FUNCTION auto_determine_reimbursable() TO authenticated;
GRANT EXECUTE ON FUNCTION update_company_credit_cards_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_payment_structures_updated_at() TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE company_credit_cards IS 'Stores company credit card information for automatic reimbursable determination';
COMMENT ON COLUMN company_credit_cards.last_four_digits IS 'Last 4 digits of credit card for matching receipts';
COMMENT ON COLUMN company_credit_cards.is_reimbursable IS 'Whether expenses on this card are reimbursable by default';

COMMENT ON TABLE user_payment_structures IS 'Stores user payment information for future payroll and commission calculations';
COMMENT ON COLUMN user_payment_structures.payment_type IS 'Type of payment: hourly, salary, commission_gross, commission_profit, hybrid, contractor';
COMMENT ON COLUMN user_payment_structures.commission_percentage IS 'Commission percentage (0-100) for commission-based workers';

COMMENT ON COLUMN opportunity_receipts.submitted_by IS 'Name of person who submitted the receipt';
COMMENT ON COLUMN opportunity_receipts.reimbursable IS 'Whether this receipt is reimbursable (auto-determined from credit card or manual)';
COMMENT ON COLUMN opportunity_receipts.payment_method IS 'Payment method: credit_card, cash, check, other';
COMMENT ON COLUMN opportunity_receipts.last_four_digits IS 'Last 4 digits of credit card used (for matching against company cards)';
COMMENT ON COLUMN opportunity_receipts.submitter_user_id IS 'UUID of user who submitted the receipt (links to user system)';

-- Create view for receipt analysis with reimbursable info
CREATE OR REPLACE VIEW receipt_analysis AS
SELECT 
  r.*,
  c.card_name,
  c.card_type,
  CASE 
    WHEN r.reimbursable THEN 'Reimbursable'
    ELSE 'Not Reimbursable'
  END as reimbursable_status,
  CASE 
    WHEN r.reimbursable THEN r.amount
    ELSE 0
  END as reimbursable_amount,
  CASE 
    WHEN NOT r.reimbursable THEN r.amount
    ELSE 0
  END as non_reimbursable_amount
FROM opportunity_receipts r
LEFT JOIN company_credit_cards c ON c.last_four_digits = r.last_four_digits AND c.is_active = true;

GRANT SELECT ON receipt_analysis TO authenticated;
COMMENT ON VIEW receipt_analysis IS 'Analysis view showing receipts with reimbursable status and amounts';