-- Migration: 024_add_joining_date_to_coaches.sql
-- Adds joining_date column to coaches table and syncs from employment_records / created_at

ALTER TABLE coaches ADD COLUMN joining_date DATE;

UPDATE coaches 
SET joining_date = COALESCE(
  (SELECT joining_date FROM employment_records WHERE employment_records.user_id = coaches.user_id LIMIT 1),
  DATE(COALESCE(created_at, '2026-01-01'))
)
WHERE joining_date IS NULL;
