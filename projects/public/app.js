const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const id = () => crypto.randomUUID();
let state = { projects: [], revision: 0 },
  active = localStorage.getItem("valiantum-project"),
  editing = null,
  busy = false,
  blocked = false,
  view = "board",
  dragging = null;
const project = () => state.projects.find((p) => p.id === active);
async function api(url, options = {}) {
  const r = await fetch(url, options);
  if (r.status === 401) {
    location.replace("/login");
    throw Error("Session expired.");
  }
  const d = await r.json();
  if (!r.ok) {
    if (r.status === 409) blocked = true;
    throw Error(d.error || "Request failed.");
  }
  return d;
}
async function change(update) {
  if (busy || blocked) {
    $("#app-error").textContent = blocked
      ? "Reload this page before making more changes."
      : "A save is in progress. Please try again.";
    return false;
  }
  busy = true;
  const before = structuredClone(state);
  $("#save-state").textContent = "Saving…";
  $("#app-error").textContent = "";
  try {
    update();
    const result = await api("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    state.revision = result.revision;
    $("#save-state").textContent = "All changes saved";
    return true;
  } catch (e) {
    state = before;
    $("#save-state").textContent = "Changes not saved";
    $("#app-error").textContent = e.message;
    return false;
  } finally {
    busy = false;
    render();
  }
}
function selectProject(value) {
  active = value;
  localStorage.setItem("valiantum-project", value);
  $("#search").value = "";
  render();
}
function render() {
  if (!project()) active = state.projects[0]?.id;
  const p = project();
  $("#projects").replaceChildren();
  state.projects.forEach((item) => {
    const b = el("button", item.id === active ? "selected" : "");
    b.append(el("span", "project-dot", "▦"), el("span", "", item.name));
    b.onclick = () => selectProject(item.id);
    $("#projects").append(b);
  });
  $("#empty").hidden = !!p;
  $("#project-view").hidden = !p;
  $("#crumb").textContent = p?.name || "Projects";
  if (!p) return;
  $("#project-name").textContent = p.name;
  $("#project-description").textContent =
    p.description || "A little clarity. A lot of forward motion.";
  const cards = p.lists.flatMap((l) => l.cards),
    done = cards.reduce(
      (n, c) => n + c.checklist.filter((i) => i.done).length,
      0,
    ),
    total = cards.reduce((n, c) => n + c.checklist.length, 0);
  $("#stats").replaceChildren();
  [
    [cards.length, "tasks"],
    [p.lists.length, "lists"],
    [`${done}/${total}`, "checklist items complete"],
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
  p.lists.forEach((list) => {
    const column = el("section", "list");
    column.setAttribute("aria-label", list.name);
    column.dataset.list = list.id;
    const heading = el("div", "list-heading");
    heading.append(
      el("h3", "", list.name),
      el("span", "count", String(list.cards.length)),
    );
    const settings = el("button", "icon", "⋯");
    settings.setAttribute("aria-label", "Edit " + list.name);
    settings.onclick = () => editList(list);
    heading.append(settings);
    column.append(heading);
    list.cards
      .filter((c) =>
        [c.title, c.description, c.assignee]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .forEach((card) => {
        const item = el("article", "card");
        item.tabIndex = 0;
        item.draggable = true;
        item.setAttribute("role", "button");
        item.setAttribute("aria-label", "Edit " + card.title);
        item.append(
          el("span", "priority " + card.priority, card.priority),
          el("h3", "", card.title),
        );
        if (card.description)
          item.append(el("p", "card-preview", card.description));
        const footer = el("div", "card-footer");
        if (card.due) {
          const today = new Date().toLocaleDateString("en-CA");
          footer.append(
            el(
              "span",
              card.due < today ? "overdue" : "",
              "◷ " +
                new Date(card.due + "T12:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                }),
            ),
          );
        }
        if (card.checklist.length)
          footer.append(
            el(
              "span",
              "",
              `☑ ${card.checklist.filter((i) => i.done).length}/${card.checklist.length}`,
            ),
          );
        if (card.assignee) footer.append(el("span", "owner", card.assignee));
        if (footer.childNodes.length) item.append(footer);
        item.onclick = () => editCard(list, card);
        item.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            editCard(list, card);
          }
        };
        item.ondragstart = (e) => {
          dragging = { list: list.id, card: card.id };
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", card.id);
        };
        item.ondragend = () => {
          dragging = null;
          document
            .querySelectorAll(".drag-over")
            .forEach((x) => x.classList.remove("drag-over"));
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
          moveCard(list.id, card.id);
        };
        column.append(item);
      });
    const add = el("button", "add-card", "+ Add a task");
    add.onclick = () => editCard(list);
    column.append(add);
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
      moveCard(list.id);
    };
    $("#board").append(column);
  });
  const overview = $("#overview");
  overview.replaceChildren(
    el("h3", "", "About this project"),
    el("p", "", p.description || "Add a description in Project details."),
  );
  overview.append(el("h3", "", "Resources & links"));
  const lines = p.links
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!lines.length)
    overview.append(el("p", "muted", "Add useful links in Project details."));
  lines.forEach((link) => {
    try {
      const u = new URL(link);
      if (!["http:", "https:"].includes(u.protocol)) throw Error();
      const a = el("a", "", link + " ↗");
      a.href = u.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      overview.append(a);
    } catch {
      overview.append(el("p", "", link));
    }
  });
}
function moveCard(targetId, beforeId) {
  if (!dragging) return;
  const from = dragging;
  dragging = null;
  change(() => {
    const p = project(),
      source = p.lists.find((l) => l.id === from.list),
      target = p.lists.find((l) => l.id === targetId);
    const i = source.cards.findIndex((c) => c.id === from.card);
    if (i < 0) return;
    if (beforeId === from.card) return;
    const [card] = source.cards.splice(i, 1);
    const at = target.cards.findIndex((c) => c.id === beforeId);
    target.cards.splice(at < 0 ? target.cards.length : at, 0, card);
  });
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
  options.forEach(([v, t]) => {
    const o = el("option", "", t);
    o.value = v;
    o.selected = v === value;
    s.append(o);
  });
  l.append(s);
  return l;
}
function openEditor(kind, title, fields, onSave, onDelete) {
  editing = { onSave, onDelete };
  $("#editor-kind").textContent = kind;
  $("#editor-title").textContent = title;
  $("#editor-fields").replaceChildren(...fields);
  $("#editor-error").textContent = "";
  $("#delete-item").hidden = !onDelete;
  $("#editor").showModal();
  const first = $("#editor-fields input");
  if (first) first.focus();
}
function editProject(existing) {
  const p = existing || { name: "", description: "", links: "" };
  const name = field("Project name", "name", p.name, "text", 160);
  name.querySelector("input").required = true;
  openEditor(
    "PROJECT DETAILS",
    existing ? "Make it your own." : "A new beginning.",
    [
      name,
      field("Description", "description", p.description, "textarea"),
      field(
        "Resources & links (one per line)",
        "links",
        p.links,
        "textarea",
        5000,
      ),
    ],
    async (fd) => {
      const value = {
        name: fd.get("name").trim(),
        description: fd.get("description"),
        links: fd.get("links"),
      };
      if (!value.name) throw Error("Enter a project name.");
      const key = existing?.id || id();
      const ok = await change(() => {
        if (existing) Object.assign(project(), value);
        else
          state.projects.push({
            id: key,
            ...value,
            lists: ["To do", "In progress", "Done"].map((name) => ({
              id: id(),
              name,
              cards: [],
            })),
          });
      });
      if (ok) selectProject(key);
      return ok;
    },
    existing
      ? () =>
          change(() => {
            state.projects = state.projects.filter((x) => x.id !== existing.id);
          })
      : null,
  );
}
function editList(list) {
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
        if (list) project().lists.find((x) => x.id === list.id).name = name;
        else project().lists.push({ id: id(), name, cards: [] });
      });
    },
    list
      ? () =>
          change(() => {
            project().lists = project().lists.filter((x) => x.id !== list.id);
          })
      : null,
  );
}
function editCard(list, existing) {
  const c = existing || {
    title: "",
    description: "",
    priority: "Medium",
    due: "",
    assignee: "",
    checklist: [],
  };
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
  const checklist = el("div", "checklist");
  checklist.append(el("h3", "small", "CHECKLIST"));
  const rows = el("div");
  function addCheck(item = { id: id(), text: "", done: false }) {
    const r = el("div", "check-row"),
      check = el("input"),
      text = el("input"),
      remove = el("button", "icon", "×");
    check.type = "checkbox";
    check.checked = item.done;
    check.setAttribute("aria-label", "Checklist item complete");
    text.type = "text";
    text.value = item.text;
    text.maxLength = 500;
    text.placeholder = "Checklist item";
    text.setAttribute("aria-label", "Checklist item text");
    r.dataset.id = item.id;
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove checklist item");
    remove.onclick = () => r.remove();
    r.append(check, text, remove);
    rows.append(r);
  }
  c.checklist.forEach(addCheck);
  const add = el("button", "add-card", "+ Add checklist item");
  add.type = "button";
  add.onclick = () => {
    if (rows.children.length < 100) addCheck();
  };
  checklist.append(rows, add);
  openEditor(
    "TASK DETAILS",
    existing ? "Keep things moving." : "What’s next?",
    [
      title,
      field("Description & notes", "description", c.description, "textarea"),
      row,
      field("Assignee", "assignee", c.assignee, "text", 150),
      select(
        "List",
        "list",
        list.id,
        project().lists.map((l) => [l.id, l.name]),
      ),
      checklist,
    ],
    (fd) => {
      const value = {
        id: existing?.id || id(),
        title: fd.get("title").trim(),
        description: fd.get("description"),
        priority: fd.get("priority"),
        due: fd.get("due"),
        assignee: fd.get("assignee"),
        checklist: Array.from(rows.children)
          .map((r) => ({
            id: r.dataset.id,
            text: r.querySelector("input[type=text]").value.trim(),
            done: r.querySelector("input[type=checkbox]").checked,
          }))
          .filter((x) => x.text),
      };
      if (!value.title) throw Error("Enter a task title.");
      return change(() => {
        const source = project().lists.find((l) => l.id === list.id),
          target = project().lists.find((l) => l.id === fd.get("list"));
        const at = existing
          ? source.cards.findIndex((x) => x.id === existing.id)
          : -1;
        if (existing)
          source.cards = source.cards.filter((x) => x.id !== existing.id);
        if (source === target && at >= 0) target.cards.splice(at, 0, value);
        else target.cards.push(value);
      });
    },
    existing
      ? () =>
          change(() => {
            const source = project().lists.find((l) => l.id === list.id);
            source.cards = source.cards.filter((x) => x.id !== existing.id);
          })
      : null,
  );
}
$("#editor-form").onsubmit = async (e) => {
  e.preventDefault();
  const save = e.submitter;
  save.disabled = true;
  try {
    if (await editing.onSave(new FormData(e.target))) $("#editor").close();
  } catch (err) {
    $("#editor-error").textContent = err.message;
  } finally {
    save.disabled = false;
  }
};
$("#delete-item").onclick = async () => {
  if (
    !confirm(
      "Delete this item and everything inside it? This cannot be undone.",
    )
  )
    return;
  $("#delete-item").disabled = true;
  try {
    if (await editing.onDelete()) $("#editor").close();
  } finally {
    $("#delete-item").disabled = false;
  }
};
$("#close-editor").onclick = $("#cancel-editor").onclick = () =>
  $("#editor").close();
$("#new-project").onclick = $("#first-project").onclick = () => editProject();
$("#project-settings").onclick = () => editProject(project());
$("#add-list").onclick = () => editList();
$("#search").oninput = render;
$("#board-tab").onclick = () => {
  view = "board";
  render();
};
$("#info-tab").onclick = () => {
  view = "info";
  render();
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
    $("#app-error").textContent = e.message;
  }
};
api("/api/workspace")
  .then((data) => {
    state = data;
    render();
  })
  .catch((e) => {
    $("#app-error").textContent = e.message;
  });
