# Valiantum Projects

Single-owner project workspace for **projects.valiantum.com**. The original marketing website stays unchanged. Projects runs as a separate Node.js application from this repository's `projects/` directory.

Features: projects, descriptions, resource links, custom lists, draggable cards (including reordering), card notes, priorities, assignees, due dates, editable checklists, search, JSON export and responsive layouts. The task editor's List selector also supports keyboard/touch movement.

## Local development

Use Node.js 22 or newer.

1. `cd projects && npm ci`
2. `npm run password` — enter a strong password into the hidden prompt. Keep the printed hash private.
3. Set `PROJECTS_EMAIL`, `PROJECTS_PASSWORD_HASH`, and `APP_ORIGIN=http://localhost:3001` in your shell. No credentials are committed. This app does not automatically load `.env` files; use your environment manager or Node's `--env-file` option.
4. `npm start` and open `http://localhost:3001`.

Development uses a local ignored `data/workspace.json`. Production refuses to run without MySQL. Use `npm test` for HTTP integration tests.

## Hostinger deployment

1. In Hostinger hPanel, add **projects.valiantum.com as a separate Node.js website**. Do not change the existing valiantum.com site's root directory or startup command.
2. Connect this GitHub repository and the branch containing this change. Set application root to `projects`, Node.js to 22 or newer, install command `npm ci`, and start command `npm start` (entry file `server.js`). No build or static output directory is needed.
3. Create a dedicated MySQL database and database user in Hostinger. Enter its connection details in environment variables. The app creates its own `valiantum_projects` table; the user needs CREATE, SELECT, INSERT and UPDATE permissions. Keep the database private to the hosting network where possible.
4. Add the environment variables listed in `.env.example` through hPanel: `NODE_ENV=production`, `APP_ORIGIN=https://projects.valiantum.com`, your owner email, a locally generated password hash, and the MySQL credentials. Values must be unquoted. Never put plaintext passwords or production secrets in GitHub.
5. Connect the subdomain using Hostinger's displayed DNS instructions and enable SSL. Do not change the main domain's records. Deploy/restart the Projects application.
6. Verify that signed-out requests to `/` redirect to `/login`, `/api/workspace` and `/api/export` return 401, and that creating a project survives a restart/redeployment. Confirm MySQL backup coverage and retain periodic JSON exports.

Hostinger account access, production credentials, and domain configuration are required to complete these steps; code alone does not provision them.

## Access and data

Only the configured owner can log in; there is no public signup. The password is stored as a salted scrypt hash in the hosting environment. Sessions use random server-side tokens in host-only HttpOnly, SameSite=Strict cookies, with Secure enabled in production and a 12-hour maximum lifetime. Restarting the app signs out all sessions. Keep one application instance (sessions and login throttling are in memory). The login endpoint throttles the account after ten attempts per 15-minute window. Mutation requests require the exact configured origin. Workspace writes validate shape and limits, use parameterized MySQL queries, and reject conflicting revisions from another tab.

All projects and APIs require authentication. Login assets, the logo, and `/health` are accessible without a session. No sensitive project data is bundled into client code. Authenticated responses disable caching; search engine directives are defense in depth only. Project text is rendered as text, and resource links permit only HTTP(S). The export contains private project data: store it securely.

To rotate the owner password, generate a new hash, replace `PROJECTS_PASSWORD_HASH` in hPanel, and restart the app. Change `PROJECTS_EMAIL` there as needed. This first version has no password reset email, collaboration roles, file attachments, or real-time sync. Assignees are text labels for planning. Task completion is represented by the list you move a task into, and checklist completion is tracked separately.
