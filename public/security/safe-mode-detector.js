(function detectSafeMode() {
  try {
    // Check URL parameters for safe mode
    const params = new URLSearchParams(globalThis.location.search);
    const isSafeMode = params.get('safe') === '1' || params.get('safe-mode') === '1';

    // Check localStorage fallback
    const localStorageSafeMode = localStorage.getItem('safe-mode') === 'true';

    if (isSafeMode || localStorageSafeMode) {
      // Set attribute IMMEDIATELY (before React)
      document.body.dataset.safeMode = 'true';
      console.info('[SAFE MODE] Enabled via ?safe=1');
    }
  } catch (e) {
    console.error('[Safe Mode] Detection failed:', e);
  }
})();
