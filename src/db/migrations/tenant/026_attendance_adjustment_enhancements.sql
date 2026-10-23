-- Migration 026: Enhanced Attendance Adjustments for Students and Employees
-- Multi-tenant Karate Academy SaaS

-- Add user_id to attendance_corrections for employee/staff attendance adjustments
ALTER TABLE attendance_corrections ADD COLUMN user_id INTEGER;

-- Add person_type to distinguish between 'student' and 'employee'
ALTER TABLE attendance_corrections ADD COLUMN person_type TEXT DEFAULT 'student';

-- Add branch_id to track which branch the adjustment belongs to
ALTER TABLE attendance_corrections ADD COLUMN branch_id INTEGER;

-- Add requires_admin_approval flag for attendance entries older than 2 days
ALTER TABLE attendance_corrections ADD COLUMN requires_admin_approval INTEGER DEFAULT 0;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_att_corr_user ON attendance_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_att_corr_student ON attendance_corrections(student_id);
CREATE INDEX IF NOT EXISTS idx_att_corr_date ON attendance_corrections(date);
CREATE INDEX IF NOT EXISTS idx_att_corr_status ON attendance_corrections(status);
