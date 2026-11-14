const M = ValiantumModel;
const $ = (selector) => document.querySelector(selector);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const id = () => crypto.randomUUID();
const button = (text, action, className = "") => {
  const b = el("button", className, text);
  b.type = "button";
  b.onclick = action;
  return b;
};
let state = M.normalizeWorkspace({ projects: [], revision: 0 }),
  active = localStorage.getItem("valiantum-project"),
  screen = localStorage.getItem("valiantum-screen") || "today",
  view = "board",
  editing = null,
  busy = false,
  blocked = false,
  dragging = null,
  undoState = null,
  noteQuery = "";
const builtinTemplates = M.builtins();
const project = () =>
  state.projects.find((p) => p.id === active && !p.archived);
const liveLists = (p) => p.lists.filter((l) => !l.archived);
const liveCards = (l) => l.cards.filter((c) => !c.archived);
const liveMilestones = (p) => p.milestones.filter((m) => !m.archived);
const notify = (text) => {
  $("#app-error").textContent = text;
};
async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    location.replace("/login");
    throw Error("Session expired. Please sign in again.");
  }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 409 || response.status === 426) blocked = true;
    throw Error(data.error || "Request failed.");
  }
  return data;
}
async function change(update, { undo = false } = {}) {
  if (busy || blocked) {
    notify(
      blocked
        ? "Reload this page before making more changes."
        : "A save is in progress. Please try again.",
    );
    return false;
  }
  busy = true;
  const before = M.copy(state);
  $("#save-state").textContent = "Saving…";
  notify("");
  try {
    update();
    if (!M.validWorkspace(state))
      throw Error("Check the fields and workspace limits before saving.");
    const result = await api("/api/workspace", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-Version": "2",
      },
      body: JSON.stringify(state),
    });
    state.revision = result.revision;
    undoState = undo ? null : before;
    $("#save-state").textContent = "All changes saved";
    return true;
  } catch (error) {
    state = before;
    $("#save-state").textContent = "Changes not saved";
    notify(error.message);
    if ($("#editor").open) $("#editor-error").textContent = error.message;
    return false;
  } finally {
    busy = false;
    render();
  }
}
function setScreen(value) {
  screen = value;
  localStorage.setItem("valiantum-screen", value);
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function selectProject(value) {
  active = value;
  screen = "board";
  localStorage.setItem("valiantum-project", value);
  localStorage.setItem("valiantum-screen", screen);
  $("#search").value = "";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function render() {
  if (!project()) active = state.projects.find((p) => !p.archived)?.id;
  $("#undo-change").hidden = !undoState;
  document.querySelectorAll("[data-screen]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.screen === screen);
    b.setAttribute(
      "aria-current",
      b.dataset.screen === screen ? "page" : "false",
    );
  });
  const nav = $("#projects"),
    picker = $("#project-picker");
  nav.replaceChildren();
  picker.replaceChildren();
  const placeholder = el(
    "option",
    "",
    screen === "board" ? "Choose project" : "Open a project…",
  );
  placeholder.value = "";
  picker.append(placeholder);
  state.projects
    .filter((p) => !p.archived)
    .forEach((p) => {
      const b = button(
        "",
        () => selectProject(p.id),
        p.id === active && screen === "board" ? "selected" : "",
      );
      b.append(el("span", "project-dot", "▦"), el("span", "", p.name));
      nav.append(b);
      const option = el("option", "", p.name);
      option.value = p.id;
      option.selected = screen === "board" && active === p.id;
      picker.append(option);
    });
  picker.disabled = !state.projects.some((p) => !p.archived);
  const p = project();
  $("#empty").hidden = screen !== "board" || !!p;
  $("#project-view").hidden = screen !== "board" || !p;
  $("#workspace-view").hidden = screen === "board";
  const titles = {
    today: "Today",
    ideas: "Ideas & notes",
    templates: "Templates",
    archive: "Archive",
  };
  $("#crumb").textContent =
    screen === "board" ? p?.name || "Projects" : titles[screen] || "Today";
  if (screen === "board" && p) renderBoard(p);
  else if (screen !== "board") renderWorkspace();
}
function renderBoard(p) {
  $("#project-name").textContent = p.name;
  $("#project-description").textContent =
    p.description || "A little clarity. A lot of forward motion.";
  const cards = liveLists(p).flatMap((l) => liveCards(l));
  const checklistTotal = cards.reduce((n, c) => n + c.checklist.length, 0),
    checklistDone = cards.reduce(
      (n, c) => n + c.checklist.filter((i) => i.done).length,
      0,
    );
  $("#stats").replaceChildren();
  [
    [cards.filter((c) => M.taskStatus(c) === "open").length, "open"],
    [cards.filter((c) => M.taskStatus(c) === "in-motion").length, "in motion"],
    [cards.filter((c) => c.completed).length, "completed"],
    [`${checklistDone}/${checklistTotal}`, "checklist items"],
  ].forEach(([n, label]) => {
    const s = el("span");
    s.append(el("strong", "", String(n)), document.createTextNode(" " + label));
    $("#stats").append(s);
  });
  $("#board").hidden = view !== "board";
  $("#overview").hidden = view !== "info";
  $("#board-tab").classList.toggle("active", view === "board");
  $("#info-tab").classList.toggle("active", view === "info");
  $("#board").replaceChildren();
  const query = $("#search").value.toLowerCase();
  for (const list of liveLists(p)) {
    const column = el("section", "list");
    column.setAttribute("aria-label", list.name);
    column.dataset.list = list.id;
    const heading = el("div", "list-heading");
    heading.append(
      el("h3", "", list.name),
      el("span", "count", String(liveCards(list).length)),
    );
    const settings = button("⋯", () => editList(p.id, list.id), "icon");
    settings.setAttribute("aria-label", "Edit " + list.name);
    heading.append(settings);
    column.append(heading);
    for (const card of liveCards(list).filter((c) =>
      [c.title, c.description, c.assignee]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )) {
      const item = cardTile(p, list, card);
      item.draggable = matchMedia("(pointer: fine)").matches;
      item.ondragstart = (e) => {
        dragging = { project: p.id, list: list.id, card: card.id };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.id);
      };
      item.ondragend = () => {
        dragging = null;
        document
          .querySelectorAll(".drag-over")
          .forEach((n) => n.classList.remove("drag-over"));
      };
      item.ondragover = (e) => {
        if (dragging) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      item.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        moveCard(p.id, list.id, card.id);
      };
      column.append(item);
    }
    column.append(
      button("+ Add a task", () => editCard(p.id, list.id), "add-card"),
    );
    column.ondragover = (e) => {
      if (dragging) {
        e.preventDefault();
        column.classList.add("drag-over");
      }
    };
    column.ondragleave = (e) => {
      if (!column.contains(e.relatedTarget))
        column.classList.remove("drag-over");
    };
    column.ondrop = (e) => {
      e.preventDefault();
      column.classList.remove("drag-over");
      moveCard(p.id, list.id);
    };
    $("#board").append(column);
  }
  if (!liveLists(p).length)
    $("#board").append(
      emptyMessage("No active lists. Add a list or restore one from Archive."),
    );
  renderOverview(p);
}
function cardTile(p, l, c, { context = false } = {}) {
  const status = M.taskStatus(c);
  const label = {
    open: "Open",
    "in-motion": "In motion",
    completed: "Completed",
  }[status];
  const item = el("article", "card status-" + status);
  item.tabIndex = 0;
  item.setAttribute("role", "button");
  item.setAttribute("aria-label", "Edit " + c.title + " — " + label);
  const badges = el("div", "card-badges");
  badges.append(
    el("span", "status-label", label),
    el("span", "priority " + c.priority, c.priority),
  );
  item.append(badges, el("h3", "", c.title));
  if (c.completed) {
    const mark = el("span", "completion-mark", "✓");
    mark.setAttribute("aria-hidden", "true");
    item.append(mark);
  }
  if (context) item.append(el("p", "task-context", p.name + " / " + l.name));
  if (c.description) item.append(el("p", "card-preview", c.description));
  const footer = el("div", "card-footer");
  if (c.due)
    footer.append(
      el(
        "span",
        !c.completed && c.due < M.localDay() ? "overdue" : "",
        "◷ " + formatDate(c.due),
      ),
    );
  if (c.repeat !== "none") footer.append(el("span", "", `↻ ${c.repeat}`));
  if (c.checklist.length)
    footer.append(
      el(
        "span",
        "",
        `☑ ${c.checklist.filter((i) => i.done).length}/${c.checklist.length}`,
      ),
    );
  const milestone = p.milestones.find(
    (m) => m.id === c.milestoneId && !m.archived,
  );
  if (milestone) item.append(el("p", "task-context", "◇ " + milestone.title));
  if (c.assignee) footer.append(el("span", "owner", c.assignee));
  if (footer.childNodes.length) item.append(footer);
  item.onclick = () => editCard(p.id, l.id, c.id);
  item.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      editCard(p.id, l.id, c.id);
    }
  };
  return item;
}
function formatDate(day) {
  return new Date(day + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function moveCard(projectId, targetId, beforeId) {
  if (!dragging) return;
  const from = dragging;
  dragging = null;
  if (from.card === beforeId) return;
  change(() => {
    const p = state.projects.find((p) => p.id === projectId),
      source = p.lists.find((l) => l.id === from.list),
      target = p.lists.find((l) => l.id === targetId);
    const i = source.cards.findIndex((c) => c.id === from.card);
    if (i < 0) return;
    const [card] = source.cards.splice(i, 1);
    const at = target.cards.findIndex((c) => c.id === beforeId);
    target.cards.splice(at < 0 ? target.cards.length : at, 0, card);
  });
}
function renderOverview(p) {
  const box = $("#overview");
  box.replaceChildren(
    el("h3", "", "About this project"),
    el("p", "", p.description || "Add a description in Project details."),
  );
  const milestoneHeading = el("div", "section-heading");
  milestoneHeading.append(
    el("h3", "", "Milestones"),
    button("+ Add milestone", () => editMilestone(p.id)),
  );
  box.append(milestoneHeading);
  for (const m of liveMilestones(p)) {
    const tasks = liveLists(p)
        .flatMap((l) => liveCards(l))
        .filter((c) => c.milestoneId === m.id),
      done = tasks.filter((c) => c.completed).length;
    const entry = el("div", "milestone-row");
    const details = el("div");
    details.append(
      el("strong", "", m.title),
      el(
        "p",
        "muted",
        `${m.completed ? "✓ Complete" : m.due ? "Due " + formatDate(m.due) : "No deadline"} · ${done}/${tasks.length} linked tasks complete`,
      ),
    );
    if (m.description) details.append(el("p", "", m.description));
    entry.append(
      details,
      button("Edit", () => editMilestone(p.id, m.id)),
    );
    box.append(entry);
  }
  if (!liveMilestones(p).length)
    box.append(
      el("p", "muted", "Give the next release or big goal a finish line."),
    );
  box.append(el("h3", "", "Resources & links"));
  const links = p.links
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!links.length)
    box.append(el("p", "muted", "Add useful links in Project details."));
  for (const link of links) {
    try {
      const url = new URL(link);
      if (!["http:", "https:"].includes(url.protocol)) throw Error();
      const a = el("a", "", link + " ↗");
      a.href = url.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      box.append(a);
    } catch {
      box.append(el("p", "", link));
    }
  }
  box.append(el("h3", "", "Project notes"));
  const notes = state.notes.filter((n) => !n.archived && n.projectId === p.id);
  notes.forEach((n) => box.append(noteTile(n)));
  box.append(button("+ Add project note", () => editNote(null, p.id)));
}
function pageHeading(title, description, action) {
  const h = el("div", "workspace-heading"),
    text = el("div");
  text.append(
    el("p", "eyebrow", "YOUR PERSONAL WORKSPACE"),
    el("h1", "", title),
    el("p", "muted", description),
  );
  h.append(text);
  if (action) h.append(action);
  return h;
}
function emptyMessage(text) {
  return el("p", "empty-message", text);
}
function section(title, items, render) {
  const box = el("section", "dashboard-section");
  box.append(el("h2", "", `${title} · ${items.length}`));
  const grid = el("div", "task-grid");
  for (const item of items) grid.append(render(item));
  box.append(grid);
  return box;
}
function renderWorkspace() {
  const box = $("#workspace-view");
  box.replaceChildren();
  if (screen === "today") {
    const today = M.localDay(),
      tasks = M.activeTasks(state).filter((t) => !t.card.completed),
      soon = new Date();
    soon.setDate(soon.getDate() + 7);
    const end = M.localDay(soon);
    tasks.sort((a, b) =>
      (a.card.due || "9999").localeCompare(b.card.due || "9999"),
    );
    box.append(
      pageHeading(
        "A little focus. Real progress.",
        new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        button("+ Quick task", () => quickTask(), "primary"),
      ),
    );
    const overdue = tasks.filter((t) => t.card.due && t.card.due < today),
      due = tasks.filter((t) => t.card.due === today),
      upcoming = tasks.filter((t) => t.card.due > today && t.card.due <= end),
      noDate = tasks.filter((t) => !t.card.due);
    const summary = el("div", "summary-grid");
    [
      [overdue.length, "Overdue"],
      [due.length, "Due today"],
      [tasks.length, "Active across projects"],
    ].forEach(([n, t]) => {
      const s = el("div", "summary-card");
      s.append(el("strong", "", String(n)), el("span", "muted", t));
      summary.append(s);
    });
    box.append(summary);
    for (const [title, items] of [
      ["Overdue", overdue],
      ["Due today", due],
      ["Next 7 days", upcoming],
      ["No due date", noDate],
    ])
      if (items.length)
        box.append(
          section(title, items, (t) =>
            cardTile(t.project, t.list, t.card, { context: true }),
          ),
        );
    if (!overdue.length && !due.length)
      box.append(
        emptyMessage(
          "Nothing overdue or due today. Capture an idea, plan your next task, or open a project.",
        ),
      );
    const milestones = state.projects
      .filter((p) => !p.archived)
      .flatMap((p) =>
        liveMilestones(p)
          .filter((m) => !m.completed && m.due && m.due <= end)
          .map((m) => ({ p, m })),
      )
      .sort((a, b) => a.m.due.localeCompare(b.m.due));
    if (milestones.length)
      box.append(
        section("Milestones on the horizon", milestones, ({ p, m }) => {
          const n = el("div", "note-card");
          n.append(
            el("h3", "", m.title),
            el("p", "muted", p.name + " · " + formatDate(m.due)),
            button("Edit milestone", () => editMilestone(p.id, m.id)),
          );
          return n;
        }),
      );
  } else if (screen === "ideas") {
    box.append(
      pageHeading(
        "Room for your next idea.",
        "A private notebook for business ideas, rough thoughts, and things to come back to.",
        button("+ New note", () => editNote(), "primary"),
      ),
    );
    const search = el("form", "note-search"),
      input = el("input");
    input.type = "search";
    input.placeholder = "Search ideas and notes…";
    input.setAttribute("aria-label", "Search notes");
    input.value = noteQuery;
    const submit = el("button", "", "Search");
    submit.type = "submit";
    search.append(input, submit);
    search.onsubmit = (e) => {
      e.preventDefault();
      noteQuery = input.value;
      renderWorkspace();
    };
    box.append(search);
    const query = noteQuery.trim().toLowerCase();
    const notes = state.notes
      .filter(
        (n) =>
          !n.archived &&
          [n.title, n.body].join(" ").toLowerCase().includes(query),
      )
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
      );
    if (notes.length)
      box.append(section("Your notes", notes, (n) => noteTile(n)));
    else
      box.append(
        emptyMessage(
          query
            ? "No notes match that search."
            : "Capture a thought now. You can link it to a project or turn it into a task later.",
        ),
      );
  } else if (screen === "templates") {
    box.append(
      pageHeading(
        "Start with a head start.",
        "Reuse launch plans and content workflows. Saved project templates keep the structure and reset dates and progress.",
      ),
    );
    const all = [
      ...builtinTemplates,
      ...state.templates.filter((t) => !t.archived),
    ];
    box.append(
      section("Project templates", all, (t) => {
        const tile = el("article", "note-card");
        tile.append(
          el("h3", "", t.name),
          el(
            "p",
            "muted",
            t.description || `${t.lists.length} lists ready to reuse`,
          ),
          button("Use template", () => editProject(null, t)),
        );
        if (state.templates.includes(t))
          tile.append(
            button("Archive template", () =>
              change(
                () =>
                  (state.templates.find((x) => x.id === t.id).archived = true),
              ),
            ),
          );
        return tile;
      }),
    );
    box.append(
      emptyMessage(
        "To save your own template, open a project → Project details → Save as template.",
      ),
    );
  } else if (screen === "archive") {
    box.append(
      pageHeading(
        "A place to put things down.",
        "Archived items stay saved. Restore them whenever you need them.",
      ),
    );
    let count = 0;
    const add = (label, restore) => {
      count++;
      const row = el("div", "archive-row");
      row.append(
        el("span", "", label),
        button("Restore", () => change(restore)),
      );
      box.append(row);
    };
    for (const p of state.projects) {
      if (p.archived) {
        add(
          "Project · " + p.name,
          () => (state.projects.find((x) => x.id === p.id).archived = false),
        );
        continue;
      }
      for (const l of p.lists) {
        if (l.archived) {
          add(
            `${p.name} / List · ${l.name}`,
            () =>
              (state.projects
                .find((x) => x.id === p.id)
                .lists.find((x) => x.id === l.id).archived = false),
          );
          continue;
        }
        for (const c of l.cards)
          if (c.archived)
            add(
              `${p.name} / Task · ${c.title}`,
              () =>
                (state.projects
                  .find((x) => x.id === p.id)
                  .lists.find((x) => x.id === l.id)
                  .cards.find((x) => x.id === c.id).archived = false),
            );
      }
      for (const m of p.milestones)
        if (m.archived)
          add(
            `${p.name} / Milestone · ${m.title}`,
            () =>
              (state.projects
                .find((x) => x.id === p.id)
                .milestones.find((x) => x.id === m.id).archived = false),
          );
    }
    for (const n of state.notes)
      if (n.archived)
        add(
          "Note · " + n.title,
          () => (state.notes.find((x) => x.id === n.id).archived = false),
        );
    for (const t of state.templates)
      if (t.archived)
        add(
          "Template · " + t.name,
          () => (state.templates.find((x) => x.id === t.id).archived = false),
        );
    if (!count)
      box.append(
        emptyMessage(
          "Nothing archived. Archive finished tasks or old projects to keep your workspace clear.",
        ),
      );
  }
}
function noteTile(note) {
  const tile = el("article", "note-card");
  tile.append(
    el("h3", "", (note.pinned ? "★ " : "") + note.title),
    el("p", "note-preview", note.body || "No additional notes."),
  );
  const linked = state.projects.find((p) => p.id === note.projectId);
  tile.append(
    el(
      "p",
      "task-context",
      (linked ? linked.name + " · " : "") +
        new Date(note.updatedAt).toLocaleDateString(),
    ),
    button("Open note", () => editNote(note.id)),
  );
  return tile;
}
function field(label, name, value = "", type = "text", max = 10000) {
  const l = el("label", "", label),
    input = el(type === "textarea" ? "textarea" : "input");
  input.name = name;
  input.value = value;
  input.maxLength = max;
  if (type !== "textarea") input.type = type;
  l.append(input);
  return l;
}
function select(label, name, value, options) {
  const l = el("label", "", label),
    s = el("select");
  s.name = name;
  s.setAttribute("aria-label", label);
  for (const [value_, text] of options) {
    const o = el("option", "", text);
    o.value = value_;
    o.selected = value_ === value;
    s.append(o);
  }
  l.append(s);
  return l;
}
function checkbox(label, name, value) {
  const l = el("label", "checkbox-field"),
    input = el("input");
  input.type = "checkbox";
  input.name = name;
  input.checked = value;
  l.append(input, document.createTextNode(label));
  return l;
}
function openEditor(kind, title, fields, onSave, onArchive, extra = []) {
  editing = { onSave, onArchive };
  $("#editor-kind").textContent = kind;
  $("#editor-title").textContent = title;
  $("#editor-fields").replaceChildren(...fields);
  $("#editor-error").textContent = "";
  $("#delete-item").hidden = !onArchive;
  $("#editor-extra-actions").replaceChildren(...extra);
  $("#editor-form button[type=submit]").textContent = "Save changes";
  $("#editor").showModal();
  $("#editor").scrollTop = 0;
  if (matchMedia("(max-width: 760px)").matches) $("#editor-title").focus();
  else $("#editor-fields input")?.focus();
}
function editProject(projectId, chosenTemplate) {
  const existing = state.projects.find((p) => p.id === projectId),
    p = existing || {
      name: "",
      description: chosenTemplate?.description || "",
      links: chosenTemplate?.links || "",
    };
  const name = field("Project name", "name", p.name, "text", 160);
  name.querySelector("input").required = true;
  const templates = [
    ...builtinTemplates,
    ...state.templates.filter((t) => !t.archived),
  ];
  const fields = [name];
  if (!existing)
    fields.push(
      select(
        "Start from template",
        "template",
        chosenTemplate?.id || "blank",
        templates.map((t) => [t.id, t.name]),
      ),
    );
  fields.push(
    field("Description", "description", p.description, "textarea"),
    field(
      "Resources & links (one per line)",
      "links",
      p.links,
      "textarea",
      5000,
    ),
  );
  if (!existing)
    fields
      .find((f) => f.querySelector("[name=template]"))
      ?.querySelector("select")
      .addEventListener("change", (event) => {
        const template = templates.find((t) => t.id === event.target.value);
        fields
          .find((f) => f.querySelector("[name=description]"))
          .querySelector("textarea").value = template?.description || "";
        fields
          .find((f) => f.querySelector("[name=links]"))
          .querySelector("textarea").value = template?.links || "";
      });
  const extra = [];
  if (existing) {
    extra.push(
      button("Save as template", async () => {
        if (
          await change(() => {
            const current = state.projects.find((p) => p.id === projectId);
            const template = M.projectFromTemplate(
              current,
              current.name + " template",
            );
            template.name = template.name.slice(0, 160);
            state.templates.push(template);
          })
        ) {
          $("#editor").close();
          setScreen("templates");
        }
      }),
    );
    extra.push(
      button("Archive completed tasks", async () => {
        if (
          await change(() => {
            for (const l of state.projects.find((p) => p.id === projectId)
              .lists)
              for (const c of l.cards) if (c.completed) c.archived = true;
          })
        )
          $("#editor").close();
      }),
    );
  }
  openEditor(
    "PROJECT DETAILS",
    existing ? "Make it your own." : "A new beginning.",
    fields,
    async (fd) => {
      const name = fd.get("name").trim();
      if (!name) throw Error("Enter a project name.");
      const key = projectId || id();
      const ok = await change(() => {
        let current = state.projects.find((p) => p.id === projectId);
        if (!current) {
          current = M.projectFromTemplate(
            templates.find((t) => t.id === fd.get("template")),
            name,
          );
          current.id = key;
          state.projects.push(current);
        }
        current.name = name;
        current.description = fd.get("description");
        current.links = fd.get("links");
      });
      if (ok) selectProject(key);
      return ok;
    },
    existing
      ? () =>
          change(
            () =>
              (state.projects.find((p) => p.id === projectId).archived = true),
          )
      : null,
    extra,
  );
}
function editList(projectId, listId) {
  const p = state.projects.find((p) => p.id === projectId),
    list = p.lists.find((l) => l.id === listId);
  const f = field("List name", "name", list?.name || "", "text", 100);
  f.querySelector("input").required = true;
  openEditor(
    "BOARD LIST",
    list ? "Edit list" : "Create a list",
    [f],
    (fd) => {
      const name = fd.get("name").trim();
      if (!name) throw Error("Enter a list name.");
      return change(() => {
        const p = state.projects.find((p) => p.id === projectId);
        if (listId) p.lists.find((l) => l.id === listId).name = name;
        else p.lists.push({ id: id(), name, archived: false, cards: [] });
      });
    },
    list
      ? () =>
          change(
            () =>
              (state.projects
                .find((p) => p.id === projectId)
                .lists.find((l) => l.id === listId).archived = true),
          )
      : null,
  );
}
function quickTask() {
  const projects = state.projects.filter(
    (p) => !p.archived && liveLists(p).length,
  );
  if (!projects.length) {
    editProject();
    return;
  }
  const picker = select(
    "Project",
    "project",
    projects.some((p) => p.id === active) ? active : projects[0].id,
    projects.map((p) => [p.id, p.name]),
  );
  openEditor(
    "QUICK TASK",
    "Where does it belong?",
    [picker],
    async (fd) => {
      const p = state.projects.find((p) => p.id === fd.get("project"));
      $("#editor").close();
      editCard(p.id, liveLists(p)[0].id);
      return false;
    },
    null,
  );
}
function editCard(projectId, listId, cardId, noteId) {
  const p = state.projects.find((p) => p.id === projectId),
    list = p.lists.find((l) => l.id === listId),
    existing = list.cards.find((c) => c.id === cardId),
    note = state.notes.find((n) => n.id === noteId),
    c =
      existing ||
      M.task({ title: note?.title || "", description: note?.body || "" });
  const title = field("Task title", "title", c.title, "text", 300);
  title.querySelector("input").required = true;
  const row = el("div", "field-row");
  row.append(
    select(
      "Priority",
      "priority",
      c.priority,
      ["Low", "Medium", "High"].map((x) => [x, x]),
    ),
    field("Due date", "due", c.due, "date"),
  );
  const listField = select(
      "List",
      "list",
      list.id,
      liveLists(p).map((l) => [l.id, l.name]),
    ),
    positionField = select("Position", "position", "", []);
  function updatePositions() {
    const target = p.lists.find(
        (l) => l.id === listField.querySelector("select").value,
      ),
      others = target.cards.filter(
        (card) => !card.archived && card.id !== cardId,
      ),
      positions = positionField.querySelector("select");
    positions.replaceChildren();
    for (const card of others) {
      const o = el("option", "", "Before: " + card.title);
      o.value = card.id;
      positions.append(o);
    }
    const end = el("option", "", "End of list");
    end.value = "";
    positions.append(end);
    const next =
      existing && target.id === list.id
        ? liveCards(list).slice(
            liveCards(list).findIndex((x) => x.id === cardId) + 1,
          )[0]
        : null;
    positions.value = next?.id || "";
  }
  updatePositions();
  listField.querySelector("select").onchange = updatePositions;
  const checklist = el("div", "checklist");
  checklist.append(el("h3", "small", "CHECKLIST"));
  const rows = el("div");
  function addCheck(item = { id: id(), text: "", done: false }) {
    const r = el("div", "check-row"),
      check = el("input"),
      text = el("input"),
      remove = button("×", () => r.remove(), "icon");
    check.type = "checkbox";
    check.checked = item.done;
    check.setAttribute("aria-label", "Checklist item complete");
    text.type = "text";
    text.value = item.text;
    text.maxLength = 500;
    text.placeholder = "Checklist item";
    text.setAttribute("aria-label", "Checklist item text");
    remove.setAttribute("aria-label", "Remove checklist item");
    r.dataset.id = item.id;
    r.append(check, text, remove);
    rows.append(r);
  }
  c.checklist.forEach(addCheck);
  const add = button(
    "+ Add checklist item",
    () => {
      if (rows.children.length < 100) addCheck();
    },
    "add-card",
  );
  checklist.append(rows, add);
  const recurrenceHelp = el(
    "p",
    "field-help",
    "Completing a recurring task creates the next occurrence from its due date (or today), with a fresh checklist. Overdue schedules advance one occurrence at a time.",
  );
  const options = [
    ["", "No milestone"],
    ...p.milestones
      .filter((m) => !m.archived || m.id === c.milestoneId)
      .map((m) => [m.id, m.title + (m.archived ? " (archived)" : "")]),
  ];
  const fields = [
    title,
    field("Description & notes", "description", c.description, "textarea"),
    row,
    select("Task status", "status", M.taskStatus(c), [
      ["open", "Open"],
      ["in-motion", "In motion"],
      ["completed", "Completed"],
    ]),
    select("Repeat", "repeat", c.repeat, [
      ["none", "Does not repeat"],
      ["daily", "Daily"],
      ["weekly", "Weekly"],
      ["monthly", "Monthly"],
    ]),
    recurrenceHelp,
    field("Assignee (optional)", "assignee", c.assignee, "text", 150),
    select("Milestone", "milestoneId", c.milestoneId, options),
    listField,
    positionField,
    checklist,
  ];
  if (note)
    fields.push(
      el(
        "p",
        "field-help",
        "Your original note stays in Ideas & notes after this task is created.",
      ),
    );
  openEditor(
    "TASK DETAILS",
    existing ? "Keep things moving." : "What’s next?",
    fields,
    (fd) => {
      const title = fd.get("title").trim();
      if (!title) throw Error("Enter a task title.");
      if (!M.validDate(fd.get("due"))) throw Error("Choose a valid due date.");
      return change(() => {
        const p = state.projects.find((p) => p.id === projectId),
          source = p.lists.find((l) => l.id === listId),
          target = p.lists.find((l) => l.id === fd.get("list"));
        const previous = source.cards.find((c) => c.id === cardId);
        const value = M.task({
          ...c,
          id: cardId || c.id,
          title,
          description: fd.get("description"),
          priority: fd.get("priority"),
          due: fd.get("due"),
          assignee: fd.get("assignee"),
          repeat: fd.get("repeat"),
          repeatDay: fd.get("due")
            ? fd.get("due") === c.due
              ? c.repeatDay
              : Number(fd.get("due").slice(-2))
            : 0,
          milestoneId: fd.get("milestoneId"),
          completed: previous?.completed || false,
          inMotion: fd.get("status") === "in-motion",
          checklist: Array.from(rows.children)
            .map((r) => ({
              id: r.dataset.id,
              text: r.querySelector("input[type=text]").value.trim(),
              done: r.querySelector("input[type=checkbox]").checked,
            }))
            .filter((i) => i.text),
        });
        if (previous)
          source.cards = source.cards.filter((c) => c.id !== cardId);
        const before = target.cards.findIndex(
          (c) => c.id === fd.get("position"),
        );
        target.cards.splice(
          before < 0 ? target.cards.length : before,
          0,
          value,
        );
        if (fd.get("status") === "completed" && !value.completed)
          M.completeTask(p, target, value);
        else value.completed = fd.get("status") === "completed";
      });
    },
    existing
      ? () =>
          change(
            () =>
              (state.projects
                .find((p) => p.id === projectId)
                .lists.find((l) => l.id === listId)
                .cards.find((c) => c.id === cardId).archived = true),
          )
      : null,
  );
}
function editMilestone(projectId, milestoneId) {
  const p = state.projects.find((p) => p.id === projectId),
    m = p.milestones.find((m) => m.id === milestoneId) || {
      title: "",
      description: "",
      due: "",
      completed: false,
    };
  const title = field("Milestone title", "title", m.title, "text", 160);
  title.querySelector("input").required = true;
  openEditor(
    "MILESTONE",
    milestoneId ? "A clear finish line." : "Set your next goal.",
    [
      title,
      field("Description", "description", m.description, "textarea", 5000),
      field("Target date", "due", m.due, "date"),
      checkbox("Milestone complete", "completed", m.completed),
    ],
    (fd) => {
      const title = fd.get("title").trim();
      if (!title) throw Error("Enter a milestone title.");
      return change(() => {
        const p = state.projects.find((p) => p.id === projectId);
        let current = p.milestones.find((m) => m.id === milestoneId);
        if (!current) {
          current = { id: id(), archived: false };
          p.milestones.push(current);
        }
        Object.assign(current, {
          title,
          description: fd.get("description"),
          due: fd.get("due"),
          completed: fd.has("completed"),
        });
      });
    },
    milestoneId
      ? () =>
          change(
            () =>
              (state.projects
                .find((p) => p.id === projectId)
                .milestones.find((m) => m.id === milestoneId).archived = true),
          )
      : null,
  );
}
function editNote(noteId, projectId = "") {
  const storedNote = state.notes.find((n) => n.id === noteId);
  const note = {
    ...(storedNote || { title: "", body: "", projectId, pinned: false }),
  };
  const draftKey = "valiantum-note-draft:" + (noteId || "new");
  let restored = false;
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (
      draft &&
      typeof draft.title === "string" &&
      typeof draft.body === "string"
    ) {
      Object.assign(note, {
        title: draft.title,
        body: draft.body,
        projectId:
          typeof draft.projectId === "string"
            ? draft.projectId
            : note.projectId,
        pinned: !!draft.pinned,
      });
      restored = true;
    }
  } catch {}
  const title = field("Idea or note title", "title", note.title, "text", 300),
    body = field("Notes", "body", note.body, "textarea", 20000);
  body.querySelector("textarea").className = "note-body";
  const options = [
    ["", "Inbox — no project"],
    ...state.projects
      .filter((p) => !p.archived || p.id === note.projectId)
      .map((p) => [p.id, p.name + (p.archived ? " (archived)" : "")]),
  ];
  const linkField = select(
      "Link to project",
      "projectId",
      note.projectId,
      options,
    ),
    pinnedField = checkbox("Pin this note", "pinned", note.pinned);
  const draftStatus = el(
    "p",
    "field-help",
    restored
      ? "Recovered your unsaved draft from this device. Save to sync it."
      : "Title is optional: your first line becomes the title. Save syncs this note; an unfinished draft stays on this device.",
  );
  const saveDraft = () => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          title: title.querySelector("input").value,
          body: body.querySelector("textarea").value,
          projectId: linkField.querySelector("select").value,
          pinned: pinnedField.querySelector("input").checked,
        }),
      );
      draftStatus.textContent =
        "Draft saved on this device. Save changes to sync it across devices.";
    } catch {
      draftStatus.textContent =
        "Device draft storage is unavailable. Keep this window open and save your note.";
    }
  };
  for (const node of [title, body, linkField, pinnedField])
    node.addEventListener("input", saveDraft);
  const extra = [];
  if (noteId)
    extra.push(
      button("Turn into a task", () => {
        const projects = state.projects.filter(
          (p) => !p.archived && liveLists(p).length,
        );
        if (!projects.length) {
          $("#editor-error").textContent =
            "Create a project with an active list first. Your note is saved.";
          return;
        }
        const values = new FormData($("#editor-form"));
        if (
          values.get("title") !== storedNote.title ||
          values.get("body") !== storedNote.body
        ) {
          $("#editor-error").textContent =
            "Save your note changes before turning it into a task.";
          return;
        }
        const picker = select(
          "Project",
          "project",
          projects.some((p) => p.id === note.projectId)
            ? note.projectId
            : projects[0].id,
          projects.map((p) => [p.id, p.name]),
        );
        $("#editor").close();
        openEditor(
          "IDEA TO TASK",
          "Give this idea a next step.",
          [picker],
          async (fd) => {
            const p = state.projects.find((p) => p.id === fd.get("project"));
            $("#editor").close();
            editCard(p.id, liveLists(p)[0].id, null, noteId);
            return false;
          },
          null,
        );
      }),
    );
  openEditor(
    "IDEAS & NOTES",
    noteId ? "Keep the thought going." : "Catch it before it’s gone.",
    [title, body, linkField, pinnedField, draftStatus],
    async (fd) => {
      const title =
        fd.get("title").trim() ||
        fd
          .get("body")
          .trim()
          .split("\n")
          .find((line) => line.trim())
          ?.slice(0, 80);
      if (!title) throw Error("Write a title or a note.");
      const ok = await change(() => {
        let current = state.notes.find((n) => n.id === noteId);
        if (!current) {
          current = { id: id(), createdAt: Date.now(), archived: false };
          state.notes.push(current);
        }
        Object.assign(current, {
          title,
          body: fd.get("body"),
          projectId: fd.get("projectId"),
          pinned: fd.has("pinned"),
          updatedAt: Date.now(),
        });
      });
      if (ok) {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
        setScreen("ideas");
      }
      return ok;
    },
    noteId
      ? () =>
          change(
            () => (state.notes.find((n) => n.id === noteId).archived = true),
          )
      : null,
    extra,
  );
}
$("#editor-form").onsubmit = async (event) => {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    if (await editing.onSave(new FormData(event.target))) $("#editor").close();
  } catch (error) {
    $("#editor-error").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};
