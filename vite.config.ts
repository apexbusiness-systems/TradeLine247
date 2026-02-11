import { defineConfig, type ConfigEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { componentTagger } from "lovable-tagger";
import pkg from "./package.json";

export default defineConfig(({ mode }: ConfigEnv) => ({
  // Inject app version for splash v2 persistence
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    mode === 'production' && {
      name: 'csp-headers',
      configureServer(server: any) {
        server.middlewares.use((req: any, res: any, next: any) => {
          // SECURITY: Strict CSP matching production environment
          res.setHeader(
            'Content-Security-Policy',
            [
              "default-src 'self'",
              "script-src 'self' 'sha256-bEYd+LcPU/Dqb4kw607DQuDe9kNSphboAGFc3Ul1uuw=' 'sha256-9Aqd12dpUmJ8nvOhKo6BKuIm5kPY076PTKodUHr1Xp0=' 'sha256-ohy8JqHAxQp7V6CSEzAslHs6cy8SGyUNxPE/Oo7yu4A=' https://static.klaviyo.com https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: https: blob:",
              "media-src 'self' data: blob:",
              "connect-src 'self' https://hysvqdwmhxnblxfqnszn.supabase.co wss://hysvqdwmhxnblxfqnszn.supabase.co https://api.twilio.com https://api.openai.com https://api.resend.com https://www.google-analytics.com https://*.klaviyo.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          );
          next();
        });
      }
    }
  ].filter(Boolean),
  base: "/",
  server: { 
    host: "::",
    port: 8080, 
    strictPort: true,
    cors: true
  },
  preview: { 
    port: 4176, 
    strictPort: true,
    host: true,
    cors: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    sourcemap: false, // Disable sourcemaps in production for better performance
    outDir: "dist",
    rollupOptions: {
      output: {
        // Optimized chunk splitting for better caching and parallel loading
        manualChunks: {
          // Core React (rarely changes, good for long-term caching)
          'react-vendor': ['react', 'react-dom'],

          // React Router (changes moderately)
          'react-router': ['react-router-dom'],

          // Supabase (large, rarely changes)
          'supabase': ['@supabase/supabase-js'],

          // React Query (data fetching)
          'react-query': ['@tanstack/react-query'],

          // UI components by category (better granularity)
          'radix-primitives': [
            '@radix-ui/react-slot',
            '@radix-ui/react-portal',
            '@radix-ui/react-presence',
            '@radix-ui/react-primitive',
          ],
          'radix-overlays': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-navigation-menu',
          ],
          'radix-forms': [
            '@radix-ui/react-select',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-slider',
            '@radix-ui/react-label',
          ],
        },
        // Optimize chunk sizes
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    cssCodeSplit: true,
    // Increase chunk size warning limit (we have good code splitting)
    chunkSizeWarningLimit: 600,
    minify: 'terser',
    terserOptions: {
      compress: {
        // ============================================================================
        // CRITICAL LOGGING POLICY - DO NOT MODIFY WITHOUT REVIEW
        // ============================================================================
        // drop_console: false - Keeps ALL console methods by default
        // pure_funcs: ['console.log', 'console.debug', 'console.trace']
        //   - These specific methods are STRIPPED during minification
        //   - They are treated as "pure functions" with no side effects
        //
        // PRESERVED METHODS (keep in production):
        //   - console.info()  ✅ Use for critical initialization logs
        //   - console.warn()  ✅ Use for warnings
        //   - console.error() ✅ Use for errors
        //
        // REMOVED METHODS (stripped in production):
        //   - console.log()   ❌ Removed - use console.info() for important logs
        //   - console.debug() ❌ Removed - development only
        //   - console.trace() ❌ Removed - development only
        //
        // WHY THIS MATTERS:
        //   - Production builds MUST have diagnostic logs to debug bundle loading
        //   - main.tsx uses console.info() for critical initialization tracking
        //   - If you see "no console logs" in production, check this config
        //
        // REGRESSION PREVENTION:
        //   - Run `npm run build` and check dist/ for console.info preservation
        //   - Use verification script: `npm run verify:app`
        // ============================================================================
        drop_console: false,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.trace']
      },
    },
  },
}));
