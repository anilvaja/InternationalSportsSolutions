-- Tenant Database Schema: Migration 027
-- Description: Comprehensive Facility & Equipment Management, Stock Tracking, Issue & Return Logs

-- 1. Enhance equipment_inventory with category, purchase details, available stock, and responsible staff
ALTER TABLE equipment_inventory ADD COLUMN category TEXT DEFAULT 'General Equipment';
ALTER TABLE equipment_inventory ADD COLUMN description TEXT;
ALTER TABLE equipment_inventory ADD COLUMN available_quantity INTEGER DEFAULT 0;
ALTER TABLE equipment_inventory ADD COLUMN purchase_date DATE;
ALTER TABLE equipment_inventory ADD COLUMN purchase_cost REAL DEFAULT 0;
ALTER TABLE equipment_inventory ADD COLUMN supplier TEXT;
ALTER TABLE equipment_inventory ADD COLUMN responsible_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE equipment_inventory ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'maintenance', 'decommissioned'));
ALTER TABLE equipment_inventory ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Initialize available_quantity to match existing quantity if quantity > 0
UPDATE equipment_inventory SET available_quantity = quantity WHERE available_quantity = 0 AND quantity > 0;

-- 2. Create equipment_assignment_logs for tracking issues, returns, maintenance, damage and losses
CREATE TABLE IF NOT EXISTS equipment_assignment_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  equipment_id INTEGER NOT NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK(action IN ('issue', 'return', 'maintenance', 'damage_loss', 'adjustment')),
  quantity INTEGER NOT NULL DEFAULT 1,
  condition_on_action TEXT,
  action_date DATE NOT NULL,
  return_due_date DATE,
  actual_return_date DATE,
  cost REAL DEFAULT 0,
  notes TEXT,
  issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (equipment_id) REFERENCES equipment_inventory(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_equip_logs_equip ON equipment_assignment_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equip_logs_student ON equipment_assignment_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_equip_logs_staff ON equipment_assignment_logs(staff_id);
