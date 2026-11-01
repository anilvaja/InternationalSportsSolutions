import { getTenantDbById } from '../src/db/connectionManager.js';
import { getCentralDb } from '../src/db/centralDb.js';

const db = getTenantDbById(1);
const centralDb = getCentralDb();

const del = db.prepare("DELETE FROM users WHERE email LIKE 'test_%' OR email LIKE '%@example.com'").run();
console.log('Cleaned test users from tenant db:', del.changes);

const delCentral = centralDb.prepare("DELETE FROM academy_users_lookup WHERE email LIKE 'test_%' OR email LIKE '%@example.com'").run();
console.log('Cleaned test users from central lookup:', delCentral.changes);

const remaining = db.prepare("SELECT count(*) as c FROM users").get().c;
console.log('Remaining real users:', remaining);
