-- Migration: 019_expanded_staff_student_and_inquiry_workflow.sql
-- Implements expanded staff & student profiles, inquiry management, trial classes, and admission checklists

-- 1. Additional Staff Information Fields on Coaches
ALTER TABLE coaches ADD COLUMN date_of_birth DATE;
ALTER TABLE coaches ADD COLUMN gender TEXT;
ALTER TABLE coaches ADD COLUMN profile_photo TEXT;
ALTER TABLE coaches ADD COLUMN guardian_name TEXT;
ALTER TABLE coaches ADD COLUMN nationality TEXT;
ALTER TABLE coaches ADD COLUMN preferred_language TEXT;
ALTER TABLE coaches ADD COLUMN marital_status TEXT;
ALTER TABLE coaches ADD COLUMN current_address TEXT;
ALTER TABLE coaches ADD COLUMN permanent_address TEXT;
ALTER TABLE coaches ADD COLUMN city TEXT;
ALTER TABLE coaches ADD COLUMN state TEXT;
ALTER TABLE coaches ADD COLUMN postal_code TEXT;
ALTER TABLE coaches ADD COLUMN country TEXT;
ALTER TABLE coaches ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE coaches ADD COLUMN emergency_contact_relation TEXT;
ALTER TABLE coaches ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE coaches ADD COLUMN alternate_phone TEXT;

-- 2. Additional Fields on Users
ALTER TABLE users ADD COLUMN date_of_birth DATE;
ALTER TABLE users ADD COLUMN gender TEXT;
ALTER TABLE users ADD COLUMN emergency_contact_phone TEXT;

-- 3. Comprehensive Student Profile Fields
ALTER TABLE students ADD COLUMN admission_number TEXT;
ALTER TABLE students ADD COLUMN nationality TEXT;
ALTER TABLE students ADD COLUMN preferred_language TEXT;
ALTER TABLE students ADD COLUMN father_name TEXT;
ALTER TABLE students ADD COLUMN father_phone TEXT;
ALTER TABLE students ADD COLUMN mother_name TEXT;
ALTER TABLE students ADD COLUMN mother_phone TEXT;
ALTER TABLE students ADD COLUMN primary_guardian_relation TEXT;
ALTER TABLE students ADD COLUMN primary_guardian_email TEXT;
ALTER TABLE students ADD COLUMN alternate_emergency_contact TEXT;
ALTER TABLE students ADD COLUMN authorized_pickup_persons TEXT;
ALTER TABLE students ADD COLUMN parent_portal_enabled INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN permanent_address TEXT;
ALTER TABLE students ADD COLUMN city TEXT;
ALTER TABLE students ADD COLUMN state TEXT;
ALTER TABLE students ADD COLUMN postal_code TEXT;
ALTER TABLE students ADD COLUMN country TEXT;
ALTER TABLE students ADD COLUMN same_as_current_address INTEGER DEFAULT 1;
ALTER TABLE students ADD COLUMN school_college_name TEXT;
ALTER TABLE students ADD COLUMN grade_standard TEXT;
ALTER TABLE students ADD COLUMN education_board TEXT;
ALTER TABLE students ADD COLUMN academic_year TEXT;
ALTER TABLE students ADD COLUMN occupation TEXT;
ALTER TABLE students ADD COLUMN allergies TEXT;
ALTER TABLE students ADD COLUMN emergency_medical_instructions TEXT;
ALTER TABLE students ADD COLUMN injury_history TEXT;
ALTER TABLE students ADD COLUMN doctor_clinic_contact TEXT;
ALTER TABLE students ADD COLUMN medical_consent INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN previous_sports_experience TEXT;
ALTER TABLE students ADD COLUMN previous_academy TEXT;
ALTER TABLE students ADD COLUMN goals_notes TEXT;
ALTER TABLE students ADD COLUMN photo_video_permission INTEGER DEFAULT 1;
ALTER TABLE students ADD COLUMN competition_consent INTEGER DEFAULT 1;
ALTER TABLE students ADD COLUMN joining_fee_amount REAL DEFAULT 0;
ALTER TABLE students ADD COLUMN discount_percent REAL DEFAULT 0;
ALTER TABLE students ADD COLUMN discount_reason TEXT;
ALTER TABLE students ADD COLUMN discount_approved_by INTEGER;
ALTER TABLE students ADD COLUMN discount_approved_at DATETIME;
ALTER TABLE students ADD COLUMN account_status TEXT DEFAULT 'active';

-- Backfill admission_number from student_code where NULL
UPDATE students SET admission_number = student_code WHERE admission_number IS NULL;

-- 4. Multiple Guardians Support
CREATE TABLE IF NOT EXISTS student_guardians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  is_primary INTEGER DEFAULT 0,
  is_emergency_contact INTEGER DEFAULT 0,
  authorized_pickup INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_guardians_student ON student_guardians(student_id);

-- 5. Student Documents
CREATE TABLE IF NOT EXISTS student_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'birth_certificate', 'medical_clearance', 'id_proof', 'previous_certificate', 'consent_form', 'photo'
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  verification_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  verified_by_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_student ON student_documents(student_id);

-- 6. Inquiries Table (Lifecycle Management)
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  guardian_name TEXT,
  guardian_relation TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  gender TEXT,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  sport_id INTEGER REFERENCES sports(id) ON DELETE SET NULL,
  preferred_batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'walk_in', -- 'walk_in', 'website', 'referral', 'social_media', 'phone_call', 'other'
  notes TEXT,
  assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  next_followup_date DATE,
  status TEXT DEFAULT 'new', -- 'new', 'contacted', 'trial_scheduled', 'trial_completed', 'followup_required', 'admission_in_progress', 'converted', 'lost', 'cancelled'
  lost_reason TEXT,
  converted_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  converted_at DATETIME,
  created_by_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inquiries_academy ON inquiries(academy_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_phone ON inquiries(phone);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_branch ON inquiries(branch_id);

-- 7. Inquiry Trials Table
CREATE TABLE IF NOT EXISTS inquiry_trials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  sport_id INTEGER REFERENCES sports(id) ON DELETE SET NULL,
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
  trial_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  attendance_status TEXT DEFAULT 'scheduled', -- 'scheduled', 'attended', 'no_show', 'cancelled'
  feedback TEXT,
  coach_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trials_inquiry ON inquiry_trials(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_trials_date ON inquiry_trials(trial_date);

-- 8. Admission Checklist Table
CREATE TABLE IF NOT EXISTS admission_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  is_mandatory INTEGER DEFAULT 1,
  is_completed INTEGER DEFAULT 0,
  verified_by_user_id INTEGER,
  verified_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_checklist_student ON admission_checklists(student_id);
