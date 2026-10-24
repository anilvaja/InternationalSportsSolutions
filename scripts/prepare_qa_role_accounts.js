import bcrypt from 'bcryptjs';
import { getCentralDb } from '../src/db/centralDb.js';
import { getTenantDbById } from '../src/db/connectionManager.js';

export function prepareQaRoleAccounts() {
  console.log('🔄 Preparing dedicated test accounts for every configured role...');
  const centralDb = getCentralDb();
  const tenantDb = getTenantDbById(1);

  const hashPassword = (pw) => bcrypt.hashSync(pw, 10);

  // 1. Super Admin in centralDb
  const saPw = hashPassword('password');
  centralDb.prepare(`
    INSERT INTO super_admins (name, email, password_hash, status)
    VALUES ('Anil Vaja (Super Admin)', 'anilvaja.007@gmail.com', ?, 'active')
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, status = 'active'
  `).run(saPw);

  // Ensure Pratik Karate Academy exists in centralDb
  centralDb.prepare(`
    INSERT INTO academies (id, name, slug, contact_email, status, plan, max_branches, max_students, max_coaches, db_path)
    VALUES (1, 'Pratik Karate Academy', 'pratik-karate-academy', 'admin@pratikkarate.com', 'active', 'enterprise', 10, 500, 50, 'data/academies/academy_1.db')
    ON CONFLICT(id) DO UPDATE SET name = 'Pratik Karate Academy', slug = 'pratik-karate-academy', contact_email = 'admin@pratikkarate.com', status = 'active'
  `).run();

  // 2. Staff Roles in Tenant 1 DB
  const staffAccounts = [
    {
      name: 'Pratik Academy Admin',
      email: 'admin@pratikkarate.com',
      password: 'password123',
      role: 'academy_admin',
      phone: '+91 98250 00001'
    },
    {
      name: 'Sensei Pratik Patel',
      email: 'pratik.headcoach@pratikkarate.com',
      password: 'coach123',
      role: 'head_coach',
      phone: '+91 98250 20001'
    },
    {
      name: 'Sensei Rajesh Sharma',
      email: 'rajesh.kumite@pratikkarate.com',
      password: 'coach123',
      role: 'coach',
      phone: '+91 98250 20002'
    },
    {
      name: 'Anita Shah',
      email: 'anita.finance@pratikkarate.com',
      password: 'staff123',
      role: 'finance_manager',
      phone: '+91 98250 20006'
    },
    {
      name: 'Vikram Desai',
      email: 'vikram.staff@pratikkarate.com',
      password: 'staff123',
      role: 'front_desk',
      phone: '+91 98250 20005'
    },
    {
      name: 'Riddhi Joshi',
      email: 'receptionist@pratikkarate.com',
      password: 'staff123',
      role: 'receptionist',
      phone: '+91 98250 20007'
    },
    {
      name: 'Karan Dave',
      email: 'staff@pratikkarate.com',
      password: 'staff123',
      role: 'academy_staff',
      phone: '+91 98250 20008'
    }
  ];

  for (const acc of staffAccounts) {
    const pwHash = hashPassword(acc.password);
    let u = tenantDb.prepare('SELECT id FROM users WHERE email = ?').get(acc.email);
    if (!u) {
      const ins = tenantDb.prepare(`
        INSERT INTO users (name, email, password_hash, role, phone, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(acc.name, acc.email, pwHash, acc.role, acc.phone);
      u = { id: ins.lastInsertRowid };
    } else {
      tenantDb.prepare(`
        UPDATE users
        SET name = ?, password_hash = ?, role = ?, phone = ?, status = 'active'
        WHERE id = ?
      `).run(acc.name, pwHash, acc.role, acc.phone, u.id);
    }

    // Assign to Branch 1
    const branch = tenantDb.prepare('SELECT id FROM branches LIMIT 1').get();
    if (branch) {
      tenantDb.prepare(`
        INSERT INTO user_branch_assignments (academy_id, user_id, branch_id, is_primary, effective_from)
        SELECT 1, ?, ?, 1, '2025-01-01'
        WHERE NOT EXISTS (
          SELECT 1 FROM user_branch_assignments WHERE user_id = ? AND branch_id = ?
        )
      `).run(u.id, branch.id, u.id, branch.id);
    }

    // Sync to central router table
    centralDb.prepare(`
      INSERT INTO academy_users_lookup (email, academy_id, role)
      VALUES (?, 1, ?)
      ON CONFLICT(email, academy_id) DO UPDATE SET role = excluded.role
    `).run(acc.email, acc.role);
  }

  // 3. Student Account in Tenant 1 DB
  const stuPw = hashPassword('student123');
  const stuEmail = 'aarav.mehta@demostudent.iss';
  let stu = tenantDb.prepare('SELECT id FROM students WHERE email = ?').get(stuEmail);
  const branch = tenantDb.prepare('SELECT id FROM branches LIMIT 1').get();
  const batch = tenantDb.prepare('SELECT id FROM batches LIMIT 1').get();

  if (!stu) {
    const ins = tenantDb.prepare(`
      INSERT INTO students (
        student_code, first_name, last_name, email, password_hash,
        phone, date_of_birth, gender, guardian_name, guardian_phone,
        branch_id, academy_id, status, enrolled_at
      ) VALUES (
        'STU-001', 'Aarav', 'Mehta', ?, ?,
        '+91 98250 30001', '2012-04-15', 'male', 'Mehta Guardian', '+91 98250 30001',
        ?, 1, 'active', '2025-06-10'
      )
    `).run(stuEmail, stuPw, branch ? branch.id : 1);
    stu = { id: ins.lastInsertRowid };
  } else {
    tenantDb.prepare(`
      UPDATE students
      SET password_hash = ?, status = 'active'
      WHERE id = ?
    `).run(stuPw, stu.id);
  }

  // Ensure active batch enrollment
  if (batch && stu) {
    const activeEnr = tenantDb.prepare("SELECT id FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'").get(stu.id);
    if (!activeEnr) {
      tenantDb.prepare(`
        INSERT INTO student_batch_enrollments (student_id, batch_id, status, start_date)
        VALUES (?, ?, 'active', '2025-06-10')
      `).run(stu.id, batch.id);
    }
  }

  // Sync student to central router table
  centralDb.prepare(`
    INSERT INTO academy_users_lookup (email, academy_id, role)
    VALUES (?, 1, 'student')
    ON CONFLICT(email, academy_id) DO UPDATE SET role = 'student'
  `).run(stuEmail);

  console.log('✅ All 9 Role accounts successfully prepared and synced:');
  console.log('   1. super_admin     -> anilvaja.007@gmail.com / password');
  console.log('   2. academy_admin   -> admin@pratikkarate.com / password123');
  console.log('   3. head_coach      -> pratik.headcoach@pratikkarate.com / coach123');
  console.log('   4. coach           -> rajesh.kumite@pratikkarate.com / coach123');
  console.log('   5. finance_manager -> anita.finance@pratikkarate.com / staff123');
  console.log('   6. front_desk      -> vikram.staff@pratikkarate.com / staff123');
  console.log('   7. receptionist    -> receptionist@pratikkarate.com / staff123');
  console.log('   8. academy_staff   -> staff@pratikkarate.com / staff123');
  console.log('   9. student         -> aarav.mehta@demostudent.iss / student123');
}

if (process.argv[1].endsWith('prepare_qa_role_accounts.js')) {
  prepareQaRoleAccounts();
}
