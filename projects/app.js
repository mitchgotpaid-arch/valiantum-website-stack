const express = require("express");
const path = require("node:path");
const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const { createStore } = require("./store");
const derive = promisify(scrypt);
const SESSION_AGE = 12 * 60 * 60 * 1000;
const { validWorkspace, normalizeWorkspace } = require("./public/model");
async function createApp(env = process.env, integrations = {}) {
  const production = env.NODE_ENV === "production";
  const ownerAuth = integrations.ownerAuth || require("./owner-auth.cjs").createOwnerAuth(env);
  const hash = env.PROJECTS_PASSWORD_HASH || "";
  if (!ownerAuth.enabled && (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash) || !env.PROJECTS_EMAIL))
    throw new Error(
      "Set PROJECTS_EMAIL and PROJECTS_PASSWORD_HASH. Run npm run password to generate the hash.",
    );
  if (production && !/^https:\/\/[^/]+$/.test(env.APP_ORIGIN || ""))
    throw new Error("APP_ORIGIN must be the exact HTTPS origin in production.");
  const sessionCookieName = production ? "__Host-valiantum_session" : "valiantum_session";
  const readSessionToken = req => (req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(sessionCookieName + "="))?.slice(sessionCookieName.length + 1);
  const store = integrations.store || await createStore(env),
    app = express(),
    sessions = new Map(),
    attempts = new Map(),
    passwordTickets = new Map();
  const ownerFor = (req,res) => req.ownerAuth || (req.ownerAuth=ownerAuth.forRequest(req,res));
  app.disable("x-powered-by");
  const marketingHandler = integrations.marketingHandler || require('./marketing-runtime.cjs').createMarketingRuntime(env);
  // Marketing receives its raw body and manages its own Supabase session. The
  // private Projects owner session protects the complete mounted application.
  app.use(async (req, res, next) => {
    if (!/^\/marketing(?:\/|$)/.test(req.path)) return next();
    const security = require('./marketing-security.cjs').marketingSecurity(env);
    // Next reads the trusted request CSP to nonce its own bootstrap scripts.
    req.headers['content-security-policy'] = security.policy;
    req.headers['x-nonce'] = security.nonce;
    res.set({
      'Content-Security-Policy': security.policy,
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    if (production) res.set('Strict-Transport-Security', 'max-age=31536000');
    let session = sessions.get(readSessionToken(req));
    if (ownerAuth.enabled) {
      try {req.user=await ownerFor(req,res).user();session=req.user?{expires:Date.now()+SESSION_AGE}:null;}
      catch(error){return next(error);}
    }
    const oauthCallback = req.path === '/marketing/api/meta/callback';
    if ((!session || session.expires <= Date.now()) && !(oauthCallback && !ownerAuth.enabled)) {
      if (req.path.startsWith('/marketing/api/')) return res.status(401).json({error: 'Sign in to Projects first.', loginUrl: '/login?next=%2Fmarketing'});
      return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    }
    // Keep Next multipart server actions intact while rejecting forged or missing origins.
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.get('origin') !== (env.APP_ORIGIN || `http://localhost:${env.PORT || 3001}`)) {
      return res.status(403).json({error: 'Request origin rejected.'});
    }
    Promise.resolve(marketingHandler(req, res)).catch(next);
  });
  // Hostinger terminates TLS at its proxy. Cookies are always Secure in production.
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    if (production) res.set("Strict-Transport-Security", "max-age=31536000");
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  app.use(async (req, res, next) => {
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      const expected = env.APP_ORIGIN || `http://localhost:${env.PORT || 3001}`;
      if (req.get("origin") !== expected || !req.is("application/json"))
        return res.status(403).json({ error: "Request origin rejected." });
    }
    if(ownerAuth.enabled){
      const publicPaths=new Set(['/login','/login.js','/styles.css','/logo.png','/health','/api/login','/api/login-code','/api/verify-code','/api/auth/config','/auth/callback']);
      if(!publicPaths.has(req.path)){
        try {req.user=await ownerFor(req,res).user();if(req.user)req.session={expires:Date.now()+SESSION_AGE};}
        catch(error){return next(error);}
      }
    }else{
      const token = readSessionToken(req);
      const session = sessions.get(token);
      if (session && session.expires > Date.now()) {req.session=session;req.token=token;}
    }
    next();
  });
  const cookie = (token) =>
    `${sessionCookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_AGE / 1000}${production ? "; Secure" : ""}`;
  const auth = (req, res, next) =>
    req.session ? next() : res.status(401).json({ error: "Please sign in." });
  app.post("/api/login", async (req, res, next) => {
    try {
      const now = Date.now();
      // Global account throttle avoids trusting spoofable proxy IP headers.
      let rate = attempts.get("owner");
      if (!rate || rate.reset < now) {
        rate = { count: 0, reset: now + 15 * 60 * 1000 };
        attempts.set("owner", rate);
      }
      if (rate.count >= 10)
        return res
          .status(429)
          .json({ error: "Too many attempts. Try again in 15 minutes." });
      rate.count++;
      const { email, password } = req.body || {};
      if (typeof password !== "string" || password.length > 1024)
        return res.status(401).json({ error: "Incorrect email or password." });
      if(ownerAuth.enabled){
        if(typeof email!=='string'||email.length>320)return res.status(401).json({error:'Incorrect email or password.'});
        const user=await ownerFor(req,res).signIn(email,password);
        if(!user)return res.status(401).json({error:'Incorrect email or password. You can use an email sign-in code to choose one password for your workspace.'});
        attempts.delete('owner');return res.json({email:user.email});
      }
      const [salt, expected] = hash.split(":");
      const actual = await derive(password, salt, 64);
      if (
        email !== env.PROJECTS_EMAIL ||
        !timingSafeEqual(actual, Buffer.from(expected, "hex"))
      )
        return res.status(401).json({ error: "Incorrect email or password." });
      attempts.delete("owner");
      if (req.token) sessions.delete(req.token);
      const token = randomBytes(32).toString("hex");
      sessions.set(token, { expires: now + SESSION_AGE });
      res.set("Set-Cookie", cookie(token)).json({ email: env.PROJECTS_EMAIL });
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/auth/config',(_req,res)=>res.json({singleSignIn:ownerAuth.enabled}));
  app.post('/api/login-code',async(req,res,next)=>{
    if(!ownerAuth.enabled)return res.status(404).json({error:'Email sign-in is not configured.'});
    const email=req.body?.email;
    if(typeof email!=='string'||email.length>320||email.toLowerCase()!==(env.PROJECTS_EMAIL||'').toLowerCase())return res.json({ok:true});
    const now=Date.now(),last=attempts.get('email-code');
    if(last&&last.reset>now)return res.status(429).json({error:'Please wait one minute before requesting another sign-in link.'});
    attempts.set('email-code',{count:1,reset:now+60000});
    try{const sent=await ownerFor(req,res).sendCode(email);return sent?res.json({ok:true}):res.status(429).json({error:'A sign-in link could not be sent right now. Please wait a moment and try again.'});}catch(error){next(error);}
  });
  app.post('/api/verify-code',async(req,res,next)=>{
    if(!ownerAuth.enabled)return res.status(404).json({error:'Email sign-in is not configured.'});
    const {email,code,link}=req.body||{};
    const hasLink=typeof link==='string'&&link.length<=8000;
    if(!hasLink&&(typeof email!=='string'||email.length>320||typeof code!=='string'||!/^\d{6,10}$/.test(code)))return res.status(400).json({error:'Enter your email and the sign-in code.'});
    const now=Date.now();let rate=attempts.get('verify-code');if(!rate||rate.reset<now){rate={count:0,reset:now+15*60000};attempts.set('verify-code',rate);}
    if(rate.count++>=10)return res.status(429).json({error:'Too many attempts. Request a new code later.'});
    try{
      const result=hasLink?await ownerFor(req,res).verifyLink(link):await ownerFor(req,res).verifyCode(email,code);
      if(!result)return res.status(401).json({error:'That sign-in link or code was not accepted or has expired.'});
      attempts.delete('verify-code');attempts.delete('owner');
      const ticket=randomBytes(32).toString('hex');passwordTickets.set(ticket,{ownerId:result.user.id,tokenHash:result.tokenHash,expires:now+10*60000});
      res.append('Set-Cookie',`valiantum_password_setup=${ticket}; HttpOnly; SameSite=Strict; Path=/api/account/password; Max-Age=600${production?'; Secure':''}`);
      res.json({ok:true,redirect:'/account/password'});
    }catch(error){next(error);}
  });
  app.get('/auth/callback',async(req,res)=>{
    res.set('Referrer-Policy','no-referrer');
    if(!ownerAuth.enabled||typeof req.query.code!=='string'||req.query.code.length>4096)return res.redirect('/login?auth=link-failed');
    try{
      const result=await ownerFor(req,res).exchangeCode(req.query.code,typeof req.query.sb_flow_id==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(req.query.sb_flow_id)?req.query.sb_flow_id:undefined);
      if(!result)return res.redirect('/login?auth=link-failed');
      const ticket=randomBytes(32).toString('hex');passwordTickets.set(ticket,{ownerId:result.user.id,tokenHash:result.tokenHash,expires:Date.now()+10*60000});
      res.append('Set-Cookie',`valiantum_password_setup=${ticket}; HttpOnly; SameSite=Strict; Path=/api/account/password; Max-Age=600${production?'; Secure':''}`);
      res.redirect('/account/password');
    }catch{return res.redirect('/login?auth=link-failed');}
  });
  app.get('/account/password',(req,res)=>req.session?res.sendFile(path.join(__dirname,'public','account-password.html')):res.redirect('/login'));
  app.post('/api/account/password',auth,async(req,res,next)=>{
    if(!ownerAuth.enabled)return res.status(404).json({error:'Email sign-in is not configured.'});
    const ticket=(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('valiantum_password_setup='))?.slice('valiantum_password_setup='.length);
    const permission=passwordTickets.get(ticket),password=req.body?.password;
    if(password!==req.body?.confirmation)return res.status(400).json({error:'The passwords do not match.'});
    if(!permission||permission.expires<Date.now()||permission.ownerId!==req.user.id)return res.status(403).json({error:'Verify a fresh email sign-in link before setting your password.'});
    if(typeof password!=='string'||password.length<16||password.length>1024)return res.status(400).json({error:'Use a password of 16 to 1024 characters.'});
    try{
      if(permission.tokenHash!==await ownerFor(req,res).tokenHash())return res.status(403).json({error:'Verify a fresh email sign-in link before setting your password.'});
      if(passwordTickets.get(ticket)!==permission)return res.status(403).json({error:'Verify a fresh email sign-in link.'});
      passwordTickets.delete(ticket);
      if(!await ownerFor(req,res).password(password))return res.status(400).json({error:'The password could not be updated. Request a fresh email sign-in link and choose a stronger password.'});
      passwordTickets.delete(ticket);
      res.append('Set-Cookie',`valiantum_password_setup=; HttpOnly; SameSite=Strict; Path=/api/account/password; Max-Age=0${production?'; Secure':''}`);
      res.json({ok:true});
    }catch(error){next(error);}
  });
  app.get('/api/marketing/config',auth,(_req,res)=>res.json({path:'/marketing',configured:!!env.NEXT_PUBLIC_SUPABASE_URL&&!!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}));
  app.get("/api/session", auth, (req, res) =>
    res.json({ email: req.user?.email || env.PROJECTS_EMAIL }),
  );
  app.post("/api/logout", auth, async (req, res, next) => {
    if(ownerAuth.enabled){try{await ownerFor(req,res).signOut();return res.json({ok:true});}catch(error){return next(error);}}
    sessions.delete(req.token);
    res.set("Set-Cookie", cookie("") + "; Max-Age=0").json({ ok: true });
  });
  app.get("/api/workspace", auth, async (req, res, next) => {
    try {
      res.json(normalizeWorkspace(await store.read()));
    } catch (e) {
      next(e);
    }
  });
  let queue = Promise.resolve();
  app.put("/api/workspace", auth, (req, res, next) => {
    if (req.get("X-Workspace-Version") !== "2")
      return res
        .status(426)
        .json({
          error:
            "Reload the app to use the latest workspace version before saving.",
        });
    if (!Number.isSafeInteger(req.body?.revision) || !validWorkspace(req.body))
      return res.status(400).json({ error: "Invalid workspace." });
    const task = queue.then(async () => {
      const ok = await store.write(
        {
          schemaVersion: 2,
          projects: req.body.projects,
          notes: req.body.notes,
          templates: req.body.templates,
        },
        req.body.revision,
      );
      if (!ok)
        return res.status(409).json({
          error:
            "This workspace changed in another tab. Reload before editing.",
        });
      res.json({ revision: req.body.revision + 1 });
    });
    queue = task.catch(() => {});
    task.catch(next);
  });
  app.get("/api/export", auth, async (req, res, next) => {
    try {
      res
        .attachment("valiantum-projects.json")
        .json(normalizeWorkspace(await store.read()));
    } catch (e) {
      next(e);
    }
  });
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/login", (_req, res) =>
    res.sendFile(path.join(__dirname, "public", "login.html")),
  );
  app.get("/login.js", (_req, res) =>
    res.sendFile(path.join(__dirname, "public", "login.js")),
  );
  app.get("/styles.css", (_req, res) =>
    res.sendFile(path.join(__dirname, "public", "styles.css")),
  );
  app.get("/logo.png", (_req, res) =>
    res.sendFile(path.join(__dirname, "public", "logo.png")),
  );
  app.use((req, res, next) => (req.session ? next() : res.redirect("/login")));
  app.use(
    express.static(path.join(__dirname, "public"), { index: "index.html" }),
  );
  app.use((err, req, res, next) => {
    console.error("Projects request failed:", err.code || err.name);
    res
      .status(err.status === 413 ? 413 : 500)
      .json({ error: "Could not complete request. Please try again." });
  });
  const cleanup = setInterval(() => {
    for (const [k, v] of sessions)
      if (v.expires < Date.now()) sessions.delete(k);
    for (const [k, v] of passwordTickets)
      if (v.expires < Date.now()) passwordTickets.delete(k);
  }, 60000);
  cleanup.unref();
  return {
    app,
    async close() {
      clearInterval(cleanup);
      await store.close();
    },
  };
}
module.exports = { createApp, validWorkspace };
