-- Deduplicate leave_policies table keeping the lowest id per unique combination
DELETE FROM leave_policies
WHERE id NOT IN (
  SELECT MIN(id)
  FROM leave_policies
  GROUP BY academy_id, COALESCE(branch_id, -1), leave_type
);

-- Unique index for global policies where branch_id is NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_policies_global
ON leave_policies(academy_id, leave_type)
WHERE branch_id IS NULL;

-- Unique index for branch-specific policies
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_policies_branch
ON leave_policies(academy_id, branch_id, leave_type)
WHERE branch_id IS NOT NULL;

-- Normalize duplicate initial quota in employee_leave_balances
UPDATE employee_leave_balances
SET accrued = 0
WHERE accrued = opening_balance AND opening_balance > 0;
