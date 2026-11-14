const { test } = require("node:test");
const assert = require("node:assert/strict");
const { scryptSync } = require("node:crypto");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../server");
test("private workspace authentication, validation, persistence, conflicts and logout", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "valiantum-test-"));
  const salt = "a".repeat(32),
    password = "a-test-password-with-entropy";
  const env = {
    PROJECTS_EMAIL: "owner@example.com",
    PROJECTS_PASSWORD_HASH:
      salt + ":" + scryptSync(password, salt, 64).toString("hex"),
    APP_ORIGIN: "http://localhost",
    PROJECTS_DATA_FILE: path.join(folder, "data.json"),
  };
  const service = await createApp(env);
  const server = service.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  let cookie = "";
  const req = (url, method = "GET", data, origin = "http://localhost") =>
    fetch(base + url, {
      method,
      redirect: "manual",
      headers: { "Content-Type": "application/json", origin, cookie },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  try {
    assert.equal((await req("/")).status, 302);
    assert.equal((await req("/app.js")).status, 302);
    assert.equal((await req("/api/workspace")).status, 401);
    assert.equal((await req("/api/export")).status, 401);
    assert.equal((await req("/login")).status, 200);
    assert.equal(
      (
        await req(
          "/api/login",
          "POST",
          { email: env.PROJECTS_EMAIL, password },
          "https://evil.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await req("/api/login", "POST", {
          email: env.PROJECTS_EMAIL,
          password: "wrong",
        })
      ).status,
      401,
    );
    const login = await req("/api/login", "POST", {
      email: env.PROJECTS_EMAIL,
      password,
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal((await req("/")).status, 200);
    const data = await (await req("/api/workspace")).json();
    assert.deepEqual(data, { projects: [], revision: 0 });
    const next = {
      revision: 0,
      projects: [
        {
          id: "p",
          name: "PantryWise",
          description: "Private notes",
          links: "https://example.com",
          lists: [
            {
              id: "l",
              name: "To do",
              cards: [
                {
                  id: "c",
                  title: "Ship next release",
                  description: "Details",
                  assignee: "Me",
                  due: "2026-12-01",
                  priority: "High",
                  checklist: [{ id: "i", text: "Test", done: false }],
                },
              ],
            },
          ],
        },
      ],
    };
    assert.equal((await req("/api/workspace", "PUT", next)).status, 200);
    assert.equal((await req("/api/workspace", "PUT", next)).status, 409);
    assert.equal(
      (
        await req("/api/workspace", "PUT", {
          projects: [{ name: "invalid" }],
          revision: 1,
        })
      ).status,
      400,
    );
    const saved = await (await req("/api/export")).json();
    assert.equal(
      saved.projects[0].lists[0].cards[0].title,
      "Ship next release",
    );
    assert.equal(saved.revision, 1);
    await service.close();
    const restarted = await createApp(env);
    assert.ok(restarted);
    await restarted.close();
    assert.equal((await req("/api/logout", "POST", {})).status, 200);
    assert.equal((await req("/api/workspace")).status, 401);
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await req("/api/login", "POST", {
            email: env.PROJECTS_EMAIL,
            password: "wrong",
          })
        ).status,
        401,
      );
    assert.equal(
      (await req("/api/login", "POST", { email: env.PROJECTS_EMAIL, password }))
        .status,
      429,
    );
  } finally {
    await new Promise((r) => server.close(r));
    await service.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("production fails closed without configured credentials and durable storage", async () => {
  await assert.rejects(createApp({ NODE_ENV: "production" }), /PROJECTS_EMAIL/);
  const salt = "b".repeat(32);
  const env = {
    NODE_ENV: "production",
    PROJECTS_EMAIL: "owner@example.com",
    PROJECTS_PASSWORD_HASH:
      salt + ":" + scryptSync("password", salt, 64).toString("hex"),
  };
  await assert.rejects(createApp(env), /APP_ORIGIN/);
  await assert.rejects(
    createApp({ ...env, APP_ORIGIN: "https://projects.valiantum.com" }),
    /MySQL/,
  );
});
