#!/usr/bin/env node
/**
 * Production Readiness Rubric - 10/10 Required
 *
 * Evaluates the codebase against strict production standards.
 * All checks must pass for a 10/10 score.
 */

import { spawnSync } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const ENCODING = 'utf-8';
const CMD_NODE = 'node';
const CMD_NPM = 'npm';
const STDIO_PIPE = 'pipe';

const checks = {
  build: { name: 'Production Build', passed: false, error: null },
  typecheck: { name: 'TypeScript Type Check', passed: false, error: null },
  lint: { name: 'ESLint (0 warnings)', passed: false, error: null },
  tests: { name: 'Unit Tests', passed: false, error: null },
  requiredFiles: { name: 'Required Files Present', passed: false, error: null },
  vercelPrebuild: { name: 'Vercel Prebuild Script', passed: false, error: null },
  noConsoleErrors: { name: 'No Console Errors in Critical Files', passed: false, error: null },
  accessibility: { name: 'Accessibility (h1 present, contrast)', passed: false, error: null },
  workflowSyntax: { name: 'GitHub Actions Workflow Syntax', passed: false, error: null },
  security: { name: 'Security Headers & Config', passed: false, error: null },
};

async function checkRequiredFiles() {
  const requiredFiles = [
    'src/integrations/supabase/client.ts',
    'src/App.tsx',
    'src/main.tsx',
    'package.json',
    'vite.config.ts',
    'scripts/check-required-files.mjs',
    'vercel.json',
  ];

  const missing = [];
  for (const file of requiredFiles) {
    try {
      await access(join(repoRoot, file), constants.F_OK);
    } catch {
      missing.push(file);
    }
  }

  if (missing.length > 0) {
    checks.requiredFiles.error = `Missing: ${missing.join(', ')}`;
    return false;
  }
  return true;
}

async function checkVercelPrebuild() {
  try {
    const processResult = spawnSync(CMD_NODE, ['scripts/check-required-files.mjs'], {
      cwd: repoRoot,
      encoding: ENCODING,
      stdio: STDIO_PIPE,
    });

    if (processResult.error) throw processResult.error;
    if (processResult.status !== 0) throw new Error(`Script failed with status ${processResult.status}`);

    const result = processResult.stdout;
    if (result && result.includes('✅ All required files found')) {
      return true;
    }
    checks.vercelPrebuild.error = 'Prebuild script did not pass';
    return false;
  } catch (error) {
    checks.vercelPrebuild.error = error.message;
    return false;
  }
}

function checkAccessibility() {
  try {
    const authContent = readFileSync(join(repoRoot, 'src/pages/Auth.tsx'), ENCODING);
    const hasH1 = authContent.includes('<h1') || authContent.includes('h1 className');

    const cssContent = readFileSync(join(repoRoot, 'src/index.css'), ENCODING);
    const hasDarkModeContrast = cssContent.includes('html.dark .text-primary') &&
                                cssContent.includes('#FF6B35');

    if (!hasH1) {
      checks.accessibility.error = 'Auth page missing h1 heading';
      return false;
    }

    if (!hasDarkModeContrast) {
      checks.accessibility.error = 'Missing dark mode color contrast fix';
      return false;
    }

    return true;
  } catch (error) {
    checks.accessibility.error = error.message;
    return false;
  }
}

function checkWorkflowSyntax() {
  try {
    const workflows = [
      '.github/workflows/db-migrate.yml',
      '.github/workflows/db-repair.yml',
    ];

    for (const workflow of workflows) {
      const content = readFileSync(join(repoRoot, workflow), ENCODING);
      // Check for common YAML issues
      if (content.includes('env: {') && !content.includes('env:\n')) {
        checks.workflowSyntax.error = `${workflow} uses inline object syntax (should be multi-line)`;
        return false;
      }
    }

    return true;
  } catch (error) {
    checks.workflowSyntax.error = error.message;
    return false;
  }
}

