const {createHash}=require('node:crypto');
const {createServerClient,parseCookieHeader,serializeCookieHeader}=require('@supabase/ssr');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function createOwnerAuth(env=process.env,clientFactory=createServerClient){
  const enabled=!!env.PROJECTS_SUPABASE_OWNER_ID;
  if(!enabled)return {enabled:false};
  if(!env.PROJECTS_EMAIL||!uuid.test(env.PROJECTS_SUPABASE_OWNER_ID)||!env.NEXT_PUBLIC_SUPABASE_URL||!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)throw Error('Configure the existing Supabase owner UUID, URL and publishable key.');
  const url=new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if(env.NODE_ENV==='production'&&url.protocol!=='https:')throw Error('Supabase must use HTTPS in production.');
  return {enabled:true,forRequest(req,res){
    const client=clientFactory(url.href,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{
      getAll:()=>parseCookieHeader(req.headers.cookie||''),
      setAll(updates){
        const cookies=new Map(parseCookieHeader(req.headers.cookie||'').map(item=>[item.name,item.value]));
        for(const {name,value,options} of updates){
          cookies.set(name,value);
          res.append('Set-Cookie',serializeCookieHeader(name,value,{...options,httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',path:'/'}));
        }
        req.headers.cookie=[...cookies].map(([name,value])=>name+'='+encodeURIComponent(value||'')).join('; ');
      },
    }});
    const isOwner=user=>!!user&&user.id===env.PROJECTS_SUPABASE_OWNER_ID;
    let pending;
    return {
      async user(){
        if(!pending)pending=client.auth.getUser().then(({data,error})=>!error&&isOwner(data.user)?data.user:null);
        return pending;
      },
      async signIn(email,password){
        if(email.toLowerCase()!==env.PROJECTS_EMAIL.toLowerCase())return null;
        const {data,error}=await client.auth.signInWithPassword({email:env.PROJECTS_SUPABASE_OWNER_EMAIL||env.PROJECTS_EMAIL,password});
        if(error||!isOwner(data.user)){if(data.user)await client.auth.signOut({scope:'local'});return null;}
        return data.user;
      },
      async sendCode(email){
        // Existing account only. Public signup remains disabled.
        const {error}=await client.auth.signInWithOtp({email:env.PROJECTS_SUPABASE_OWNER_EMAIL||env.PROJECTS_EMAIL,options:{shouldCreateUser:false,emailRedirectTo:new URL('/auth/callback',env.APP_ORIGIN).href}});
        return !error;
      },
      async verifyCode(email,token){
        const {data,error}=await client.auth.verifyOtp({email:env.PROJECTS_SUPABASE_OWNER_EMAIL||email,token,type:'email'});
        if(error||!isOwner(data.user)||!data.session){if(data.user)await client.auth.signOut({scope:'local'});return null;}
        return {user:data.user,tokenHash:createHash('sha256').update(data.session.access_token).digest('hex')};
      },
      async verifyLink(link){
        let parsed;try{parsed=new URL(link);}catch{return null;}
        const token=parsed.searchParams.get('token')||parsed.searchParams.get('token_hash');
        if(parsed.origin!==url.origin||parsed.pathname!=='/auth/v1/verify'||parsed.username||parsed.password||!['magiclink','email'].includes(parsed.searchParams.get('type'))||!token||token.length>512)return null;
        const {data,error}=await client.auth.verifyOtp({token_hash:token,type:'email'});
        if(error||!isOwner(data.user)||!data.session){if(data.user)await client.auth.signOut({scope:'local'});return null;}
        return {user:data.user,tokenHash:createHash('sha256').update(data.session.access_token).digest('hex')};
      },
      async exchangeCode(code){
        const {data,error}=await client.auth.exchangeCodeForSession(code);
        if(error||!isOwner(data.user)||!data.session){if(data.user)await client.auth.signOut({scope:'local'});return null;}
        return {user:data.user,tokenHash:createHash('sha256').update(data.session.access_token).digest('hex')};
      },
      async tokenHash(){const {data}=await client.auth.getSession();return data.session?createHash('sha256').update(data.session.access_token).digest('hex'):null;},
      async password(value){const {error}=await client.auth.updateUser({password:value});return !error;},
      async signOut(){await client.auth.signOut({scope:'local'});},
    };
  }};
}
module.exports={createOwnerAuth};
