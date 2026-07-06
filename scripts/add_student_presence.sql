-- ============================================================================
-- Student presence tracking (online / last seen)
-- ============================================================================
-- Adds a `last_seen_at` timestamp to the students table. The student portal
-- pings this value periodically (heartbeat) while the tab is active, and the
-- admin student profile uses it to show whether a student is currently online
-- and, if not, when they were last seen.
--
-- Run this once on the live DB.
-- ============================================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Speeds up "who is online now" style filtering/sorting.
CREATE INDEX IF NOT EXISTS idx_students_last_seen_at
  ON students (last_seen_at DESC);
