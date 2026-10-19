-- Migration: 017_head_coach_and_staff_roles.sql
-- Adds head_coach and receptionist roles to academy_roles across all tenant databases

INSERT OR IGNORE INTO academy_roles (name, display_name, description, permissions, is_system)
VALUES (
  'head_coach',
  'Head Coach',
  'Senior coaching staff authorized to lead training programs, manage syllabus techniques, oversee batch schedules, and supervise coaches',
  '["view_coaches","create_coaches","edit_coaches","view_students","view_batches","create_batches","edit_batches","view_attendance","mark_attendance","view_syllabus","manage_syllabus","view_sports","view_leaves","apply_leave"]',
  1
);

INSERT OR IGNORE INTO academy_roles (name, display_name, description, permissions, is_system)
VALUES (
  'receptionist',
  'Receptionist',
  'Front desk receptionist authorized for student enrollment, parent communication, attendance check-in, and fee collection',
  '["view_students","create_students","edit_students","view_batches","view_attendance","mark_attendance","view_fees","collect_fees","view_sports","apply_leave"]',
  1
);
