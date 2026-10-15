import { getCentralDb } from '../src/db/centralDb.js';
import { getTenantDbById } from '../src/db/connectionManager.js';

async function main() {
  const centralDb = getCentralDb();
  const academies = centralDb.prepare('SELECT id, name, slug FROM academies').all();
  console.log(`Found ${academies.length} academies in central registry.`);

  for (const a of academies) {
    console.log(`\n--- Inspecting Academy ID: ${a.id} (${a.name} / ${a.slug}) ---`);
    const db = getTenantDbById(a.id);
    
    // Check tables / views / indexes
    const objects = db.prepare(`
      SELECT name, type 
      FROM sqlite_master 
      WHERE name IN ('student_batch_enrollments', 'student_batches', 'idx_student_single_active_batch')
    `).all();
    console.log('Schema objects:', objects);

    // Check count of active enrollments
    const enrollmentsCount = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
             SUM(CASE WHEN status = 'transferred' THEN 1 ELSE 0 END) as transferred_count
      FROM student_batch_enrollments
    `).get();
    console.log('Enrollments summary:', enrollmentsCount);

    // Audit: Check if any student has more than 1 active batch
    const duplicates = db.prepare(`
      SELECT student_id, COUNT(*) as cnt
      FROM student_batch_enrollments
      WHERE status = 'active'
      GROUP BY student_id
      HAVING cnt > 1
    `).all();
    if (duplicates.length > 0) {
      console.error('CRITICAL: Duplicate active batches detected for students:', duplicates);
    } else {
      console.log('Integrity check passed: No duplicate active batches.');
    }

    // Audit: Check batches without a branch
    const orphanBatches = db.prepare(`
      SELECT b.id, b.name FROM batches b
      LEFT JOIN branches br ON br.id = b.branch_id
      WHERE b.branch_id IS NULL OR br.id IS NULL
    `).all();
    if (orphanBatches.length > 0) {
      console.warn('Warning: Batches missing valid branch:', orphanBatches);
    } else {
      console.log('Integrity check passed: All batches belong to valid branches.');
    }
  }

  console.log('\n--- Relationship Verification Completed Successfully ---');
}

main().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
