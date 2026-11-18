-- Migration: 039_standardize_student_code_format.sql
-- Description: Standardizes student_code and admission_number format to <academy_id>-<4-digit-sequence> (from 1 to n)

WITH numbered_students AS (
  SELECT id,
         COALESCE(academy_id, 1) || '-' || printf('%04d', ROW_NUMBER() OVER (ORDER BY id ASC)) AS new_code
  FROM students
)
UPDATE students
SET student_code = (SELECT new_code FROM numbered_students WHERE numbered_students.id = students.id),
    admission_number = (SELECT new_code FROM numbered_students WHERE numbered_students.id = students.id)
WHERE students.id IN (SELECT id FROM numbered_students);
