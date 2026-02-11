(function() {
  // Force root visibility only - no error screens
  var style = document.createElement('style');
  style.textContent = '#root { min-height: 100vh; opacity: 1 !important; visibility: visible !important; display: flex; flex-direction: column; }';
  document.head.appendChild(style);
})();
