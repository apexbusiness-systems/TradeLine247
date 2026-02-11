// CRITICAL: Hide loading fallback immediately when React mounts (prevents duplicate content)
(function() {
  const loadingEl = document.getElementById('root-loading');
  if (loadingEl) {
    // Watch for React to mount and hide loading immediately
    const observer = new MutationObserver(function(mutations) {
      const root = document.getElementById('root');
      // React typically renders into root, replacing children or adding React root
      // Check if React has mounted by looking for React-created elements (not our loading div)
      if (root) {
        const reactRoot = root.querySelector('[data-reactroot]') ||
                        (root.firstElementChild && root.firstElementChild.id !== 'root-loading');
        // SonarQube fix: Simplified truthiness check. If reactRoot is found, or if root has children not equal to loadingEl.
        // The original logic was: reactRoot || (root.children.length > 0 && !loadingEl.parentElement)
        // Wait, if loadingEl is not in DOM, then it's hidden/removed.
        // If reactRoot exists, we are good.
        if (reactRoot) {
           // React has mounted, hide loading
           loadingEl.style.display = 'none';
           observer.disconnect();
        } else if (root.children.length > 0) {
            // Check if any child is NOT the loading element
            let hasContent = false;
            for (let i = 0; i < root.children.length; i++) {
                if (root.children[i].id !== 'root-loading') {
                    hasContent = true;
                    break;
                }
            }
            if (hasContent) {
                loadingEl.style.display = 'none';
                observer.disconnect();
            }
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
