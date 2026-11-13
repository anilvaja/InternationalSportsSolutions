import { getTenantDbById } from '../src/db/connectionManager.js';
const db = getTenantDbById(1);
console.log('employee_schedule_shifts columns:', db.pragma('table_info(employee_schedule_shifts)'));
console.log('employee_work_schedules columns:', db.pragma('table_info(employee_work_schedules)'));
const samples = db.prepare('SELECT * FROM employee_schedule_shifts LIMIT 5').all();
console.log('Sample shifts:', samples);

