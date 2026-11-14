const express = require("express");
const path = require("node:path");
const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const { createStore } = require("./store");
const derive = promisify(scrypt);
const SESSION_AGE = 12 * 60 * 60 * 1000;
const { validWorkspace, normalizeWorkspace } = require("./public/model");
async function createApp(env = process.env) {
  const production = env.NODE_ENV === "production";
  const hash = env.PROJECTS_PASSWORD_HASH || "";
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash) || !env.PROJECTS_EMAIL)
    throw new Error(
      "Set PROJECTS_EMAIL and PROJECTS_PASSWORD_HASH. Run npm run password to generate the hash.",
    );
  if (production && !/^https:\/\/[^/]+$/.test(env.APP_ORIGIN || ""))
    throw new Error("APP_ORIGIN must be the exact HTTPS origin in production.");
  const store = await createStore(env),
    app = express(),
    sessions = new Map(),
    attempts = new Map();
  app.disable("x-powered-by");
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
  app.use((req, res, next) => {
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      const expected = env.APP_ORIGIN || `http://localhost:${env.PORT || 3001}`;
      if (req.get("origin") !== expected || !req.is("application/json"))
        return res.status(403).json({ error: "Request origin rejected." });
    }
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("valiantum_session="))
      ?.slice(18);
    const session = sessions.get(token);
    if (session && session.expires > Date.now()) {
      req.session = session;
      req.token = token;
    }
    next();
  });
  const cookie = (token) =>
    `valiantum_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_AGE / 1000}${production ? "; Secure" : ""}`;
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
  app.get("/api/session", auth, (req, res) =>
    res.json({ email: env.PROJECTS_EMAIL }),
  );
  app.post("/api/logout", auth, (req, res) => {
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
