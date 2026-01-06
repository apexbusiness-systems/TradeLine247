-- RLS Verification Script for TradeLine 24/7
-- Run: psql $DATABASE_URL -f scripts/verify-rls.sql

\echo '=== RLS AUDIT REPORT ==='
\echo ''

-- 1. Tables WITHOUT RLS enabled (CRITICAL)
\echo '1. Tables without RLS (should be 0):'
SELECT
  schemaname,
  tablename,
  '❌ CRITICAL: RLS NOT ENABLED' as status
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;

\echo ''

-- 2. Tables WITH RLS but NO policies (WARNING)
\echo '2. Tables with RLS but no policies:'
SELECT
  t.tablename,
  '⚠️  WARNING: RLS enabled but no policies' as status
FROM pg_tables t
LEFT JOIN (
  SELECT DISTINCT tablename
  FROM pg_policies
  WHERE schemaname = 'public'
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.tablename IS NULL
ORDER BY t.tablename;

\echo ''

-- 3. Policy count per critical table
\echo '3. Policy count for critical tables:'
SELECT
  tablename,
  COUNT(policyname) as policy_count,
  STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('calls', 'transcripts', 'customers', 'memberships', 'users', 'profiles')
GROUP BY tablename
ORDER BY tablename;

\echo ''
\echo '=== END AUDIT REPORT ==='
