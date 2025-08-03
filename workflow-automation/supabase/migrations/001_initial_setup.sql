-- 001_initial_setup.sql
-- Core extensions and helper functions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to generate payout numbers
CREATE OR REPLACE FUNCTION generate_payout_number()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  last_number INTEGER;
  new_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get the last payout number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(payout_number FROM 'PAY-\d{4}-(\d{3})') AS INTEGER)), 0)
  INTO last_number
  FROM commission_payouts
  WHERE payout_number LIKE 'PAY-' || current_year || '-%';
  
  -- Generate new number
  new_number := 'PAY-' || current_year || '-' || LPAD((last_number + 1)::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;