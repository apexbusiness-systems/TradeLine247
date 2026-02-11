console.info('🔍 Initializing React bundle loading...');

// Track bundle loading status
window.__BUNDLE_LOAD_START__ = Date.now();
window.__BUNDLE_ERRORS__ = [];

// Comprehensive error handler for bundle loading failures
window.addEventListener('error', function(e) {
  console.error('🚨 Global error caught:', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    error: e.error
  });

  window.__BUNDLE_ERRORS__.push({
    message: e.message,
    filename: e.filename,
    timestamp: Date.now()
  });

  // If this is a script loading error, show diagnostic UI
  if (e.filename && (e.filename.includes('.js') || e.filename.includes('main'))) {
    setTimeout(function() {
      // Give React 2 seconds to mount; if not mounted, show error
      if (!window.__REACT_READY__) {
        console.error('🚨 React failed to mount within 2 seconds. Bundle likely failed to load.');
        var root = document.getElementById('root');
        if (root) {
          root.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:system-ui;background:#fff"><div style="max-width:600px;text-align:center"><div style="font-size:3rem;margin-bottom:1rem">⚠️</div><h1 style="color:#dc2626;font-size:1.5rem;margin-bottom:1rem;font-weight:600">Bundle Loading Error</h1><p style="color:#4b5563;margin-bottom:1rem">The application bundle failed to load or execute.</p><pre style="background:#f3f4f6;padding:1rem;border-radius:0.5rem;text-align:left;font-size:0.875rem;overflow:auto;margin-bottom:1rem">' + e.message + '</pre><button onclick="location.reload()" style="background:#ff6b35;color:white;padding:0.75rem 2rem;border:none;border-radius:0.5rem;font-size:1rem;cursor:pointer;font-weight:500">Reload Page</button></div></div>';
        }
      }
    }, 2000);
  }
}, true);

// Detect unhandled promise rejections (common in module loading)
window.addEventListener('unhandledrejection', function(e) {
  console.error('🚨 Unhandled promise rejection:', e.reason);
  window.__BUNDLE_ERRORS__.push({
    message: 'Promise rejection: ' + (e.reason?.message || e.reason),
    timestamp: Date.now()
  });
});

// Timeout check: If React doesn't mount within 10 seconds, show error
setTimeout(function() {
  if (!window.__REACT_READY__) {
    console.error('🚨 CRITICAL: React failed to mount within 10 seconds');
    console.error('Bundle load time:', Date.now() - window.__BUNDLE_LOAD_START__, 'ms');
    console.error('Errors recorded:', window.__BUNDLE_ERRORS__);

    var root = document.getElementById('root');
    if (root && !root.querySelector('[data-reactroot]')) {
      root.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:system-ui;background:#fff"><div style="max-width:600px;text-align:center"><div style="font-size:3rem;margin-bottom:1rem">⚠️</div><h1 style="color:#dc2626;font-size:1.5rem;margin-bottom:1rem;font-weight:600">Application Failed to Start</h1><p style="color:#4b5563;margin-bottom:1rem">The application did not initialize within the expected time.</p><details style="background:#f3f4f6;padding:1rem;border-radius:0.5rem;text-align:left;margin-bottom:1rem"><summary style="cursor:pointer;font-weight:500;margin-bottom:0.5rem">Diagnostic Information</summary><pre style="font-size:0.75rem;overflow:auto;margin:0">Load time: ' + (Date.now() - window.__BUNDLE_LOAD_START__) + 'ms\nErrors: ' + JSON.stringify(window.__BUNDLE_ERRORS__, null, 2) + '</pre></details><button onclick="location.reload()" style="background:#ff6b35;color:white;padding:0.75rem 2rem;border:none;border-radius:0.5rem;font-size:1rem;cursor:pointer;font-weight:500">Reload Page</button></div></div>';
    }
  }
}, 10000);
