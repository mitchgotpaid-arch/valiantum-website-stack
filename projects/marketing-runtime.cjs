const path=require('node:path');
const fs=require('node:fs');
function createMarketingRuntime(env=process.env){
  let pending;
  return async function handleMarketing(req,res){
    if(!pending){
      const directory=path.join(__dirname,'marketing');
      if(env.NODE_ENV==='production'&&!fs.existsSync(path.join(directory,'.next','BUILD_ID'))){res.status(503).send('Marketing OS has not been built. Run npm run build before starting the app.');return;}
      pending=(async()=>{const next=require('next');const application=next({dev:env.NODE_ENV!=='production',dir:directory,hostname:'localhost',port:Number(env.PORT||3001),webpack:true});await application.prepare();return application.getRequestHandler();})();
    }
    try{const handler=await pending;await handler(req,res);}catch(error){console.error('[marketing] startup/request failed:',error.code||error.name);if(!res.headersSent)res.status(503).send('Marketing OS could not start. Projects remains available.');}
  };
}
module.exports={createMarketingRuntime};
