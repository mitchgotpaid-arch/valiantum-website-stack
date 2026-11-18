document.querySelector('#account-password').onsubmit=async event=>{
  event.preventDefault();const form=event.target,button=form.querySelector('button'),message=document.querySelector('#password-error');
  const body=Object.fromEntries(new FormData(form));if(body.password!==body.confirmation){message.textContent='The passwords do not match.';return;}
  button.disabled=true;message.textContent='';
  try{const response=await fetch('/api/account/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw Error(value.error||'Password update failed.');form.reset();location.replace('/');}
  catch(error){message.textContent=error.message;}finally{button.disabled=false;}
};