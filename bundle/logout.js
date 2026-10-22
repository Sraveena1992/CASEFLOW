(function setupSignOut(){
  const button = document.getElementById('auth-logout');
  const userLabel = document.getElementById('auth-user');
  function paintUser(user) {
    if (userLabel && user) userLabel.textContent = user.email + ' · ' + (user.role === 'admin' ? 'Admin' : 'Account Manager');
  }
  paintUser(window.__CASEFLOW_USER__);
  window.addEventListener('caseflow:authenticated', event => paintUser(event.detail));
  if (!button) return;
  button.addEventListener('click', async function(){
    button.disabled = true; button.textContent = 'Signing out…';
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials:'same-origin', cache:'no-store' });
      if (!csrfResponse.ok) throw new Error('Could not start secure sign-out.');
      const csrf = await csrfResponse.json();
      const response = await fetch('/api/auth/logout', { method:'POST', credentials:'same-origin', headers:{ 'X-CSRF-Token':csrf.csrfToken } });
      if (!response.ok) throw new Error('Sign-out failed. Please refresh and try again.');
      window.location.replace('/login.html');
    } catch (error) {
      button.disabled = false; button.textContent = 'Sign out ↗';
      window.alert(error.message || 'Could not sign out.');
    }
  });
})();