const {workerKey,workerHeaders}=require('./marketing/src/lib/agent/worker-auth.cjs');
function startAgentWorker(env=process.env,fetcher=fetch){
 if(env.NODE_ENV!=='production'||!env.OPENAI_API_KEY||!workerKey(env))return ()=>{};
 let stopped=false,busy=false;
 const tick=async()=>{if(stopped||busy)return;busy=true;try{const response=await fetcher((env.APP_ORIGIN||env.NEXT_PUBLIC_APP_URL)+'/marketing/api/agent/tick',{method:'POST',headers:workerHeaders(env),signal:AbortSignal.timeout(240000),redirect:'error'});await response.body?.cancel();if(!response.ok)console.error('[agent-worker] tick failed',{status:response.status});}catch(error){console.error('[agent-worker] tick unavailable',{error:error.name});}finally{busy=false;}};
 const first=setTimeout(tick,10000);first.unref();const timer=setInterval(tick,60000);timer.unref();return ()=>{stopped=true;clearTimeout(first);clearInterval(timer);};
}
module.exports={startAgentWorker};
