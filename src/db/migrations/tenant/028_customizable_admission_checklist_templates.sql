-- Tenant Database Schema: Migration 028
-- Description: Customizable Admission Checklist Templates per Academy

CREATE TABLE IF NOT EXISTS admission_checklist_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  is_mandatory INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checklist_tpl_academy ON admission_checklist_templates(academy_id, is_active);

-- Seed default standard templates for initial migration if table is empty
INSERT INTO admission_checklist_templates (academy_id, item_key, item_name, is_mandatory, sort_order, is_active)
SELECT 1, 'doc_photo', 'Student Photo Uploaded', 0, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM admission_checklist_templates WHERE academy_id = 1 AND item_key = 'doc_photo');

INSERT INTO admission_checklist_templates (academy_id, item_key, item_name, is_mandatory, sort_order, is_active)
SELECT 1, 'guardian_consent', 'Parent / Guardian Consent Form', 1, 20, 1
WHERE NOT EXISTS (SELECT 1 FROM admission_checklist_templates WHERE academy_id = 1 AND item_key = 'guardian_consent');

INSERT INTO admission_checklist_templates (academy_id, item_key, item_name, is_mandatory, sort_order, is_active)
SELECT 1, 'medical_clearance', 'Medical Clearance & Health Declaration', 0, 30, 1
WHERE NOT EXISTS (SELECT 1 FROM admission_checklist_templates WHERE academy_id = 1 AND item_key = 'medical_clearance');

INSERT INTO admission_checklist_templates (academy_id, item_key, item_name, is_mandatory, sort_order, is_active)
SELECT 1, 'admission_fee_settled', 'Admission & Initial Fee Settlement', 1, 40, 1
WHERE NOT EXISTS (SELECT 1 FROM admission_checklist_templates WHERE academy_id = 1 AND item_key = 'admission_fee_settled');

INSERT INTO admission_checklist_templates (academy_id, item_key, item_name, is_mandatory, sort_order, is_active)
SELECT 1, 'batch_assignment', 'Batch & Schedule Assignment', 0, 50, 1
WHERE NOT EXISTS (SELECT 1 FROM admission_checklist_templates WHERE academy_id = 1 AND item_key = 'batch_assignment');

