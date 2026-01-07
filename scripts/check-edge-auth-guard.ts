#!/usr/bin/env tsx

/**
 * CI Tripwire: Ensure edge functions use authentication guards
 * Fails CI if sensitive functions don't require authentication
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SENSITIVE_FUNCTIONS = [
  'rag-answer',
  'rag-retrieve',
  'rag-search',
  'rag-ingest',
  'voice-action',
  'voice-answer',
  'execute-automation',
  'apex-assistant',
  'apex-voice'
];

const FUNCTIONS_DIR = 'supabase/functions';

async function checkEdgeAuthGuard(): Promise<void> {
  console.log('🔐 Checking edge function authentication guards...');

  let violations = 0;

  try {
    const functionDirs = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const funcName of SENSITIVE_FUNCTIONS) {
      if (!functionDirs.includes(funcName)) {
        console.log(`⚠️  Function '${funcName}' does not exist - skipping auth check`);
        continue;
      }

      const indexPath = join(FUNCTIONS_DIR, funcName, 'index.ts');

      try {
        const content = readFileSync(indexPath, 'utf-8');

        // Check if function imports and uses requireAuth
        const hasRequireAuthImport = content.includes("requireAuth") &&
          content.includes("from '../_shared/security.ts'");

        const hasRequireAuthCall = content.includes("await requireAuth(req)") ||
          content.includes("await requireAuth(");

        if (hasRequireAuthImport && hasRequireAuthCall) {
          console.log(`✅ '${funcName}' has authentication guard`);
        } else {
          console.error(`❌ CRITICAL: '${funcName}' missing authentication guard!`);
          violations++;
        }

      } catch (error) {
        console.error(`❌ Error reading function '${funcName}':`, error);
        violations++;
      }
    }

  } catch (error) {
    console.error('❌ Error checking functions directory:', error);
    violations++;
  }

  if (violations > 0) {
    console.error(`\n🚨 SECURITY VIOLATION: ${violations} function(s) failed authentication requirements`);
    console.error('Sensitive edge functions must use requireAuth() guard.');
    console.error('Fix: Import and call requireAuth(req) in all sensitive functions.');
    process.exit(1);
  }

  console.log('\n✅ All sensitive edge functions have authentication guards');
}

async function main(): Promise<void> {
  try {
    await checkEdgeAuthGuard();
    console.log('\n🎉 Edge function authentication checks passed!');
  } catch (error) {
    console.error('\n💥 Edge function authentication check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { checkEdgeAuthGuard };