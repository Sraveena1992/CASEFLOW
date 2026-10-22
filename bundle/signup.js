
const form=document.getElementById('signup'),btn=document.getElementById('submit'),msg=document.getElementById('message');
function show(text){msg.textContent=text;msg.classList.add('show')}
form.addEventListener('submit',async e=>{e.preventDefault();msg.classList.remove('show');
const email=document.getElementById('email').value.trim(),inviteCode=document.getElementById('invite').value.trim(),password=document.getElementById('password').value,confirm=document.getElementById('confirm').value;
if(password!==confirm){show('Passwords do not match.');return}if(password.length<12){show('Use a password with at least 12 characters.');return}
btn.disabled=true;btn.textContent='Sending verification…';
try{const csrfResponse=await fetch('/api/auth/csrf',{credentials:'same-origin',cache:'no-store'});if(!csrfResponse.ok)throw new Error('Could not start a secure session. Refresh and try again.');const {csrfToken}=await csrfResponse.json();
const response=await fetch('/api/auth/register',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({email,inviteCode,password})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Registration could not be completed.');show(result.message||'Check your email for the verification link.');form.reset();
}catch(err){show(err.message||'Network error. Please try again.')}finally{btn.disabled=false;btn.textContent='Request email verification ↗'}
});
