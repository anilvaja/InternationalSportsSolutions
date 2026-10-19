-- Migration: 020_gps_geofenced_staff_punches.sql
-- Description: GPS Location Tracking & Geofenced Punch In/Out for Staff & Coaches

-- 1. Add Geofence Columns to Branches
ALTER TABLE branches ADD COLUMN latitude REAL;
ALTER TABLE branches ADD COLUMN longitude REAL;
ALTER TABLE branches ADD COLUMN geofence_radius_meters INTEGER DEFAULT 100;
ALTER TABLE branches ADD COLUMN is_geofence_enforced INTEGER DEFAULT 1;

-- 2. Populate Default Geofence Coordinates for Existing Branches (Mumbai / Vadodara reference coords)
UPDATE branches 
SET latitude = 19.0760, 
    longitude = 72.8777, 
    geofence_radius_meters = 150, 
    is_geofence_enforced = 1 
WHERE latitude IS NULL;

-- 3. Create staff_punches Table
CREATE TABLE IF NOT EXISTS staff_punches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  punch_type TEXT CHECK(punch_type IN ('punch_in', 'punch_out')) NOT NULL,
  punched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_meters REAL,
  distance_meters REAL NOT NULL,
  is_within_geofence INTEGER NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_staff_punches_user_time ON staff_punches(user_id, punched_at);
CREATE INDEX IF NOT EXISTS idx_staff_punches_branch ON staff_punches(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_punches_type ON staff_punches(punch_type);
