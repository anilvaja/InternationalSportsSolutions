import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CENTRAL_DB_PATH = path.resolve(__dirname, '..', 'data', 'central.db');

console.log('Connecting to central database at:', CENTRAL_DB_PATH);
const db = new Database(CENTRAL_DB_PATH);
db.pragma('foreign_keys = OFF');

console.log('Truncating subscription plan tables...');
db.prepare('DELETE FROM subscription_plan_limits').run();
db.prepare('DELETE FROM subscription_plan_features').run();
db.prepare('DELETE FROM subscription_plans').run();
try {
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('subscription_plans', 'subscription_plan_limits', 'subscription_plan_features')").run();
} catch (e) {}

const cleanPlans = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'Starter tier for single-branch sports clubs and individual dojos',
    price: 999,
    billing_interval: 'monthly',
    trial_days: 14,
    status: 'active',
    is_default: 1,
    limits: {
      branches: 1,
      coaches: 3,
      batches: 5,
      students: 75,
      students_per_batch: 25,
      users: 5,
    },
    features: {
      syllabus: 1,
      facilities: 1,
      events: 0,
      payroll: 0,
    },
  },
  {
    name: 'Standard',
    slug: 'standard',
    description: 'Best for growing sports academies with multiple batches, schedules, and staff',
    price: 2499,
    billing_interval: 'monthly',
    trial_days: 14,
    status: 'active',
    is_default: 0,
    limits: {
      branches: 3,
      coaches: 10,
      batches: 15,
      students: 250,
      students_per_batch: 30,
      users: 15,
    },
    features: {
      syllabus: 1,
      facilities: 1,
      events: 1,
      payroll: 1,
    },
  },
  {
    name: 'Professional',
    slug: 'professional',
    description: 'High-capacity multi-campus academies with extensive payroll and event operations',
    price: 4999,
    billing_interval: 'monthly',
    trial_days: 30,
    status: 'active',
    is_default: 0,
    limits: {
      branches: 8,
      coaches: 25,
      batches: 40,
      students: 800,
      students_per_batch: 40,
      users: 35,
    },
    features: {
      syllabus: 1,
      facilities: 1,
      events: 1,
      payroll: 1,
    },
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Nationwide sports organizations and federations with priority SLA and scale',
    price: 9999,
    billing_interval: 'monthly',
    trial_days: 30,
    status: 'active',
    is_default: 0,
    limits: {
      branches: 25,
      coaches: 100,
      batches: 150,
      students: 3000,
      students_per_batch: 60,
      users: 100,
    },
    features: {
      syllabus: 1,
      facilities: 1,
      events: 1,
      payroll: 1,
    },
  },
];

const insertPlan = db.prepare(`
  INSERT INTO subscription_plans (name, slug, description, price, billing_interval, trial_days, status, is_default)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertLimit = db.prepare(`
  INSERT INTO subscription_plan_limits (plan_id, quota_key, limit_value, counting_policy)
  VALUES (?, ?, ?, 'active_only')
`);

const insertFeature = db.prepare(`
  INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled)
  VALUES (?, ?, ?)
`);

for (const plan of cleanPlans) {
  const res = insertPlan.run(
    plan.name,
    plan.slug,
    plan.description,
    plan.price,
    plan.billing_interval,
    plan.trial_days,
    plan.status,
    plan.is_default
  );
  const planId = Number(res.lastInsertRowid);
  console.log(`✔ Created Plan ID ${planId}: ${plan.name} (${plan.slug}) - ₹${plan.price}/${plan.billing_interval}`);

  for (const [k, v] of Object.entries(plan.limits)) {
    insertLimit.run(planId, k, v);
  }

  for (const [k, v] of Object.entries(plan.features)) {
    insertFeature.run(planId, k, v);
  }
}

db.pragma('foreign_keys = ON');
db.exec('VACUUM;');
db.close();

console.log('\n✅ Subscription plans successfully truncated and recreated (4 official tiers).');
