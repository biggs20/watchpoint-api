-- Migration: Enhanced Opportunities Table
-- Phase 2.5: Add contact info, contract details, and document tracking

-- Add contact information columns
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_title text;

-- Add contracting officer columns
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contracting_officer_name text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contracting_officer_email text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contracting_officer_phone text;

-- Add contract/award details
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS incumbent_contractor text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contract_type text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS size_standard text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS estimated_value_low numeric;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS estimated_value_high numeric;

-- Add timeline fields
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS questions_due_at timestamptz;

-- Add document/amendment tracking (JSONB)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS amendments jsonb DEFAULT '[]'::jsonb;

-- Add organizational/reference fields
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS office_address text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS solicitation_number text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS award_number text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS parent_opportunity_id uuid REFERENCES opportunities(id);

-- Add agency hierarchy
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS sub_agency text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS office text;

-- Add set-aside details
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS set_aside_type text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS set_aside_description text;

-- Add response tracking
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS response_date timestamptz;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS archive_date timestamptz;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_opportunities_questions_due ON opportunities(questions_due_at) WHERE questions_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_solicitation ON opportunities(solicitation_number) WHERE solicitation_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_parent ON opportunities(parent_opportunity_id) WHERE parent_opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_contract_type ON opportunities(contract_type) WHERE contract_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_set_aside ON opportunities(set_aside_type) WHERE set_aside_type IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN opportunities.attachments IS 'Array of {name, url, size_bytes, type}';
COMMENT ON COLUMN opportunities.amendments IS 'Array of {number, date, summary, url}';
COMMENT ON COLUMN opportunities.contract_type IS 'FFP, Cost-Plus, T&M, IDIQ, BPA, etc.';
COMMENT ON COLUMN opportunities.set_aside_type IS '8(a), HUBZone, WOSB, SDVOSB, SB, etc.';