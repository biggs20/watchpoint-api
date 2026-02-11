-- Migration 003: GovBid Scout Schema
-- Creates procurement tracking tables for government bid monitoring

-- ============================================
-- 1. procurement_sources
-- ============================================
CREATE TABLE IF NOT EXISTS procurement_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text UNIQUE NOT NULL,
  name text NOT NULL,
  base_url text,
  adapter_type text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_sources_key ON procurement_sources(source_key);
CREATE INDEX IF NOT EXISTS idx_procurement_sources_active ON procurement_sources(is_active);

-- ============================================
-- 2. opportunity_profiles (replaces watches for gov procurement)
-- ============================================
CREATE TABLE IF NOT EXISTS opportunity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  naics_codes text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  excluded_keywords text[] DEFAULT '{}',
  set_aside_types text[] DEFAULT '{}',
  states text[] DEFAULT '{}',
  radius_miles int,
  min_value numeric,
  max_value numeric,
  check_interval_minutes int DEFAULT 60,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_profiles_user ON opportunity_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_profiles_active ON opportunity_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_opportunity_profiles_naics ON opportunity_profiles USING gin(naics_codes);
CREATE INDEX IF NOT EXISTS idx_opportunity_profiles_keywords ON opportunity_profiles USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_opportunity_profiles_states ON opportunity_profiles USING gin(states);

-- ============================================
-- 3. source_subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS source_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES opportunity_profiles(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES procurement_sources(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_source_subscriptions_profile ON source_subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_source_subscriptions_source ON source_subscriptions(source_id);
CREATE INDEX IF NOT EXISTS idx_source_subscriptions_active ON source_subscriptions(is_active);

-- ============================================
-- 4. opportunities
-- ============================================
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES procurement_sources(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text NOT NULL,
  description text,
  agency text,
  office text,
  solicitation_number text,
  naics_code text,
  set_aside_type text,
  posted_date timestamptz,
  response_deadline timestamptz,
  place_of_performance_city text,
  place_of_performance_state text,
  place_of_performance_zip text,
  estimated_value numeric,
  contract_type text,
  status text DEFAULT 'active',
  url text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  contact_name text,
  contact_email text,
  contact_phone text,
  contracting_officer_name text,
  contracting_officer_email text,
  contracting_officer_phone text,
  incumbent_name text,
  attachment_count int DEFAULT 0,
  amendment_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunities_source ON opportunities(source_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_external_id ON opportunities(external_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_naics ON opportunities(naics_code);
CREATE INDEX IF NOT EXISTS idx_opportunities_set_aside ON opportunities(set_aside_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_posted ON opportunities(posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(response_deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_state ON opportunities(place_of_performance_state);
CREATE INDEX IF NOT EXISTS idx_opportunities_value ON opportunities(estimated_value);
CREATE INDEX IF NOT EXISTS idx_opportunities_solicitation ON opportunities(solicitation_number);

-- ============================================
-- 5. opportunity_events
-- ============================================
CREATE TABLE IF NOT EXISTS opportunity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES opportunity_profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  fit_score int,
  changes jsonb DEFAULT '{}'::jsonb,
  notified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_events_opp ON opportunity_events(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_events_profile ON opportunity_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_events_type ON opportunity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_opportunity_events_score ON opportunity_events(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_events_notified ON opportunity_events(notified_at);

-- ============================================
-- 6. Seed procurement sources
-- ============================================
INSERT INTO procurement_sources (source_key, name, base_url, adapter_type, config) VALUES
  ('sam_gov', 'SAM.gov', 'https://api.sam.gov', 'api', '{"api_version": "v2", "page_limit": 1000}'::jsonb),
  ('pa_emarketplace', 'PA eMarketplace', 'https://www.emarketplace.state.pa.us', 'scraper', '{"search_path": "/Search.aspx"}'::jsonb),
  ('pa_costars', 'PA COSTARS', 'https://www.dgs.pa.gov/COSTARS', 'scraper', '{"catalog_path": "/Pages/default.aspx"}'::jsonb),
  ('nj_start', 'NJ START', 'https://www.njstart.gov', 'scraper', '{"bids_path": "/bso/external/publicBids.sdo"}'::jsonb),
  ('nj_treasury', 'NJ Treasury', 'https://www.state.nj.us/treasury/purchase', 'scraper', '{"bids_path": "/bid/summary/all.shtml"}'::jsonb),
  ('de_marketlink', 'DE MarketLink', 'https://marketlink.delaware.gov', 'scraper', '{"bids_path": "/apps/bids/"}'::jsonb),
  ('de_gss', 'DE Government Support Services', 'https://gss.omb.delaware.gov', 'scraper', '{"contracts_path": "/contracts"}'::jsonb),
  ('watchpoint_scrape', 'WatchPoint Custom Scrape', NULL, 'custom', '{"max_concurrent": 3}'::jsonb)
ON CONFLICT (source_key) DO NOTHING;
