import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const academyDir = 'data/academies';
const files = fs.readdirSync(academyDir).filter(f => f.endsWith('.db'));

for (const file of files) {
  const dbPath = path.join(academyDir, file);
  const db = new Database(dbPath);
  console.log('Processing:', dbPath);

  const sql = `
    WITH numbered_students AS (
      SELECT id,
             COALESCE(academy_id, 1) || '-' || printf('%04d', ROW_NUMBER() OVER (ORDER BY id ASC)) AS new_code
      FROM students
    )
    UPDATE students
    SET student_code = (SELECT new_code FROM numbered_students WHERE numbered_students.id = students.id),
        admission_number = (SELECT new_code FROM numbered_students WHERE numbered_students.id = students.id)
    WHERE students.id IN (SELECT id FROM numbered_students);
  `;

  db.exec(sql);
  const sample = db.prepare('SELECT id, student_code, admission_number, first_name FROM students LIMIT 5').all();
  console.log('Sample updated students:', sample);
}
