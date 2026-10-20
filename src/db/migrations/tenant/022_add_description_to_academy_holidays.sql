-- Migration 022: Add description column to academy_holidays
ALTER TABLE academy_holidays ADD COLUMN description TEXT;