$("#delete-item").onclick = async () => {
  if (await editing.onArchive()) $("#editor").close();
};
$("#close-editor").onclick = $("#cancel-editor").onclick = () =>
  $("#editor").close();
$("#new-project").onclick = $("#first-project").onclick = () => editProject();
$("#project-settings").onclick = () => editProject(project().id);
$("#add-list").onclick = () => editList(project().id);
$("#search").oninput = () => renderBoard(project());
$("#project-picker").onchange = (e) => {
  if (e.target.value) selectProject(e.target.value);
};
$("#board-tab").onclick = () => {
  view = "board";
  render();
};
$("#info-tab").onclick = () => {
  view = "info";
  render();
};
$("#quick-capture").onclick = () => editNote();
document
  .querySelectorAll("[data-screen]")
  .forEach((b) => (b.onclick = () => setScreen(b.dataset.screen)));
$("#undo-change").onclick = async () => {
  if (!undoState) return;
  const previous = M.copy(undoState);
  await change(
    () => {
      const revision = state.revision;
      state = { ...previous, revision };
    },
    { undo: true },
  );
};
$("#logout").onclick = async () => {
  try {
    await api("/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    location.replace("/login");
  } catch (e) {
    notify(e.message);
  }
};
api("/api/workspace")
  .then((data) => {
    state = M.normalizeWorkspace(data);
    render();
  })
  .catch((e) => notify(e.message));
