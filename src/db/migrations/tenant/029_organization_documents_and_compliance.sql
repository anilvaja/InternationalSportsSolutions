-- Tenant Database Schema: Migration 029
-- Description: Academy & Branch Documents, Compliance Tracking, AMC, Insurance, and Expiry Reminders

CREATE TABLE IF NOT EXISTS academy_compliance_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK(category IN ('agreement', 'certificate', 'insurance', 'equipment_amc', 'license', 'resolution', 'meeting_mom', 'compliance', 'other')),
  title TEXT NOT NULL,
  document_number TEXT,
  issuing_authority TEXT,
  issue_date DATE,
  expiry_date DATE,
  renewal_reminder_days INTEGER DEFAULT 30,
  document_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expiring_soon', 'expired', 'archived')),
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comp_docs_academy ON academy_compliance_documents(academy_id, category);
CREATE INDEX IF NOT EXISTS idx_comp_docs_expiry ON academy_compliance_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_comp_docs_branch ON academy_compliance_documents(branch_id);
