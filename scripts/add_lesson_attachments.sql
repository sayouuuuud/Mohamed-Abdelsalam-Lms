-- Add attachments JSONB column to lessons
-- Each entry: { name: string, url: string, type: 'pdf' | 'doc' | 'image' | 'other' }
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
