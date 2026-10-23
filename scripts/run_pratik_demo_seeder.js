#!/usr/bin/env node

/**
 * CLI Runner for Pratik Karate Academy Demo Seeder
 * 
 * Usage:
 *   node scripts/run_pratik_demo_seeder.js
 */

import { PratikKarateAcademyDemoSeeder } from '../src/db/pratikKarateAcademyDemoSeeder.js';

async function main() {
  console.log('==================================================================');
  console.log('🥋 Starting Pratik Karate Academy Dedicated Demo Seeder');
  console.log('==================================================================');

  try {
    const results = await PratikKarateAcademyDemoSeeder.run();
    console.log(JSON.stringify(results, null, 2));

    if (results.success) {
      console.log('==================================================================');
      console.log(`✅ Seeder completed successfully in ${results.durationMs}ms`);
      console.log(`   Execution ID: ${results.executionId}`);
      console.log(`   Branches:     ${results.stats.branchesCreated} created, ${results.stats.branchesReused} reused`);
      console.log(`   Batches:      ${results.stats.batchesCreated} created, ${results.stats.batchesReused} reused`);
      console.log(`   Staff:        ${results.stats.staffCreated} created, ${results.stats.staffReused} reused`);
      console.log(`   Students:     ${results.stats.studentsCreated} created, ${results.stats.studentsReused} reused`);
      console.log(`   Salary Check: ${results.stats.salaryStatementsVerified} / 6 statements verified against attendance`);
      console.log('==================================================================');
      process.exit(0);
    } else {
      console.error('❌ Seeder finished with errors:', results.errors);
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Fatal seeder error:', err);
    process.exit(1);
  }
}

main();
