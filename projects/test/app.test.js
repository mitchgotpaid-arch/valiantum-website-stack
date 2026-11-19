const { test } = require("node:test");
const assert = require("node:assert/strict");
const { scryptSync } = require("node:crypto");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../app");
const M = require("../public/model");
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
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-Version": "2",
        origin,
        cookie,
      },
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
    const oldClient = await fetch(base + "/api/workspace", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost",
        cookie,
      },
      body: JSON.stringify({ projects: [], revision: 0 }),
    });
    assert.equal(oldClient.status, 426);
    const data = await (await req("/api/workspace")).json();
    assert.deepEqual(data, {
      schemaVersion: 2,
      projects: [],
      notes: [],
      templates: [],
      revision: 0,
    });
    const next = M.normalizeWorkspace({
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
    });
    const note = {
      id: "note",
      title: "An idea",
      body: "Private thoughts",
      projectId: "p",
      pinned: true,
      archived: false,
      createdAt: 1,
      updatedAt: 1,
    };
    next.notes.push(note);
    next.templates.push(
      M.projectFromTemplate(next.projects[0], "Release template"),
    );
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
    assert.equal(saved.notes[0].body, "Private thoughts");
    assert.equal(saved.templates[0].name, "Release template");
    const { createStore } = require("../store");
    const persisted = await createStore(env);
    const reloaded = await persisted.read();
    assert.equal(reloaded.notes[0].body, "Private thoughts");
    assert.equal(reloaded.templates[0].name, "Release template");
    await persisted.close();
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

test("Hostinger module runner starts the server when it requires the entry file", async () => {
  const { spawn } = require("node:child_process");
  const folder = await mkdtemp(path.join(os.tmpdir(), "valiantum-entry-"));
  const salt = "c".repeat(32);
  const child = spawn(process.execPath, ["-e", 'require("./server")'], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "0",
      MYSQL_HOST: "",
      PROJECTS_EMAIL: "owner@example.com",
      PROJECTS_PASSWORD_HASH:
        salt + ":" + scryptSync("test-password", salt, 64).toString("hex"),
      PROJECTS_DATA_FILE: path.join(folder, "workspace.json"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Required entry did not start listening")),
        3000,
      );
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("Valiantum Projects ready")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error("Entry exited before listening: " + code));
      });
    });
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("close", resolve));
    await rm(folder, { recursive: true, force: true });
  }
});
