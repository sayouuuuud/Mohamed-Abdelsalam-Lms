ALTER TABLE lectures ADD COLUMN IF NOT EXISTS what_you_learn text[] DEFAULT '{}';
