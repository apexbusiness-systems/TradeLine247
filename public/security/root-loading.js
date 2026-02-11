// CRITICAL: Hide loading fallback immediately when React mounts (prevents duplicate content)
(function() {
  var loadingEl = document.getElementById('root-loading');
  if (loadingEl) {
    // Watch for React to mount and hide loading immediately
    var observer = new MutationObserver(function(mutations) {
      var root = document.getElementById('root');
      // React typically renders into root, replacing children or adding React root
      // Check if React has mounted by looking for React-created elements (not our loading div)
      if (root) {
        var reactRoot = root.querySelector('[data-reactroot]') ||
                        (root.firstElementChild && root.firstElementChild.id !== 'root-loading');
        if (reactRoot || (root.children.length > 0 && !loadingEl.parentElement)) {
          // React has mounted, hide loading
          if (loadingEl) loadingEl.style.display = 'none';
          observer.disconnect();
        }
      }
    });
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });

    // Fallback: Hide after 5 seconds to ensure FCP is recorded
    setTimeout(function() {
      if (loadingEl) loadingEl.style.display = 'none';
      observer.disconnect();
    }, 5000);
  }
})();
