-- Migration: 013_roles_and_permissions_enhancements.sql
-- Adds display_name and is_system to academy_roles, and custom_permissions to users.

ALTER TABLE academy_roles ADD COLUMN display_name TEXT;
ALTER TABLE academy_roles ADD COLUMN is_system INTEGER DEFAULT 0;

ALTER TABLE users ADD COLUMN custom_permissions TEXT DEFAULT '[]';

-- Update existing system roles with user-friendly display names
UPDATE academy_roles SET display_name = 'Academy Administrator', is_system = 1 WHERE name = 'academy_admin';
UPDATE academy_roles SET display_name = 'Staff Member', is_system = 1 WHERE name = 'academy_staff';
UPDATE academy_roles SET display_name = 'Sports Coach', is_system = 1 WHERE name = 'coach';
UPDATE academy_roles SET display_name = 'Student', is_system = 1 WHERE name = 'student';

-- Insert standard additional operational roles if not present
INSERT OR IGNORE INTO academy_roles (name, display_name, description, permissions, is_system)
VALUES (
  'finance_manager',
  'Finance & Fee Manager',
  'Authorized to manage fee plans, collect payments, manage discounts and generate financial receipts',
  '["view_fees","collect_fees","override_fees","manage_discounts","pause_fees","view_students","view_batches"]',
  0
);

INSERT OR IGNORE INTO academy_roles (name, display_name, description, permissions, is_system)
VALUES (
  'front_desk',
  'Front Desk & Receptionist',
  'Handles student enrollment, attendance marking, and parent communication',
  '["view_students","create_students","edit_students","view_batches","view_attendance","mark_attendance","view_fees","collect_fees"]',
  0
);
