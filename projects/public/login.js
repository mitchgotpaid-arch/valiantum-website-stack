document.querySelector("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button"),
    error = document.querySelector("#error");
  button.disabled = true;
  error.textContent = "";
  try {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    const next = new URLSearchParams(location.search).get('next');
    location.replace(next && /^\/marketing(?:\/|$)/.test(next) && !next.includes('\\') ? next : '/');
  } catch (e) {
    error.textContent = e.message;
  } finally {
    button.disabled = false;
  }
});

fetch('/api/auth/config').then(response=>response.json()).then(config=>{
  document.querySelector('#email-signin').hidden=!config.singleSignIn;
}).catch(()=>{});
const codeMessage=document.querySelector('#code-message');
async function codeRequest(path,body){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const value=await response.json();if(!response.ok)throw Error(value.error||'Sign-in failed.');return value;
}
document.querySelector('#send-code').onclick=async()=>{
  const email=document.querySelector('[name=email]');if(!email.reportValidity())return;
  const button=document.querySelector('#send-code');button.disabled=true;codeMessage.textContent='Sending a sign-in link…';
  try{await codeRequest('/api/login-code',{email:email.value});document.querySelector('#code-entry').hidden=false;codeMessage.textContent='Check your email. Open the sign-in link in this browser, or copy the email’s Sign in link and paste it below. Then choose one password for your workspace.';document.querySelector('#signin-code').focus();}
  catch(error){codeMessage.textContent=error.message;}finally{button.disabled=false;}
};
document.querySelector('#verify-code').onclick=async()=>{
  const button=document.querySelector('#verify-code');button.disabled=true;codeMessage.textContent='Verifying…';
  try{await codeRequest('/api/verify-code',{link:document.querySelector('#signin-code').value.trim()});location.replace('/account/password');}
  catch(error){codeMessage.textContent=error.message;}finally{button.disabled=false;}
};

if(new URLSearchParams(location.search).get('auth')==='link-failed'){document.querySelector('#code-entry').hidden=false;document.querySelector('#error').textContent='That sign-in link could not be completed in this browser. Request a fresh link, then copy the email’s Sign in link and paste it into the box below.';}
