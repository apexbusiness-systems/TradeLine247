-- Ensure RLS is enabled and policy set for public.call_transcripts.
-- Idempotent migration: safe to run multiple times.

DO $$
BEGIN
  IF to_regclass('public.call_transcripts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.call_transcripts') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'call_transcripts'
         AND policyname = 'service_role_can_manage_call_transcripts'
     ) THEN
    EXECUTE $policy$
      CREATE POLICY service_role_can_manage_call_transcripts
      ON public.call_transcripts
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.call_transcripts') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'call_transcripts'
         AND policyname = 'authenticated_can_read_call_transcripts'
     ) THEN
    EXECUTE $policy$
      CREATE POLICY authenticated_can_read_call_transcripts
      ON public.call_transcripts
      FOR SELECT
      USING (auth.role() = 'authenticated')
    $policy$;
  END IF;
END $$;
