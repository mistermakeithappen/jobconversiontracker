-- Complete Stripe Integration Setup
-- This migration adds missing tables and enhances existing ones for a complete Stripe integration

-- =====================================================
-- 1. WEBHOOK EVENTS TABLE
-- =====================================================
-- Critical for idempotency and debugging webhook processing
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id TEXT PRIMARY KEY, -- Stripe webhook event ID
    api_version TEXT NOT NULL,
    created TIMESTAMP WITH TIME ZONE NOT NULL,
    data JSONB NOT NULL,
    request JSONB,
    pending_webhooks INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient webhook processing
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created ON stripe_webhook_events(created);

-- =====================================================
-- 1.5. ADD UNIQUE CONSTRAINT TO CUSTOMERS
-- =====================================================
-- Ensure stripe_customer_id is unique for foreign key references
DO $$ 
BEGIN
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customers_stripe_customer_id_unique' 
        AND table_name = 'customers'
    ) THEN
        ALTER TABLE customers ADD CONSTRAINT customers_stripe_customer_id_unique UNIQUE (stripe_customer_id);
    END IF;
END $$;

-- =====================================================
-- 2. PAYMENT METHODS TABLE
-- =====================================================
-- Store customer payment methods
CREATE TABLE IF NOT EXISTS stripe_payment_methods (
    id TEXT PRIMARY KEY, -- Stripe payment method ID
    customer_id TEXT REFERENCES customers(stripe_customer_id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- card, bank_account, etc.
    card_brand TEXT,
    card_country TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    card_funding TEXT,
    card_last4 TEXT,
    billing_details JSONB,
    metadata JSONB,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for customer payment methods
CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_customer ON stripe_payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_default ON stripe_payment_methods(customer_id, is_default) WHERE is_default = TRUE;

-- =====================================================
-- 3. CHECKOUT SESSIONS TABLE
-- =====================================================
-- Track Stripe checkout sessions
CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
    id TEXT PRIMARY KEY, -- Stripe checkout session ID
    customer_id TEXT REFERENCES customers(stripe_customer_id),
    payment_status TEXT NOT NULL,
    status TEXT NOT NULL,
    success_url TEXT,
    cancel_url TEXT,
    amount_total BIGINT,
    amount_subtotal BIGINT,
    currency TEXT,
    customer_details JSONB,
    line_items JSONB,
    metadata JSONB,
    mode TEXT NOT NULL, -- payment, setup, subscription
    payment_intent TEXT,
    setup_intent TEXT,
    subscription TEXT,
    url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for checkout sessions
CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_customer ON stripe_checkout_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_status ON stripe_checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_expires ON stripe_checkout_sessions(expires_at);

-- =====================================================
-- 4. INVOICES TABLE
-- =====================================================
-- Track Stripe invoices
CREATE TABLE IF NOT EXISTS stripe_invoices (
    id TEXT PRIMARY KEY, -- Stripe invoice ID
    customer_id TEXT REFERENCES customers(stripe_customer_id),
    subscription_id TEXT REFERENCES subscriptions(id),
    status TEXT NOT NULL,
    collection_method TEXT,
    currency TEXT NOT NULL,
    amount_due BIGINT NOT NULL,
    amount_paid BIGINT NOT NULL,
    amount_remaining BIGINT NOT NULL,
    total BIGINT NOT NULL,
    subtotal BIGINT NOT NULL,
    tax BIGINT,
    description TEXT,
    invoice_pdf TEXT,
    hosted_invoice_url TEXT,
    payment_intent TEXT,
    number TEXT,
    receipt_number TEXT,
    billing_reason TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created TIMESTAMP WITH TIME ZONE NOT NULL,
    finalized_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for invoices
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_customer ON stripe_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_subscription ON stripe_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status ON stripe_invoices(status);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_due_date ON stripe_invoices(due_date);

-- =====================================================
-- 5. INVOICE LINE ITEMS TABLE
-- =====================================================
-- Track individual line items on invoices
CREATE TABLE IF NOT EXISTS stripe_invoice_line_items (
    id TEXT PRIMARY KEY, -- Stripe line item ID
    invoice_id TEXT NOT NULL REFERENCES stripe_invoices(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES subscriptions(id),
    subscription_item TEXT,
    price_id TEXT REFERENCES prices(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL,
    description TEXT,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    proration BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for invoice line items
CREATE INDEX IF NOT EXISTS idx_stripe_invoice_line_items_invoice ON stripe_invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoice_line_items_subscription ON stripe_invoice_line_items(subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoice_line_items_price ON stripe_invoice_line_items(price_id);

-- =====================================================
-- 6. PAYMENT INTENTS TABLE
-- =====================================================
-- Track one-time payments
CREATE TABLE IF NOT EXISTS stripe_payment_intents (
    id TEXT PRIMARY KEY, -- Stripe payment intent ID
    customer_id TEXT REFERENCES customers(stripe_customer_id),
    amount BIGINT NOT NULL,
    amount_capturable BIGINT NOT NULL DEFAULT 0,
    amount_received BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    confirmation_method TEXT,
    payment_method TEXT,
    payment_method_types TEXT[] NOT NULL,
    receipt_email TEXT,
    description TEXT,
    statement_descriptor TEXT,
    application_fee_amount BIGINT,
    capture_method TEXT,
    client_secret TEXT,
    invoice TEXT,
    metadata JSONB,
    next_action JSONB,
    processing JSONB,
    shipping JSONB,
    created TIMESTAMP WITH TIME ZONE NOT NULL,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for payment intents
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_customer ON stripe_payment_intents(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_status ON stripe_payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_created ON stripe_payment_intents(created);

-- =====================================================
-- 7. ENHANCE EXISTING TABLES
-- =====================================================

-- Add missing fields to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES customers(stripe_customer_id),
ADD COLUMN IF NOT EXISTS default_payment_method TEXT,
ADD COLUMN IF NOT EXISTS collection_method TEXT DEFAULT 'charge_automatically',
ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_thresholds JSONB,
ADD COLUMN IF NOT EXISTS days_until_due INTEGER,
ADD COLUMN IF NOT EXISTS default_source TEXT,
ADD COLUMN IF NOT EXISTS discount JSONB,
ADD COLUMN IF NOT EXISTS items JSONB,
ADD COLUMN IF NOT EXISTS latest_invoice TEXT,
ADD COLUMN IF NOT EXISTS pending_setup_intent TEXT,
ADD COLUMN IF NOT EXISTS pending_update JSONB,
ADD COLUMN IF NOT EXISTS schedule TEXT,
ADD COLUMN IF NOT EXISTS transfer_data JSONB,
ADD COLUMN IF NOT EXISTS pause_collection JSONB;

-- Add missing fields to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS balance BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS created TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS currency TEXT,
ADD COLUMN IF NOT EXISTS default_source TEXT,
ADD COLUMN IF NOT EXISTS delinquent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS discount JSONB,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT,
ADD COLUMN IF NOT EXISTS invoice_settings JSONB,
ADD COLUMN IF NOT EXISTS livemode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS next_invoice_sequence INTEGER,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS preferred_locales TEXT[],
ADD COLUMN IF NOT EXISTS shipping JSONB,
ADD COLUMN IF NOT EXISTS tax_exempt TEXT,
ADD COLUMN IF NOT EXISTS test_clock TEXT;

-- Connect customers to users properly
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- =====================================================
-- 8. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_intents ENABLE ROW LEVEL SECURITY;

-- Webhook events - Only service role can access (no user access needed)
CREATE POLICY "Service role can manage webhook events"
  ON stripe_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Payment methods - Users can only see their own
CREATE POLICY "Users can view own payment methods"
  ON stripe_payment_methods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.stripe_customer_id = stripe_payment_methods.customer_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all payment methods"
  ON stripe_payment_methods
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Checkout sessions - Users can only see their own
CREATE POLICY "Users can view own checkout sessions"
  ON stripe_checkout_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.stripe_customer_id = stripe_checkout_sessions.customer_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all checkout sessions"
  ON stripe_checkout_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Invoices - Users can only see their own
CREATE POLICY "Users can view own invoices"
  ON stripe_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.stripe_customer_id = stripe_invoices.customer_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all invoices"
  ON stripe_invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Invoice line items - Users can only see their own
CREATE POLICY "Users can view own invoice line items"
  ON stripe_invoice_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stripe_invoices si
      JOIN customers c ON c.stripe_customer_id = si.customer_id
      WHERE si.id = stripe_invoice_line_items.invoice_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all invoice line items"
  ON stripe_invoice_line_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Payment intents - Users can only see their own
CREATE POLICY "Users can view own payment intents"
  ON stripe_payment_intents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.stripe_customer_id = stripe_payment_intents.customer_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all payment intents"
  ON stripe_payment_intents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 9. UTILITY FUNCTIONS
-- =====================================================

-- Function to get user's active subscription with enhanced details
CREATE OR REPLACE FUNCTION get_user_subscription_details(user_uuid UUID)
RETURNS TABLE (
  subscription_id TEXT,
  status TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN,
  trial_end TIMESTAMP WITH TIME ZONE,
  price_id TEXT,
  product_name TEXT,
  amount BIGINT,
  currency TEXT,
  billing_interval TEXT,
  customer_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.trial_end,
    s.price_id,
    p.name,
    pr.unit_amount,
    pr.currency,
    pr.interval,
    s.customer_id
  FROM subscriptions s
  JOIN customers c ON c.stripe_customer_id = s.customer_id
  JOIN prices pr ON pr.id = s.price_id
  JOIN products p ON p.id = pr.product_id
  WHERE c.user_id = user_uuid
    AND s.status IN ('active', 'trialing', 'past_due')
  ORDER BY s.created DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if webhook event was already processed (idempotency)
CREATE OR REPLACE FUNCTION is_webhook_processed(webhook_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM stripe_webhook_events 
    WHERE id = webhook_id AND processed = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark webhook as processed
CREATE OR REPLACE FUNCTION mark_webhook_processed(webhook_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE stripe_webhook_events 
  SET processed = TRUE, processed_at = NOW()
  WHERE id = webhook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. HELPFUL INDEXES
-- =====================================================

-- Customer organization lookup optimization
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id) WHERE user_id IS NOT NULL;

-- Subscription status lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_status ON subscriptions(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON subscriptions(user_id) 
  WHERE status IN ('active', 'trialing', 'past_due');

-- Organization subscription lookups  
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer ON organizations(stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

-- =====================================================
-- 11. GRANTS AND PERMISSIONS
-- =====================================================

-- Grant appropriate permissions to authenticated users
GRANT SELECT ON stripe_payment_methods TO authenticated;
GRANT SELECT ON stripe_checkout_sessions TO authenticated;
GRANT SELECT ON stripe_invoices TO authenticated;
GRANT SELECT ON stripe_invoice_line_items TO authenticated;
GRANT SELECT ON stripe_payment_intents TO authenticated;

-- Service role gets full access
GRANT ALL ON stripe_webhook_events TO service_role;
GRANT ALL ON stripe_payment_methods TO service_role;
GRANT ALL ON stripe_checkout_sessions TO service_role;
GRANT ALL ON stripe_invoices TO service_role;
GRANT ALL ON stripe_invoice_line_items TO service_role;
GRANT ALL ON stripe_payment_intents TO service_role;

-- Grant usage on sequences if any exist
-- Note: Stripe uses their own IDs, so we don't need sequences for these tables

-- =====================================================
-- 12. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE stripe_webhook_events IS 'Stores all Stripe webhook events for idempotency and debugging';
COMMENT ON TABLE stripe_payment_methods IS 'Customer payment methods from Stripe';
COMMENT ON TABLE stripe_checkout_sessions IS 'Stripe Checkout sessions for tracking payment flows';
COMMENT ON TABLE stripe_invoices IS 'Stripe invoices for subscription billing';
COMMENT ON TABLE stripe_invoice_line_items IS 'Line items for each Stripe invoice';
COMMENT ON TABLE stripe_payment_intents IS 'One-time payment tracking from Stripe';

COMMENT ON FUNCTION get_user_subscription_details(UUID) IS 'Returns detailed subscription information for a user';
COMMENT ON FUNCTION is_webhook_processed(TEXT) IS 'Checks if a webhook event has already been processed';
COMMENT ON FUNCTION mark_webhook_processed(TEXT) IS 'Marks a webhook event as processed';