function checkSecurity() {
  try {
    const vercelJson = JSON.parse(readFileSync(join(repoRoot, 'vercel.json'), ENCODING));
    const hasSecurityHeaders = vercelJson.headers &&
                               vercelJson.headers.some(h =>
                                 h.headers?.some(header =>
                                   header.key === 'X-Content-Type-Options'
                                 )
                               );

    if (!hasSecurityHeaders) {
      checks.security.error = 'Missing security headers in vercel.json';
      return false;
    }

    return true;
  } catch (error) {
    checks.security.error = error.message;
    return false;
  }
}

async function runCheck(name, fn) {
  try {
    const result = await fn();
    checks[name].passed = result;
    return result;
  } catch (error) {
    checks[name].error = error.message;
    checks[name].passed = false;
    return false;
  }
}

async function runCommandCheck(name, command, args, successIndicator) {
  try {
    const processResult = spawnSync(command, args, {
      cwd: repoRoot,
      encoding: ENCODING,
      stdio: STDIO_PIPE,
    });

    if (processResult.error) throw processResult.error;

    // Check exit code first
    if (processResult.status !== 0) {
       // If stderr is available, use it for error message
       const errorMessage = processResult.stderr ? processResult.stderr.trim() : `Command failed with status ${processResult.status}`;
       throw new Error(errorMessage || 'Command failed');
    }

    const result = processResult.stdout;

    // Handle case where result is null/undefined (failed spawn)
    if (!result && result !== '') throw new Error('Command failed to produce output');

    const passed = successIndicator ? result.includes(successIndicator) : true;
    checks[name].passed = passed;
    if (!passed) {
      checks[name].error = 'Command did not produce expected output';
    }
    return passed;
  } catch (error) {
    checks[name].error = error.message.split('\n')[0];
    checks[name].passed = false;
    return false;
  }
}

async function main() {
  console.log('🔍 Running Production Readiness Rubric (10/10 Required)...\n');

  // 1. Required Files
  await runCheck('requiredFiles', checkRequiredFiles);

  // 2. Vercel Prebuild
  await runCheck('vercelPrebuild', checkVercelPrebuild);

  // 3. Build
  await runCommandCheck('build', CMD_NPM, ['run', 'build'], 'built in');

  // 4. Type Check
  await runCommandCheck('typecheck', CMD_NPM, ['run', 'typecheck'], '');

  // 5. Lint
  await runCommandCheck('lint', CMD_NPM, ['run', 'lint'], '[check-edge-imports]');

  // 6. Tests (non-blocking for now, but should pass)
  try {
    await runCommandCheck('tests', CMD_NPM, ['run', 'test:ci'], '');
  } catch {
    checks.tests.error = 'Tests failed - review required';
  }

  // 7. Console Errors
  await runCommandCheck('noConsoleErrors', CMD_NPM, ['run', 'verify:console'], '✅');

  // 8. Accessibility
  await runCheck('accessibility', checkAccessibility);

  // 9. Workflow Syntax
  await runCheck('workflowSyntax', checkWorkflowSyntax);

  // 10. Security
  await runCheck('security', checkSecurity);

  // Report
  console.log('\n📊 Rubric Results:\n');
  let passedCount = 0;
  let totalCount = 0;

  for (const [key, check] of Object.entries(checks)) {
    totalCount++;
    const status = check.passed ? '✅' : '❌';
    console.log(`${status} ${check.name}`);
    if (!check.passed && check.error) {
      console.log(`   Error: ${check.error}`);
    }
    if (check.passed) passedCount++;
  }

  const score = Math.round((passedCount / totalCount) * 10);
  console.log(`\n🎯 Score: ${score}/10 (${passedCount}/${totalCount} checks passed)\n`);

  if (score === 10) {
    console.log('✅ PRODUCTION READY - All checks passed!');
    process.exit(0);
  } else {
    console.log('❌ NOT PRODUCTION READY - Fix issues above before committing');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
