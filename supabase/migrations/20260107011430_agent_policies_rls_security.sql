-- Phase 1: Governance Lockdown - agent_policies RLS Security
-- Ensures agent_policies table cannot be modified by anon/authenticated users

-- Enable RLS on agent_policies table
ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;

-- Deny all operations for anonymous users
CREATE POLICY "agent_policies_deny_anon" ON agent_policies
  FOR ALL USING (auth.role() != 'anon');

-- Deny all operations for authenticated users (require service role)
-- Safe default: only service role can access agent_policies
CREATE POLICY "agent_policies_service_role_only" ON agent_policies
  FOR ALL USING (auth.role() = 'service_role');

-- Alternative: If reads are needed by authenticated users, use this instead:
-- CREATE POLICY "agent_policies_read_only_for_authenticated" ON agent_policies
--   FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "agent_policies_service_role_write" ON agent_policies
--   FOR INSERT, UPDATE, DELETE USING (auth.role() = 'service_role');

COMMENT ON TABLE agent_policies IS 'Critical security table - service role access only';