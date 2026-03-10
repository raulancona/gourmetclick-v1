-- Add explicit opening and closing user names to session and cash cut tables
ALTER TABLE sesiones_caja 
ADD COLUMN IF NOT EXISTS opened_by_user_name TEXT,
ADD COLUMN IF NOT EXISTS closed_by_user_name TEXT;

ALTER TABLE cash_cuts
ADD COLUMN IF NOT EXISTS opened_by_user_name TEXT,
ADD COLUMN IF NOT EXISTS closed_by_user_name TEXT;
