-- Fix RLS issues found in audit
-- Run: psql $DATABASE_URL -f supabase/migrations/20260106065329_fix_rls.sql

-- Enable RLS on all public tables that don't have it enabled
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND rowsecurity = false
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'sql_%'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_record.tablename);
        RAISE NOTICE 'Enabled RLS on table: %', table_record.tablename;
    END LOOP;
END $$;

-- Add basic policies for critical tables (if they don't exist)
-- These are examples - adjust based on actual audit results

-- Calls table policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calls' AND policyname = 'users_view_own_calls') THEN
        CREATE POLICY "users_view_own_calls"
          ON calls
          FOR SELECT
          USING (auth.uid() = customer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calls' AND policyname = 'service_role_full_access') THEN
        CREATE POLICY "service_role_full_access"
          ON calls
          FOR ALL
          USING (auth.jwt() ->> 'role' = 'service_role');
    END IF;
END $$;

-- Transcripts table policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transcripts' AND policyname = 'users_view_own_transcripts') THEN
        CREATE POLICY "users_view_own_transcripts"
          ON transcripts
          FOR SELECT
          USING (auth.uid() = customer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transcripts' AND policyname = 'service_role_transcripts_access') THEN
        CREATE POLICY "service_role_transcripts_access"
          ON transcripts
          FOR ALL
          USING (auth.jwt() ->> 'role' = 'service_role');
    END IF;
END $$;

-- Customers table policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'users_view_own_customer_data') THEN
        CREATE POLICY "users_view_own_customer_data"
          ON customers
          FOR SELECT
          USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'admin_full_access_customers') THEN
        CREATE POLICY "admin_full_access_customers"
          ON customers
          FOR ALL
          USING (auth.jwt() ->> 'role' = 'service_role');
    END IF;
END $$;

-- Memberships table policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memberships' AND policyname = 'users_view_own_memberships') THEN
        CREATE POLICY "users_view_own_memberships"
          ON memberships
          FOR SELECT
          USING (auth.uid() = customer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memberships' AND policyname = 'users_update_own_memberships') THEN
        CREATE POLICY "users_update_own_memberships"
          ON memberships
          FOR UPDATE
          USING (auth.uid() = customer_id);
    END IF;
END $$;

-- Users table policies (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users' AND schemaname = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_view_own_profile') THEN
            CREATE POLICY "users_view_own_profile"
              ON users
              FOR SELECT
              USING (auth.uid() = id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_update_own_profile') THEN
            CREATE POLICY "users_update_own_profile"
              ON users
              FOR UPDATE
              USING (auth.uid() = id);
        END IF;
    END IF;
END $$;

-- Profiles table policies (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles' AND schemaname = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_view_own_profile') THEN
            CREATE POLICY "users_view_own_profile"
              ON profiles
              FOR SELECT
              USING (auth.uid() = id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_update_own_profile') THEN
            CREATE POLICY "users_update_own_profile"
              ON profiles
              FOR UPDATE
              USING (auth.uid() = id);
        END IF;
    END IF;
END $$;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'RLS migration completed. Run audit script to verify: psql $DATABASE_URL -f scripts/verify-rls.sql';
END $$;
