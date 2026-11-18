const {randomBytes}=require('node:crypto');
function marketingSecurity(env=process.env){
 const nonce=randomBytes(24).toString('base64');
 let imageOrigin='';
 try{const url=new URL(env.NEXT_PUBLIC_SUPABASE_URL);if(url.protocol==='https:')imageOrigin=' '+url.origin;}catch{}
 const policy=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${env.NODE_ENV==='production'?'':" 'unsafe-eval'"}`,"style-src 'self' 'unsafe-inline'",`img-src 'self' data: blob:${imageOrigin}`,"font-src 'self'","connect-src 'self'","object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'",...(env.NODE_ENV==='production'?['upgrade-insecure-requests']:[])].join('; ');
 return {nonce,policy};
}
module.exports={marketingSecurity};
