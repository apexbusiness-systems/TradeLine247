
-- Migration to add agent history support

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS agent_history JSONB DEFAULT '{}'::jsonb;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS current_stage TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS caller_email TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_reason TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS caller_name TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS urgency BOOLEAN DEFAULT FALSE;
