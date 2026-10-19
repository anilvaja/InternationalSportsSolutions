-- Migration: 014_dynamic_color_themes.sql
-- Description: Dynamic color themes per user, per role, and academy default

ALTER TABLE users ADD COLUMN theme_color TEXT DEFAULT NULL;
ALTER TABLE students ADD COLUMN theme_color TEXT DEFAULT NULL;
ALTER TABLE academy_roles ADD COLUMN theme_color TEXT DEFAULT NULL;
ALTER TABLE academy_policy_settings ADD COLUMN default_color_theme TEXT DEFAULT 'blue';

-- Assign default signature theme accents to roles
UPDATE academy_roles SET theme_color = 'amber' WHERE name = 'academy_admin';
UPDATE academy_roles SET theme_color = 'purple' WHERE name = 'coach';
UPDATE academy_roles SET theme_color = 'blue' WHERE name = 'academy_staff';
UPDATE academy_roles SET theme_color = 'emerald' WHERE name = 'finance_manager';
UPDATE academy_roles SET theme_color = 'teal' WHERE name = 'front_desk';
UPDATE academy_roles SET theme_color = 'indigo' WHERE name = 'student';
