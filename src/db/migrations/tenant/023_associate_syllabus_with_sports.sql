-- Migration: 023_associate_syllabus_with_sports.sql
-- Associates syllabus categories and techniques with sports disciplines (e.g., Karate, Kata, Kumite)

-- 1. Add sport_id column to syllabus_categories if not present
ALTER TABLE syllabus_categories ADD COLUMN sport_id INTEGER;

-- 2. Add sport_id column to syllabus_techniques if not present
ALTER TABLE syllabus_techniques ADD COLUMN sport_id INTEGER;

-- 3. Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_syllabus_categories_sport ON syllabus_categories(sport_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_techniques_sport ON syllabus_techniques(sport_id);

-- 4. Ensure Karate exists as a default primary sport if no sports exist
INSERT INTO sports (name, description, is_active)
SELECT 'Karate', 'Traditional Shotokan Karate, Kata, Kumite & Belt Progression', 1
WHERE NOT EXISTS (SELECT 1 FROM sports);

-- 5. Backfill existing categories:
-- If category name is Kata, Kumite, Kihon, Bunkai, or sport_id is NULL, link to Karate
UPDATE syllabus_categories
SET sport_id = (
  SELECT id FROM sports
  WHERE LOWER(name) = 'karate'
  LIMIT 1
)
WHERE sport_id IS NULL;

-- 6. Backfill existing techniques with their category's sport_id
UPDATE syllabus_techniques
SET sport_id = (
  SELECT sc.sport_id
  FROM syllabus_categories sc
  WHERE sc.id = syllabus_techniques.category_id
)
WHERE sport_id IS NULL;
