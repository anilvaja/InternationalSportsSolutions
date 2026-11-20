-- Central Database Migration: Platform Sales Inquiries for Prospective Academy Owners
-- Version: 006

CREATE TABLE IF NOT EXISTS platform_sales_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  approx_students TEXT,
  approx_branches TEXT,
  interested_plan TEXT,
  message TEXT,
  status TEXT DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'demo_scheduled', 'converted', 'closed')),
  ip_address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_sales_inquiries_status ON platform_sales_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_platform_sales_inquiries_created_at ON platform_sales_inquiries(created_at);
