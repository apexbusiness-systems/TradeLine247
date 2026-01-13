#!/usr/bin/env node
/**
 * Security Validation Script
 * ================================
 * Regression guardrails to prevent security vulnerabilities from being reintroduced.
 *
 * Run: npm run validate:security
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let exitCode = 0;
const errors = [];
const warnings = [];

function error(msg) {
  errors.push(msg);
  console.error(`${RED}✗ ERROR:${RESET} ${msg}`);
  exitCode = 1;
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`${YELLOW}⚠ WARNING:${RESET} ${msg}`);
}

function pass(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function checkFile(relativePath) {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : null;
}

console.log('\n🔒 Security Validation\n' + '='.repeat(50) + '\n');

// ============================================================================
// CRITICAL: No hardcoded secrets in source code
// ============================================================================

console.log('📋 Checking for hardcoded secrets...\n');

const secretPatterns = [
  // JWT tokens (Supabase anon keys are JWTs)
  { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, name: 'JWT Token' },
  // API keys
  { pattern: /sk_live_[a-zA-Z0-9]+/g, name: 'Stripe Live Key' },
  { pattern: /sk_test_[a-zA-Z0-9]+/g, name: 'Stripe Test Key' },
  { pattern: /AC[a-f0-9]{32}/gi, name: 'Twilio Account SID' },
  // AWS keys
  { pattern: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key' },
];

const filesToCheck = [
  'src/integrations/supabase/client.ts',
  'src/config/supabase.ts',
  'src/services/elevenEnv.ts',
  'src/channels/rcs/rcs.ts',
];

for (const file of filesToCheck) {
  const content = checkFile(file);
  if (!content) continue;

  for (const { pattern, name } of secretPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      // Allow in .env.example with placeholder patterns
      if (file.includes('.env.example')) continue;

      // Check if it's inside a string that looks like a fallback
      if (content.includes('||') && content.match(pattern)) {
        error(`Hardcoded ${name} found in ${file} - CRITICAL SECURITY ISSUE`);
      }
    }
  }
}

// Check Supabase client specifically
const supabaseClient = checkFile('src/integrations/supabase/client.ts');
if (supabaseClient) {
  if (supabaseClient.includes("||") && supabaseClient.match(/eyJ[a-zA-Z0-9_-]+\./)) {
    error('Hardcoded JWT fallback in supabase/client.ts - remove fallback values');
  } else {
    pass('No hardcoded JWT fallbacks in Supabase client');
  }
}

// ============================================================================
// Check .env.example doesn't contain real values
// ============================================================================

console.log('\n📋 Checking .env.example...\n');

const envExample = checkFile('.env.example');
if (envExample) {
  if (envExample.match(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)) {
    error('.env.example contains real JWT token - use placeholder values');
  } else {
    pass('.env.example has no exposed JWT tokens');
  }

  if (envExample.includes('hysvqdwmhxnblxfqnszn')) {
    error('.env.example contains real Supabase project ID');
  } else {
    pass('.env.example has no exposed project IDs');
  }
}

// ============================================================================
// Check CSP doesn't include unsafe-eval
// ============================================================================

console.log('\n📋 Checking Content Security Policy...\n');

const cspFiles = [
  'vercel.json',
  'src/components/security/SecurityMonitor.tsx',
  'vite.config.ts',
];

for (const file of cspFiles) {
  const content = checkFile(file);
  if (!content) continue;

  // Look for actual CSP directive with unsafe-eval (not comments)
  // Pattern: script-src followed by unsafe-eval in the same directive
  const cspPattern = /script-src[^;]*'unsafe-eval'/;
  const hasUnsafeEval = cspPattern.test(content);

  if (hasUnsafeEval) {
    error(`CSP contains 'unsafe-eval' in ${file} - security risk`);
  } else if (content.includes('Content-Security-Policy') || content.includes('script-src')) {
    pass(`No unsafe-eval in ${file}`);
  }
}

// ============================================================================
// Check Twilio webhook validation
// ============================================================================

console.log('\n📋 Checking Twilio webhook validation...\n');

const voiceFunctions = [
  'supabase/functions/voice-incoming/index.ts',
  'supabase/functions/voice-frontdoor/index.ts',
  'supabase/functions/voice-status/index.ts',
];

for (const file of voiceFunctions) {
  const content = checkFile(file);
  if (!content) continue;

  const hasValidation =
    content.includes('validateTwilioSignature') ||
    content.includes('validateTwilioRequest') ||
    content.includes('x-twilio-signature') ||
    content.includes('X-Twilio-Signature') ||
    // Inline validation patterns
    (content.includes('twilioSignature') && content.includes('crypto.subtle'));

  if (!hasValidation) {
    error(`Missing Twilio signature validation in ${file}`);
  } else {
    pass(`Twilio validation present in ${file}`);
  }
}

// ============================================================================
// Check rate limiting in voice functions
// ============================================================================

console.log('\n📋 Checking rate limiting...\n');

const rateLimitFunctions = [
  'supabase/functions/voice-incoming/index.ts',
  'supabase/functions/voice-frontdoor/index.ts',
];

for (const file of rateLimitFunctions) {
  const content = checkFile(file);
  if (!content) continue;

  if (content.includes('checkRateLimit') || content.includes('rateLimitMap')) {
    pass(`Rate limiting present in ${file}`);
  } else {
    warn(`No rate limiting detected in ${file}`);
  }
}

// ============================================================================
// Check ProGuard enabled for Android
// ============================================================================

console.log('\n📋 Checking Android ProGuard...\n');

const buildGradle = checkFile('android/app/build.gradle');
if (buildGradle) {
  if (buildGradle.includes('minifyEnabled true')) {
    pass('ProGuard (minification) enabled for Android release builds');
  } else if (buildGradle.includes('minifyEnabled false')) {
    warn('ProGuard disabled in Android release builds - APK not obfuscated');
  }

  if (buildGradle.includes('shrinkResources true')) {
    pass('Resource shrinking enabled for Android');
  }
}

// ============================================================================
// Check CORS configuration
// ============================================================================

console.log('\n📋 Checking CORS configuration...\n');

const corsFile = checkFile('supabase/functions/_shared/cors.ts');
if (corsFile) {
  if (corsFile.includes('isOriginAllowed') || corsFile.includes('ALLOWED_ORIGINS')) {
    pass('CORS origin validation implemented');
  } else if (corsFile.includes("'*'") && !corsFile.includes('deprecated')) {
    warn('CORS may allow all origins - verify configuration');
  }
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log('📊 Security Validation Summary\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log(`${GREEN}✓ All security checks passed!${RESET}\n`);
} else {
  if (errors.length > 0) {
    console.log(`${RED}✗ ${errors.length} critical error(s) found${RESET}`);
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }
  if (warnings.length > 0) {
    console.log(`${YELLOW}⚠ ${warnings.length} warning(s)${RESET}`);
    warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }
  console.log();
}

process.exit(exitCode);
