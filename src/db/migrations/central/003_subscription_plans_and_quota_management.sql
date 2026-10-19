-- Central Database Migration: Subscription Plans, Quotas, and Overrides
-- Version: 003

CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT,
  price REAL DEFAULT 0,
  billing_interval TEXT DEFAULT 'monthly' CHECK(billing_interval IN ('monthly', 'yearly', 'quarterly')),
  trial_days INTEGER DEFAULT 14,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'draft')),
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_plan_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  quota_key TEXT NOT NULL,
  limit_value INTEGER NOT NULL CHECK(limit_value >= 0),
  counting_policy TEXT DEFAULT 'active_only',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
  UNIQUE(plan_id, quota_key)
);

CREATE TABLE IF NOT EXISTS subscription_plan_features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  feature_key TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
  UNIQUE(plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS academy_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('trial', 'active', 'expired', 'suspended', 'cancelled')),
  starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ends_at DATETIME,
  auto_renew INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS academy_limit_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  quota_key TEXT NOT NULL,
  override_value INTEGER NOT NULL CHECK(override_value >= 0),
  reason TEXT NOT NULL,
  starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ends_at DATETIME,
  changed_by_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_feature_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  feature_key TEXT NOT NULL,
  is_enabled INTEGER NOT NULL CHECK(is_enabled IN (0, 1)),
  reason TEXT,
  starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ends_at DATETIME,
  changed_by_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plan_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_plan_limits ON subscription_plan_limits(plan_id, quota_key);
CREATE INDEX IF NOT EXISTS idx_academy_subs ON academy_subscriptions(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_academy_limit_overrides ON academy_limit_overrides(academy_id, quota_key);
