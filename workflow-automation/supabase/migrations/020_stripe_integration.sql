-- 020_stripe_integration.sql
-- This script sets up the necessary tables for Stripe integration.

-- 1. Products table
-- Stores product information, which corresponds to products in Stripe.
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  active BOOLEAN,
  name TEXT,
  description TEXT,
  image TEXT,
  metadata JSONB
);

-- 2. Prices table
-- Stores price information for each product, corresponding to prices in Stripe.
CREATE TABLE prices (
  id TEXT PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  active BOOLEAN,
  description TEXT,
  unit_amount BIGINT,
  currency TEXT,
  type TEXT,
  interval TEXT,
  interval_count INTEGER,
  trial_period_days INTEGER,
  metadata JSONB
);

-- 3. Customers table
-- Maps your application's users to Stripe customer IDs.
CREATE TABLE customers (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  stripe_customer_id TEXT
);

-- 4. Subscriptions table
-- Stores subscription information for each user.
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  status TEXT,
  metadata JSONB,
  price_id TEXT REFERENCES prices(id),
  quantity INTEGER,
  cancel_at_period_end BOOLEAN,
  created TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ
);

-- RLS Policies for new tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access to products" ON products FOR SELECT USING (true);

ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access to prices" ON prices FOR SELECT USING (true);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own customer" ON customers FOR SELECT USING (auth.uid() = id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id); 