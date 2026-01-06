-- Test RLS enforcement by attempting unauthorized access

-- 1. Try to access calls as anonymous user (should fail)
SET ROLE anon;
SELECT COUNT(*) FROM calls;
-- Expected: ERROR or 0 rows

-- 2. Reset role
RESET ROLE;

-- 3. Verify service role can access
SET ROLE service_role;
SELECT COUNT(*) FROM calls;
-- Expected: Returns actual count

RESET ROLE;
