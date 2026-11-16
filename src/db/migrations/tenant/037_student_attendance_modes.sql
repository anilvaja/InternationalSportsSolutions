-- Migration: 037_student_attendance_modes.sql
-- Description: Add allowed_attendance_modes to students table for granular per-student attendance method authorization
ALTER TABLE students ADD COLUMN allowed_attendance_modes TEXT DEFAULT '["qr","face"]';

