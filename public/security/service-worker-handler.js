(function() {
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Check for safe mode
  var params = new URLSearchParams(window.location.search);
  var safe = params.get('safe') === '1' || window.__SAFE_MODE__ === true;

  if (safe) {
    console.log('🛡️ Safe Mode: service worker registration skipped');
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      registrations.forEach(function(registration) {
        registration.unregister();
        console.log('🛡️ Safe Mode: Unregistered service worker');
      });
    });
    return;
  }

  // Only register in production (detect by checking if hostname is not localhost/127.0.0.1)
  var isProduction = window.location.hostname !== 'localhost' &&
                    window.location.hostname !== '127.0.0.1' &&
                    !window.location.hostname.startsWith('192.168.') &&
                    !window.location.hostname.endsWith('.local');

  if (isProduction) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js')
        .then(function(registration) {
          console.log('✅ TradeLine 24/7 SW registered:', registration.scope);
        })
        .catch(function(err) {
          console.warn('⚠️  TradeLine 24/7 SW registration failed:', err);
        });
    });
  } else {
    console.log('🔧 Dev Mode: service worker registration skipped');
    // Unregister any existing service workers in dev
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      registrations.forEach(function(registration) {
        registration.unregister();
        console.log('🔧 Dev Mode: Unregistered service worker');
      });
    });
  }
})();
