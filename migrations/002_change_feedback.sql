-- Migration: Create change_feedback table
-- Run this in Supabase SQL Editor

-- Create change_feedback table for user feedback on changes
CREATE TABLE IF NOT EXISTS public.change_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id UUID NOT NULL REFERENCES public.changes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL CHECK (feedback IN ('noise', 'useful', 'critical')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (change_id, user_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_change_feedback_change_id ON public.change_feedback(change_id);
CREATE INDEX IF NOT EXISTS idx_change_feedback_user_id ON public.change_feedback(user_id);

-- Enable RLS
ALTER TABLE public.change_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see/insert their own feedback
CREATE POLICY "Users can view own feedback" ON public.change_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON public.change_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role bypass for API server
CREATE POLICY "Service role full access to change_feedback" ON public.change_feedback
  FOR ALL USING (true) WITH CHECK (true);
