document.getElementById('year').textContent = new Date().getFullYear();

// Simple theme toggle if needed
(function(){
  const body = document.body;
  const key = 'thorkc-theme';
  const saved = localStorage.getItem(key);
  if(saved) body.className = saved;
  // Expose toggle for console or future button
  window.toggleTheme = function(){
    const next = body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark';
    body.className = next;
    localStorage.setItem(key, next);
  };
})();
