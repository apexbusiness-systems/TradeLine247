-- Ensure RLS is enabled and policies are set for public.call_transcripts.
-- Idempotent migration: safe to run multiple times.

DO $$
DECLARE
  target_schema constant text := 'public';
  target_table constant text := 'call_transcripts';
  service_policy constant text := 'service_role_can_manage_call_transcripts';
  read_policy constant text := 'authenticated_can_read_call_transcripts';
BEGIN
  IF to_regclass(format('%I.%I', target_schema, target_table)) IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target_schema, target_table);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = target_schema
        AND tablename = target_table
        AND policyname = service_policy
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
        service_policy,
        target_schema,
        target_table
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = target_schema
        AND tablename = target_table
        AND policyname = read_policy
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR SELECT USING (auth.role() = ''authenticated'')',
        read_policy,
        target_schema,
        target_table
      );
    END IF;
  END IF;
END $$;
