# Valiantum Projects

Single-owner project workspace for **projects.valiantum.com**. The original marketing website stays unchanged. Projects runs as a separate Node.js application from this repository's `projects/` directory.

Features: projects, descriptions, resource links, custom lists, draggable cards (including reordering), card notes, priorities, assignees, due dates, editable checklists, search, JSON export and responsive layouts. The card editor supports keyboard/touch stage changes.

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

Production uses one existing Supabase owner account for both Projects and Marketing. Configure `PROJECTS_SUPABASE_OWNER_ID` to the existing owner UUID and `PROJECTS_SUPABASE_OWNER_EMAIL` to its email, alongside the public Supabase URL/key. `PROJECTS_EMAIL` remains the login email alias. Every private request verifies the provider identity against that UUID; there is no public signup or separate Marketing login. The root login supports the shared password or an email sign-in link for the existing account. A freshly verified email session can set one password using a session-bound, single-use, ten-minute ticket. Tokens use HttpOnly, Secure, SameSite=Lax cookies. Logout signs out both modules. Without the owner UUID, legacy local development keeps the scrypt password and in-memory session mode. Login throttling and password-setup tickets remain in memory, so use one application instance. Mutation requests require the exact configured origin. Workspace writes validate shape and limits, use parameterized MySQL queries, and reject conflicting revisions from another tab.

All projects and APIs require authentication. Login assets, the logo, and `/health` are accessible without a session. No sensitive project data is bundled into client code. Authenticated responses disable caching; search engine directives are defense in depth only. Project text is rendered as text, and resource links permit only HTTP(S). The export contains private project data: store it securely.

To rotate the owner password, generate a new hash, replace `PROJECTS_PASSWORD_HASH` in hPanel, and restart the app. Change `PROJECTS_EMAIL` there as needed. This app has no password reset email, collaboration roles, file attachments, or real-time sync. Assignees are optional text labels. Task status and checklist completion are tracked separately.

## Mobile usage

At phone widths (up to 760px), use the Project dropdown to switch projects. Lists stack vertically so every column is reachable with normal page scrolling. Tap a card to edit it; use **Card stage** to move it and **Position** to reorder it. These controls also work with a keyboard on desktop. Desktop mouse drag-and-drop remains available.

Phone layouts use larger touch targets and 16px form inputs, and editors adapt to the visible viewport with sticky save/cancel actions. Browser verification covered widths 320, 390, 430, 768, 844 and 1280px, including narrow-screen editing, checklist completion, due dates, project switching, search, list creation, task movement/ordering and persistence across reloads. Physical iOS/Android and on-screen keyboard behavior still warrant device testing. The workspace requires an internet connection; it does not offer offline editing.

## Personal workspace features (v2)

- **Today** combines open tasks from every active project: overdue, due today, next seven days, and tasks without a date. Upcoming milestones appear alongside them. Future tasks beyond seven days remain on their project boards.
- **Ideas & notes** is your private notebook. Capture an idea without a title (the first line becomes its title), pin important notes, search title/body, or link a note to a project. Open a saved note and choose **Turn into a task**; the original stays in your notebook. Notes are plain text.
- **Device drafts** preserve unfinished note text in that browser's local storage. Save syncs the note to MySQL across devices. Drafts stay on that device until saved, including after sign-out. This is recovery for interrupted writing, not an offline app; opening the app and syncing still need a connection.
- **Recurring tasks** support daily, weekly and monthly schedules. In the task editor, set Repeat and mark Task status Completed to create the next occurrence, with checklist progress reset. Schedules advance from the prior due date, or today when no date exists. Month-end dates clamp to the last day while retaining the original monthly anchor. Reopening and recompleting the same occurrence does not create a duplicate. There is no background scheduler or email/push reminder.
- **Templates** include product launch and content workflows. In Project details, use **Save as template** for your own reusable plan. New projects copy active lists, cards and milestones with fresh IDs; due dates and completion reset, while task descriptions and recurrence settings remain.
- **Milestones** live in a project's Overview. Add a target date and link tasks through the task editor. Linked-task progress is calculated automatically; milestone completion itself is explicit.
- **Archive** replaces permanent deletion for projects, lists, tasks, notes, templates and milestones. Archived parents hide their children until restored. Use Archive to restore anything; Project details can bulk-archive completed tasks. **Undo last change** reverses the last successful edit in the current tab and session, including recurring task creation; it is a one-step undo, not a history log.

Task status is explicit. Moving a card between custom lists does not change completion: set **Card stage → Complete** for Today, recurrence and milestone progress to recognize completion.

Existing JSON documents upgrade in memory without a destructive database migration. Legacy tasks already in a list named Done/Complete/Completed initialize as completed. The first successful edit persists the expanded document. Stale clients without `X-Workspace-Version: 2` cannot write, which prevents an old tab from dropping new note/template fields. All new data remains behind the existing authenticated API and is included in JSON exports.

## Task status colors

Choose **Plan**, **Open**, **In progress**, or **Complete** in the card editor. Open cards use a soft slate background; In progress uses muted yellow; Completed uses toned green with a checkmark box at the top right. Status text remains visible alongside priority, and completed content stays at full opacity without strikethrough. In motion tasks remain active in Today. New template copies and recurring occurrences start in Plan.


## Stage-based project cards

Each project's Cards view has three fixed categories: **Plan**, **Open**, and **In progress**. These are derived from card stage, so status, color, and placement stay synchronized. Drag between categories on desktop, or use Card stage in the editor on any device. The global Add card action starts in Plan.

Marking a card **Complete** automatically removes it from the active view and saves it in that project's **Completed** tab. The tab retains the card's full contents and the completion date for new completions. Open a completed card and select an active stage to bring it back; Undo also reverses a recent completion. Completed cards still count toward milestone progress. A recurring completion creates the next occurrence in Plan while retaining the completed occurrence in history.

Legacy list containers remain in storage to preserve existing records, but custom to-do lists no longer drive the visible board. Existing unstarted cards from Plan/To do/Ideas/Backlog initialize in Plan; other existing statuses remain available. Completed history is separate from the manual Archive, which remains for deliberately archived projects, cards, and notes. No cards are deleted by this update.


## Simplified card form

The card editor starts with Card title, Card stage, and Checklist, followed by the remaining details. Milestone controls and displays have been removed from cards, Overview, Today, and Archive. Legacy milestone fields remain compatible with existing stored documents; there is no destructive data migration.

## Archived notes

Ideas & notes now has Active notes and Archived notes tabs with counts. Archiving a note keeps its saved contents and opens Archived notes automatically. Search works within the selected tab. Open an archived note to read its full text, or use Restore note to return it to the active notebook. The selected tab is remembered on that device. The general Archive view remains available too.


Marketing OS is integrated at `/marketing`. See [MARKETING-INTEGRATION.md](MARKETING-INTEGRATION.md) for the existing-database connection and deployment workflow.

### Marketing studio interface

Marketing now includes a shared studio overview with live brand/content counts, brand identity cards, a review inbox, and a searchable content library with brand and status filters. The calendar supports month navigation, brand filtering and daily activity; it shows content creation dates in Eastern time. It does not represent drafts as scheduled publications. Public scheduling and posting remain disabled pending their provider and execution setup. Existing brand settings, AI drafting, review decisions and Projects briefs use the same authenticated data and actions.

The interface was checked at desktop, 390px and 320px widths with synthetic preview content. That temporary preview route is removed from the deployed source. Text previews are editorial excerpts, not rendered previews of the final social media asset.
