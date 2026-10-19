-- Migration: 010_dynamic_sports_management.sql
-- Enforces case-insensitive uniqueness, de-duplicates existing sports, and seeds primary Karate sport

-- 1. Ensure Karate is present as the primary martial arts sport
INSERT INTO sports (name, description, is_active)
SELECT 'Karate', 'Traditional Shotokan Karate, Kata, Kumite & Belt Progression', 1
WHERE NOT EXISTS (SELECT 1 FROM sports WHERE LOWER(name) = 'karate');

-- 2. De-duplicate references in foreign tables pointing to duplicate sport IDs
UPDATE coaches
SET sport_id = (
  SELECT MIN(s2.id)
  FROM sports s2
  JOIN sports s1 ON LOWER(s1.name) = LOWER(s2.name)
  WHERE s1.id = coaches.sport_id
)
WHERE sport_id IS NOT NULL;

UPDATE batches
SET sport_id = (
  SELECT MIN(s2.id)
  FROM sports s2
  JOIN sports s1 ON LOWER(s1.name) = LOWER(s2.name)
  WHERE s1.id = batches.sport_id
)
WHERE sport_id IS NOT NULL;

UPDATE equipment_inventory
SET sport_id = (
  SELECT MIN(s2.id)
  FROM sports s2
  JOIN sports s1 ON LOWER(s1.name) = LOWER(s2.name)
  WHERE s1.id = equipment_inventory.sport_id
)
WHERE sport_id IS NOT NULL;

UPDATE fee_structures
SET sport_id = (
  SELECT MIN(s2.id)
  FROM sports s2
  JOIN sports s1 ON LOWER(s1.name) = LOWER(s2.name)
  WHERE s1.id = fee_structures.sport_id
)
WHERE sport_id IS NOT NULL;

-- 3. Delete duplicate sport rows keeping only the canonical minimum ID for each name
DELETE FROM sports
WHERE id NOT IN (
  SELECT MIN(id)
  FROM sports
  GROUP BY LOWER(name)
);

-- 4. Create unique index to permanently prevent future duplicate sport names
CREATE UNIQUE INDEX IF NOT EXISTS idx_sports_name_unique ON sports(name COLLATE NOCASE);
