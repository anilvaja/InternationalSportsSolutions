import { getTenantDbById } from '../src/db/connectionManager.js';

export function seedKataAndKumite() {
  const db = getTenantDbById(1);
  const academyId = 1;

  console.log('[Syllabus Seed] Seeding official Kata & Kumite for Mahavir Sports Academy...');

  // 1. Clean up temporary test data if any
  db.prepare("UPDATE student_attendance SET technique_id = NULL").run();
  db.prepare("DELETE FROM attendance_technique_snapshots").run();
  db.prepare("DELETE FROM student_technique_assignments").run();
  db.prepare("DELETE FROM students WHERE id NOT IN (1, 2, 3, 4, 5, 6)").run();
  db.prepare("DELETE FROM syllabus_techniques WHERE category_id IN (SELECT id FROM syllabus_categories WHERE name LIKE '%-1792%')").run();
  db.prepare("DELETE FROM syllabus_categories WHERE name LIKE '%-1792%'").run();

  // 2. Ensure or Create "Kata Forms" Category
  let catKata = db.prepare('SELECT id FROM syllabus_categories WHERE academy_id = ? AND name = ?').get(academyId, 'Kata Forms');
  if (!catKata) {
    const res = db.prepare(`
      INSERT INTO syllabus_categories (academy_id, name, description, display_order, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(
      academyId,
      'Kata Forms',
      'Traditional formal pattern sequences combining stances, blocks, punches, and strikes to develop speed, precision, and discipline.',
      1
    );
    catKata = { id: res.lastInsertRowid };
  }

  // 3. Ensure or Create "Kumite & Sparring" Category
  let catKumite = db.prepare('SELECT id FROM syllabus_categories WHERE academy_id = ? AND name = ?').get(academyId, 'Kumite & Sparring');
  if (!catKumite) {
    const res = db.prepare(`
      INSERT INTO syllabus_categories (academy_id, name, description, display_order, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(
      academyId,
      'Kumite & Sparring',
      'Progressive combat drills from predetermined multi-step sparring to semi-free and live competitive tournament sparring.',
      2
    );
    catKumite = { id: res.lastInsertRowid };
  }

  // Helper statement
  const insertTech = db.prepare(`
    INSERT INTO syllabus_techniques (
      academy_id, category_id, name, code, description, level, belt_level, media_url, display_order, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  // 4. Seed Kata Forms Techniques
  const kataList = [
    {
      name: 'Heian Shodan (Form 1)',
      code: 'KATA-01',
      desc: '21 movements focusing on forward stance (Zenkutsu-Dachi), down block (Gedan-Barai), and lunge punches.',
      lvl: 1,
      belt: 'Yellow Belt',
      url: 'https://www.youtube.com/watch?v=D3B8Wv6XQ8o',
      order: 1,
    },
    {
      name: 'Heian Nidan (Form 2)',
      code: 'KATA-02',
      desc: '26 movements introducing back stance (Kokutsu-Dachi), knife-hand block (Shuto-Uke), and side kick.',
      lvl: 2,
      belt: 'Orange Belt',
      url: 'https://www.youtube.com/watch?v=0k1L4tZ6xHQ',
      order: 2,
    },
    {
      name: 'Heian Sandan (Form 3)',
      code: 'KATA-03',
      desc: '20 movements emphasizing horse-riding stance (Kiba-Dachi), inside-out block, and elbow strikes.',
      lvl: 3,
      belt: 'Green Belt',
      url: 'https://www.youtube.com/watch?v=1xN8gT0tF5A',
      order: 3,
    },
    {
      name: 'Heian Yondan (Form 4)',
      code: 'KATA-04',
      desc: '27 dynamic movements featuring high double forearm blocks, jumping knee strikes, and front kick combinations.',
      lvl: 4,
      belt: 'Purple Belt',
      url: 'https://www.youtube.com/watch?v=2rE5vB7mZ9U',
      order: 4,
    },
    {
      name: 'Heian Godan (Form 5)',
      code: 'KATA-05',
      desc: '23 advanced movements including jumping pivot kicks, crescent blocks, and water-drop mid-air recovery.',
      lvl: 4,
      belt: 'Brown Belt',
      url: 'https://www.youtube.com/watch?v=8mK3pQ4xV2L',
      order: 5,
    },
    {
      name: 'Tekki Shodan (Iron Horse 1)',
      code: 'KATA-06',
      desc: 'Shotokan brown/black belt requirement performed entirely in Kiba-Dachi along a linear lateral axis.',
      lvl: 5,
      belt: 'Black Belt (1st Dan)',
      url: 'https://www.youtube.com/watch?v=9xT4rW2mQ1P',
      order: 6,
    },
  ];

  const kataIds = {};
  for (const k of kataList) {
    let row = db.prepare('SELECT id FROM syllabus_techniques WHERE academy_id = ? AND category_id = ? AND name = ?').get(academyId, catKata.id, k.name);
    if (!row) {
      const res = insertTech.run(academyId, catKata.id, k.name, k.code, k.desc, k.lvl, k.belt, k.url, k.order);
      kataIds[k.code] = res.lastInsertRowid;
    } else {
      kataIds[k.code] = row.id;
    }
  }

  // 5. Seed Kumite Techniques
  const kumiteList = [
    {
      name: 'Gohon Kumite (Five-Step Sparring)',
      code: 'KUM-01',
      desc: 'Fundamental five-step linear attack and defense drills practicing distance (Maai) and high/mid blocks.',
      lvl: 1,
      belt: 'White / Yellow Belt',
      url: 'https://www.youtube.com/watch?v=3bH7vL2kP9o',
      order: 1,
    },
    {
      name: 'Sanbon Kumite (Three-Step Sparring)',
      code: 'KUM-02',
      desc: 'Three attack combinations (Jodan, Chudan, Mae-Geri) with counter reverse punches (Gyaku-Zuki).',
      lvl: 2,
      belt: 'Orange Belt',
      url: 'https://www.youtube.com/watch?v=4cH8wM3lQ0p',
      order: 2,
    },
    {
      name: 'Kihon Ippon Kumite (One-Step Basic Sparring)',
      code: 'KUM-03',
      desc: 'Single explosive attack with evasive body shifting (Tai Sabaki) and precise counter attack.',
      lvl: 3,
      belt: 'Green Belt',
      url: 'https://www.youtube.com/watch?v=5dI9xN4mR1q',
      order: 3,
    },
    {
      name: 'Jiyu Ippon Kumite (Semi-Free Sparring)',
      code: 'KUM-04',
      desc: 'Dynamic bouncing stance combat with unpredictable timing, feints, and controlled contact strikes.',
      lvl: 4,
      belt: 'Purple / Brown Belt',
      url: 'https://www.youtube.com/watch?v=6eJ0yO5nS2r',
      order: 4,
    },
    {
      name: 'Jiyu Kumite (Freestyle Tournament Sparring)',
      code: 'KUM-05',
      desc: 'Full speed tournament rules sparring emphasizing rapid footwork, defensive sweep counters, and score points.',
      lvl: 5,
      belt: 'Brown & Black Belt',
      url: 'https://www.youtube.com/watch?v=7fK1zP6oT3s',
      order: 5,
    },
  ];

  const kumiteIds = {};
  for (const km of kumiteList) {
    let row = db.prepare('SELECT id FROM syllabus_techniques WHERE academy_id = ? AND category_id = ? AND name = ?').get(academyId, catKumite.id, km.name);
    if (!row) {
      const res = insertTech.run(academyId, catKumite.id, km.name, km.code, km.desc, km.lvl, km.belt, km.url, km.order);
      kumiteIds[km.code] = res.lastInsertRowid;
    } else {
      kumiteIds[km.code] = row.id;
    }
  }

  // 6. Assign clean techniques to actual students (Aarav, Diya, Vivaan, Ananya)
  db.prepare('DELETE FROM student_technique_assignments WHERE student_id IN (1, 2, 3, 4)').run();

  const assign = db.prepare(`
    INSERT INTO student_technique_assignments (academy_id, student_id, technique_id, assigned_by, start_date, end_date, status, sessions_attended, remarks)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
  `);

  // Student 1 (Aarav Patel): Active on Heian Shodan (Form 1)
  assign.run(academyId, 1, kumiteIds['KUM-01'], '2026-06-01', '2026-07-31', 'completed', 16, 'Completed Gohon Kumite foundations');
  assign.run(academyId, 1, kataIds['KATA-01'], '2026-08-01', null, 'active', 22, 'Mastering Heian Shodan for upcoming Yellow Belt grading');

  // Student 2 (Diya Shah): Active on Sanbon Kumite
  assign.run(academyId, 2, kumiteIds['KUM-02'], '2026-09-01', null, 'active', 14, 'Practicing counter-strikes and distance control');

  // Student 3 (Vivaan Desai): Active on Heian Nidan (Form 2)
  assign.run(academyId, 3, kataIds['KATA-02'], '2026-08-15', null, 'active', 18, 'Refining back stance and knife-hand execution');

  // Student 4 (Ananya Joshi): Active on Jiyu Ippon Kumite
  assign.run(academyId, 4, kumiteIds['KUM-04'], '2026-07-01', null, 'active', 26, 'Excellent tactical movement, preparing for Purple Belt');

  // 7. Seed Attendance Snapshots for realism
  db.prepare('DELETE FROM attendance_technique_snapshots WHERE student_id IN (1, 2, 3, 4)').run();
  const insertSnap = db.prepare(`
    INSERT INTO attendance_technique_snapshots (attendance_id, student_id, technique_id, technique_level, progression_action, sessions_count_at_time, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertSnap.run(1, 1, kataIds['KATA-01'], 1, 'keep', 21, 'Solid hip rotation and down-block timing');
  insertSnap.run(2, 1, kataIds['KATA-01'], 1, 'keep', 22, 'Ready for Yellow Belt Kata test');
  insertSnap.run(1, 2, kumiteIds['KUM-02'], 2, 'keep', 13, 'Improved reverse punch timing');
  insertSnap.run(2, 2, kumiteIds['KUM-02'], 2, 'keep', 14, 'Good distance management');
  insertSnap.run(1, 4, kumiteIds['KUM-04'], 4, 'keep', 25, 'Sharp feints and counter attacks');
  insertSnap.run(2, 4, kumiteIds['KUM-04'], 4, 'keep', 26, 'Ready for mock tournament sparring');

  console.log('[Syllabus Seed] Successfully seeded 6 Kata and 5 Kumite techniques!');
}

if (process.argv[1] && process.argv[1].endsWith('seed_kata_kumite.js')) {
  seedKataAndKumite();
}
