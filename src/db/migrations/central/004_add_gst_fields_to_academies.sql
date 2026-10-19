-- Central Database Migration: Add GST & Tax compliance fields to academies
-- Version: 004

ALTER TABLE academies ADD COLUMN is_gst_registered INTEGER DEFAULT 0;
ALTER TABLE academies ADD COLUMN gst_number TEXT;
ALTER TABLE academies ADD COLUMN gst_rate REAL DEFAULT 18.0;
ALTER TABLE academies ADD COLUMN legal_business_name TEXT;
ALTER TABLE academies ADD COLUMN hsn_sac_code TEXT DEFAULT '999293';
ALTER TABLE academies ADD COLUMN gst_state_code TEXT;
