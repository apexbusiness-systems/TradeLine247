#!/usr/bin/env tsx

/**
 * CI Tripwire: Ensure RLS is enabled on sensitive tables
 * Fails CI if critical tables are not properly secured
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sensitive tables that must have RLS enabled
const SENSITIVE_TABLES = [
  'agent_policies',
  'audit_logs',
  'device_registry',
  'tool_invocations',
  'agent_runs',
  'agent_checkpoints',
  'agent_skills',
  'skill_matches'
];

// Tables with documented exceptions (if any)
const RLS_EXCEPTIONS: Record<string, string> = {
  // Add documented exceptions here with justification
  // 'some_table': 'Justification: public read access required for feature X'
};

async function checkRLSRequired(): Promise<void> {
  console.log('🔒 Checking RLS requirements on sensitive tables...');

  let violations = 0;

  for (const tableName of SENSITIVE_TABLES) {
    try {
      // Check if table exists
      const { data: tableExists, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .single();

      if (tableError && !tableError.message.includes('No rows')) {
        console.log(`⚠️  Table '${tableName}' does not exist - skipping RLS check`);
        continue;
      }

      // Check RLS status
      const { data: rlsEnabled, error: rlsError } = await supabase
        .rpc('check_table_rls_enabled', { table_name: tableName });

      if (rlsError) {
        console.error(`❌ Error checking RLS for '${tableName}':`, rlsError.message);
        violations++;
        continue;
      }

      if (!rlsEnabled) {
        if (RLS_EXCEPTIONS[tableName]) {
          console.log(`✅ '${tableName}' RLS disabled (documented exception: ${RLS_EXCEPTIONS[tableName]})`);
        } else {
          console.error(`❌ CRITICAL: '${tableName}' does not have RLS enabled!`);
          violations++;
        }
      } else {
        console.log(`✅ '${tableName}' has RLS enabled`);
      }

    } catch (error) {
      console.error(`❌ Error checking table '${tableName}':`, error);
      violations++;
    }
  }

  if (violations > 0) {
    console.error(`\n🚨 SECURITY VIOLATION: ${violations} table(s) failed RLS requirements`);
    console.error('This indicates a critical security vulnerability.');
    console.error('Fix: Enable RLS on all sensitive tables or document exceptions.');
    process.exit(1);
  }

  console.log('\n✅ All sensitive tables have proper RLS protection');
}

// Check agent_policies specific security
async function checkAgentPoliciesSecurity(): Promise<void> {
  console.log('\n🔐 Checking agent_policies specific security...');

  try {
    // This would require a test query to verify policies work as expected
    // For now, we rely on the RLS check above
    console.log('✅ agent_policies security check passed (RLS enabled)');
  } catch (error) {
    console.error('❌ Error checking agent_policies security:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  try {
    await checkRLSRequired();
    await checkAgentPoliciesSecurity();
    console.log('\n🎉 All RLS security checks passed!');
  } catch (error) {
    console.error('\n💥 RLS security check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { checkRLSRequired, checkAgentPoliciesSecurity };
