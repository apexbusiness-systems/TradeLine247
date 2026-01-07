#!/usr/bin/env tsx

/**
 * CI Tripwire: Ensure service worker doesn't cache sensitive routes
 * Fails CI if SW caching rules include forbidden routes
 */

import { readFileSync } from 'fs';

const SW_FILE = 'public/sw.js';

const FORBIDDEN_CACHE_ROUTES = [
  '/rest/v1/',
  '/auth/v1/',
  '/functions/v1/',
  '/api/',
  '/admin/',
  '/dashboard/',
  '/settings/',
  '/profile/',
  '/account/',
  '/billing/',
  '/workspace/',
  '/team/',
  '/organization/',
  '/user/',
  '/session/',
  '/private/',
  '/secure/'
];

async function checkSWNoSensitiveCache(): Promise<void> {
  console.log('🔒 Checking service worker sensitive route caching...');

  let violations = 0;

  try {
    const content = readFileSync(SW_FILE, 'utf-8');

    // Check if sensitive routes bypass is implemented
    const hasSensitiveRoutesCheck = content.includes('sensitiveRoutes') ||
      (content.includes('isSensitiveRoute') && content.includes('return;'));

    if (!hasSensitiveRoutesCheck) {
      console.error('❌ CRITICAL: Service worker missing sensitive routes bypass!');
      violations++;
    } else {
      console.log('✅ Service worker has sensitive routes bypass');
    }

    // Check each forbidden route
    for (const route of FORBIDDEN_CACHE_ROUTES) {
      // Look for caching logic that might include sensitive routes
      const cacheIncludesRoute = content.includes(route) &&
        (content.includes('cache') || content.includes('Cache'));

      if (cacheIncludesRoute) {
        // Check if it's in a bypass section
        const lines = content.split('\n');
        let inBypassSection = false;

        for (const line of lines) {
          if (line.includes('bypass') || line.includes('sensitive') || line.includes('return;')) {
            inBypassSection = true;
          }
          if (line.includes(route) && inBypassSection) {
            // This is okay - route is in bypass section
            break;
          }
          if (line.includes(route) && !inBypassSection) {
            console.error(`❌ CRITICAL: Service worker may cache sensitive route: ${route}`);
            violations++;
            break;
          }
        }
      }
    }

    // Verify network-only strategy for sensitive routes
    const hasNetworkOnlyStrategy = content.includes('Network-only') ||
      content.includes('network-only') ||
      (content.includes('isSensitiveRoute') && content.includes('return'));

    if (!hasNetworkOnlyStrategy) {
      console.error('❌ CRITICAL: Service worker missing network-only strategy for sensitive routes!');
      violations++;
    } else {
      console.log('✅ Service worker uses network-only for sensitive routes');
    }

  } catch (error) {
    console.error('❌ Error reading service worker file:', error);
    violations++;
  }

  if (violations > 0) {
    console.error(`\n🚨 SECURITY VIOLATION: ${violations} service worker caching issues found`);
    console.error('Service worker must never cache sensitive routes.');
    console.error('Fix: Implement bypass for /rest/v1/, /auth/v1/, /functions/v1/, and user data routes.');
    process.exit(1);
  }

  console.log('\n✅ Service worker properly bypasses sensitive routes');
}

async function main(): Promise<void> {
  try {
    await checkSWNoSensitiveCache();
    console.log('\n🎉 Service worker caching checks passed!');
  } catch (error) {
    console.error('\n💥 Service worker caching check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { checkSWNoSensitiveCache };