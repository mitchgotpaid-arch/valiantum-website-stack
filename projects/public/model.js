(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ValiantumModel = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const uuid = () => crypto.randomUUID();
  const copy = (value) => structuredClone(value);
  const localDay = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function validDate(value) {
    if (value === "") return true;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return false;
    const date = new Date(value + "T12:00:00Z");
    return !isNaN(date) && date.toISOString().slice(0, 10) === value;
  }
  function nextDate(due, repeat, today = localDay(), anchorDay) {
    const base = due || today;
    if (!validDate(base) || !base) throw Error("Choose a valid due date.");
    const date = new Date(base + "T12:00:00Z");
    if (repeat === "monthly") {
      const wanted = anchorDay || date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + 1);
      const last = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
      ).getUTCDate();
      date.setUTCDate(Math.min(wanted, last));
    } else if (repeat === "daily" || repeat === "weekly")
      date.setUTCDate(date.getUTCDate() + (repeat === "weekly" ? 7 : 1));
    else throw Error("Choose a recurrence.");
    return date.toISOString().slice(0, 10);
  }
  function normalizeWorkspace(input) {
    const data = copy(input);
    data.schemaVersion = 2;
    data.notes ||= [];
    data.templates ||= [];
    const normalizeProject = (p) => {
      p.archived ??= false;
      p.milestones ||= [];
      for (const m of p.milestones) {
        m.completed ??= false;
        m.archived ??= false;
      }
      for (const l of p.lists || []) {
        l.archived ??= false;
        for (const c of l.cards || []) {
          c.archived ??= false;
          c.completed ??= /^(done|complete|completed)$/i.test(l.name.trim());
          c.repeat ||= "none";
          c.repeatDay ??= c.due ? Number(c.due.slice(-2)) : 0;
          c.milestoneId ||= "";
          c.nextOccurrenceId ||= "";
        }
      }
    };
    for (const p of data.projects || []) normalizeProject(p);
    for (const p of data.templates || []) normalizeProject(p);
    return data;
  }
  function validWorkspace(data) {
    const text = (x, n) => typeof x === "string" && x.length <= n;
    const bool = (x) => typeof x === "boolean";
    if (
      data.schemaVersion !== 2 ||
      !Array.isArray(data.projects) ||
      data.projects.length > 100 ||
      !Array.isArray(data.templates) ||
      data.templates.length > 100 ||
      !Array.isArray(data.notes) ||
      data.notes.length > 1000
    )
      return false;
    const ids = new Set();
    const id = (x) =>
      text(x, 80) && x.length > 0 && !ids.has(x) && !!ids.add(x);
    const project = (p) => {
      if (
        !p ||
        !id(p.id) ||
        !text(p.name, 160) ||
        !p.name.trim() ||
        !text(p.description, 10000) ||
        !text(p.links, 5000) ||
        !bool(p.archived) ||
        !Array.isArray(p.milestones) ||
        p.milestones.length > 100 ||
        !Array.isArray(p.lists) ||
        p.lists.length > 30
      )
        return false;
      const milestones = new Set(p.milestones.map((m) => m.id));
      return (
        p.milestones.every(
          (m) =>
            m &&
            id(m.id) &&
            text(m.title, 160) &&
            m.title.trim() &&
            text(m.description, 5000) &&
            validDate(m.due) &&
            bool(m.completed) &&
            bool(m.archived),
        ) &&
        p.lists.every(
          (l) =>
            l &&
            id(l.id) &&
            text(l.name, 100) &&
            l.name.trim() &&
            bool(l.archived) &&
            Array.isArray(l.cards) &&
            l.cards.length <= 500 &&
            l.cards.every(
              (c) =>
                c &&
                id(c.id) &&
                text(c.title, 300) &&
                c.title.trim() &&
                text(c.description, 10000) &&
                text(c.assignee, 150) &&
                validDate(c.due) &&
                ["Low", "Medium", "High"].includes(c.priority) &&
                bool(c.completed) &&
                bool(c.archived) &&
                ["none", "daily", "weekly", "monthly"].includes(c.repeat) &&
                Number.isInteger(c.repeatDay) &&
                c.repeatDay >= 0 &&
                c.repeatDay <= 31 &&
                text(c.nextOccurrenceId, 80) &&
                text(c.milestoneId, 80) &&
                (!c.milestoneId || milestones.has(c.milestoneId)) &&
                Array.isArray(c.checklist) &&
                c.checklist.length <= 100 &&
                c.checklist.every(
                  (i) => i && id(i.id) && text(i.text, 500) && bool(i.done),
                ),
            ),
        )
      );
    };
    return (
      data.projects.every(project) &&
      data.templates.every(project) &&
      data.notes.every(
        (n) =>
          n &&
          id(n.id) &&
          text(n.title, 300) &&
          n.title.trim() &&
          text(n.body, 20000) &&
          text(n.projectId, 80) &&
          (!n.projectId || data.projects.some((p) => p.id === n.projectId)) &&
          bool(n.pinned) &&
          bool(n.archived) &&
          Number.isSafeInteger(n.createdAt) &&
          Number.isSafeInteger(n.updatedAt) &&
          n.createdAt >= 0 &&
          n.updatedAt >= n.createdAt,
      )
    );
  }
  function task(values = {}, makeId = uuid) {
    return {
      id: makeId(),
      title: "",
      description: "",
      assignee: "",
      due: "",
      priority: "Medium",
      checklist: [],
      completed: false,
      archived: false,
      repeat: "none",
      repeatDay: 0,
      milestoneId: "",
      nextOccurrenceId: "",
      ...values,
    };
  }
  function projectFromTemplate(template, name, makeId = uuid) {
    const p = {
      id: makeId(),
      name,
      description: template?.description || "",
      links: template?.links || "",
      archived: false,
      milestones: [],
      lists: [],
    };
    const milestoneIds = new Map();
    for (const m of template?.milestones || [])
      if (!m.archived) {
        const key = makeId();
        milestoneIds.set(m.id, key);
        p.milestones.push({
          ...copy(m),
          id: key,
          due: "",
          completed: false,
          archived: false,
        });
      }
    for (const l of template?.lists || [
      { name: "To do", cards: [] },
      { name: "In progress", cards: [] },
      { name: "Done", cards: [] },
    ])
      if (!l.archived)
        p.lists.push({
          id: makeId(),
          name: l.name,
          archived: false,
          cards: l.cards
            .filter((c) => !c.archived)
            .map((c) =>
              task(
                {
                  ...copy(c),
                  id: makeId(),
                  due: "",
                  completed: false,
                  archived: false,
                  repeatDay: 0,
                  nextOccurrenceId: "",
                  milestoneId: milestoneIds.get(c.milestoneId) || "",
                  checklist: c.checklist.map((i) => ({
                    ...i,
                    id: makeId(),
                    done: false,
                  })),
                },
                makeId,
              ),
            ),
        });
    return p;
  }
  function completeTask(
    project,
    list,
    card,
    today = localDay(),
    makeId = uuid,
  ) {
    if (card.completed) return null;
    card.completed = true;
    if (card.repeat === "none" || card.nextOccurrenceId) return null;
    const anchor =
      card.repeatDay ||
      (card.due ? Number(card.due.slice(-2)) : Number(today.slice(-2)));
    const next = task(
      {
        ...copy(card),
        id: makeId(),
        completed: false,
        archived: false,
        nextOccurrenceId: "",
        due: nextDate(card.due, card.repeat, today, anchor),
        repeatDay: anchor,
        checklist: card.checklist.map((i) => ({
          ...i,
          id: makeId(),
          done: false,
        })),
      },
      makeId,
    );
    const target =
      project.lists.find(
        (l) =>
          !l.archived && !/^(done|complete|completed)$/i.test(l.name.trim()),
      ) || list;
    target.cards.push(next);
    card.nextOccurrenceId = next.id;
    return next;
  }
  function activeTasks(data) {
    return data.projects
      .filter((p) => !p.archived)
      .flatMap((project) =>
        project.lists
          .filter((l) => !l.archived)
          .flatMap((list) =>
            list.cards
              .filter((c) => !c.archived)
              .map((card) => ({ project, list, card })),
          ),
      );
  }
  function builtins() {
    return [
      {
        id: "blank",
        name: "Blank project",
        description: "",
        links: "",
        lists: [
          { name: "To do", cards: [] },
          { name: "In progress", cards: [] },
          { name: "Done", cards: [] },
        ],
      },
      {
        id: "launch",
        name: "Product launch",
        description: "Plan, build, and launch your next product or release.",
        links: "",
        lists: [
          {
            name: "Plan",
            cards: [
              task({ title: "Define the goal and launch scope" }),
              task({ title: "Write the launch checklist" }),
            ],
          },
          {
            name: "Build",
            cards: [task({ title: "Build and test the release" })],
          },
          {
            name: "Launch",
            cards: [
              task({ title: "Publish and announce" }),
              task({ title: "Review launch results" }),
            ],
          },
        ],
      },
      {
        id: "content",
        name: "Content workflow",
        description: "Capture, produce, and publish content for your brand.",
        links: "",
        lists: [
          {
            name: "Ideas",
            cards: [task({ title: "Brainstorm next week’s topics" })],
          },
          {
            name: "Drafting",
            cards: [
              task({
                title: "Draft a post",
                checklist: [
                  { id: uuid(), text: "Write the hook", done: false },
                  {
                    id: uuid(),
                    text: "Add a clear call to action",
                    done: false,
                  },
                ],
              }),
            ],
          },
          { name: "Ready to publish", cards: [] },
          { name: "Published", cards: [] },
        ],
      },
    ];
  }
  return {
    copy,
    localDay,
    validDate,
    nextDate,
    normalizeWorkspace,
    validWorkspace,
    task,
    projectFromTemplate,
    completeTask,
    activeTasks,
    builtins,
  };
});
