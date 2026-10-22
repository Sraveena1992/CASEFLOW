document.documentElement.classList.add('auth-checking');
(async function requireCaseflowSession(){
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) { window.location.replace('/login.html'); return; }
    const data = await response.json();
    window.__CASEFLOW_USER__ = data.user;
    document.documentElement.classList.remove('auth-checking');
    window.dispatchEvent(new CustomEvent('caseflow:authenticated', { detail: data.user }));
  } catch (_) { window.location.replace('/login.html'); }
})();