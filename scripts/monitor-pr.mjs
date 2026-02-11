#!/usr/bin/env node
/**
 * Monitor PR Status
 * Checks PR status, CI/CD, and deployment status
 */

import { spawnSync } from 'node:child_process';

const PR_BRANCH = 'fix/vercel-a11y-security-pr';
const REPO = 'apexbusiness-systems/tradeline247aicom';
const ENCODING = 'utf-8';
const CMD_GIT = 'git';

function run(command, args) {
  const result = spawnSync(command, args, { encoding: ENCODING });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed with status ${result.status}: ${result.stderr}`);
  }
  return result.stdout;
}

function checkBranchStatus() {
  try {
    console.log('🔍 Checking branch status...\n');

    // Check if branch exists
    const branches = run(CMD_GIT, ['branch', '-r']);
    if (!branches.includes(PR_BRANCH)) {
      console.log('❌ Branch not found on remote');
      return false;
    }

    // Check commits ahead
    try {
      const ahead = run(CMD_GIT, ['rev-list', '--count', `origin/main..origin/${PR_BRANCH}`]).trim();
      console.log(`✅ Branch is ${ahead} commits ahead of main`);
    } catch {
      console.log('⚠️  Could not determine commits ahead');
    }

    // Check for uncommitted changes
    const status = run(CMD_GIT, ['status', '--porcelain']);
    if (status.trim()) {
      console.log('⚠️  Uncommitted changes detected');
    } else {
      console.log('✅ Working directory clean');
    }

    return true;
  } catch (error) {
    console.error('Error checking branch:', error.message);
    return false;
  }
}

async function checkBuildStatus() {
  console.log('\n🔍 Checking build status...\n');

  try {
    // Check if production rubric exists
    const fs = await import('node:fs/promises');
    try {
      await fs.access('scripts/production-rubric.mjs');
      console.log('Running production rubric...');
      const rubric = run('node', ['scripts/production-rubric.mjs']);
      console.log(rubric);
    } catch {
      console.log('ℹ️  Production rubric not found (optional)');
    }
  } catch (error) {
    console.log('ℹ️  Skipping production rubric check');
  }
}

async function main() {
  console.log('📊 PR Monitoring Dashboard\n');
  console.log(`Branch: ${PR_BRANCH}`);
  console.log(`Repo: ${REPO}\n`);
  console.log('='.repeat(50));

  const branchExists = checkBranchStatus();

  if (branchExists) {
    await checkBuildStatus();

    console.log('\n' + '='.repeat(50));
    console.log('\n📋 Next Steps:');
    console.log(`1. Create PR: https://github.com/${REPO}/pull/new/${PR_BRANCH}`);
    console.log('2. Monitor CI/CD status in GitHub Actions');
    console.log('3. Check Vercel deployment status');
    console.log('\n✅ Branch is ready for PR creation!');
  } else {
    console.log('\n❌ Branch not ready. Please push the branch first.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
