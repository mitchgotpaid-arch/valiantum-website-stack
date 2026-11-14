const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../public/model");
const legacy = () => ({
  revision: 4,
  projects: [
    {
      id: "p",
      name: "Existing project",
      description: "Keep these notes",
      links: "https://valiantum.com",
      lists: [
        {
          id: "todo",
          name: "To do",
          cards: [
            {
              id: "task",
              title: "Existing task",
              description: "Original text",
              assignee: "Me",
              priority: "High",
              due: "2026-11-13",
              checklist: [
                { id: "check", text: "Existing checklist", done: true },
              ],
            },
          ],
        },
        {
          id: "done",
          name: "Done",
          cards: [
            {
              id: "finished",
              title: "Finished",
              description: "",
              assignee: "",
              priority: "Low",
              due: "",
              checklist: [],
            },
          ],
        },
      ],
    },
  ],
});
test("legacy workspaces upgrade without losing existing project, task or checklist data", () => {
  const raw = legacy(),
    data = M.normalizeWorkspace(raw);
  assert.ok(M.validWorkspace(data));
  assert.equal(data.revision, 4);
  assert.equal(data.projects[0].description, "Keep these notes");
  assert.equal(data.projects[0].lists[0].cards[0].description, "Original text");
  assert.equal(data.projects[0].lists[0].cards[0].checklist[0].done, true);
  assert.equal(data.projects[0].lists[1].cards[0].completed, true);
  assert.deepEqual(data.notes, []);
  assert.equal(raw.schemaVersion, undefined);
});
test("calendar recurrence handles year boundaries, leap years, monthly anchors, and missing dates", () => {
  assert.equal(M.nextDate("2026-12-31", "daily"), "2027-01-01");
  assert.equal(M.nextDate("2026-12-28", "weekly"), "2027-01-04");
  assert.equal(M.nextDate("2027-01-31", "monthly"), "2027-02-28");
  assert.equal(M.nextDate("2028-01-31", "monthly"), "2028-02-29");
  assert.equal(
    M.nextDate("2027-02-28", "monthly", "2027-01-01", 31),
    "2027-03-31",
  );
  assert.equal(M.nextDate("", "weekly", "2026-11-13"), "2026-11-20");
  assert.equal(M.validDate("2026-02-30"), false);
});
test("completion spawns one next occurrence, clears checklist progress and does not duplicate after reopen", () => {
  const data = M.normalizeWorkspace(legacy()),
    p = data.projects[0],
    l = p.lists[0],
    c = l.cards[0];
  c.repeat = "monthly";
  c.due = "2027-01-31";
  c.repeatDay = 31;
  let n = 0;
  const makeId = () => `generated-${++n}`;
  const next = M.completeTask(p, l, c, "2027-01-31", makeId);
  assert.equal(c.completed, true);
  assert.equal(next.due, "2027-02-28");
  assert.equal(next.checklist[0].done, false);
  assert.notEqual(next.id, c.id);
  assert.equal(next.repeatDay, 31);
  assert.equal(M.completeTask(p, l, c), null);
  c.completed = false;
  assert.equal(M.completeTask(p, l, c), null);
  assert.equal(l.cards.length, 2);
  M.completeTask(p, l, next, "2027-02-28", makeId);
  assert.equal(l.cards[2].due, "2027-03-31");
  assert.ok(M.validWorkspace(data));
});
test("template use creates new IDs, preserves milestone links and resets dates, recurrence history and progress", () => {
  const data = M.normalizeWorkspace(legacy()),
    p = data.projects[0],
    c = p.lists[0].cards[0];
  p.milestones.push({
    id: "m",
    title: "Launch",
    description: "Ship it",
    due: "2026-12-01",
    completed: true,
    archived: false,
  });
  c.milestoneId = "m";
  c.nextOccurrenceId = "old-next";
  c.completed = true;
  c.repeat = "weekly";
  const clone = M.projectFromTemplate(p, "New launch");
  assert.notEqual(clone.id, p.id);
  assert.equal(clone.milestones[0].due, "");
  const copy = clone.lists[0].cards[0];
  assert.equal(copy.completed, false);
  assert.equal(copy.due, "");
  assert.equal(copy.nextOccurrenceId, "");
  assert.equal(copy.repeat, "weekly");
  assert.equal(copy.milestoneId, clone.milestones[0].id);
  assert.notEqual(copy.checklist[0].id, c.checklist[0].id);
  assert.equal(copy.checklist[0].done, false);
  data.projects.push(clone);
  assert.ok(M.validWorkspace(data));
});
test("archived parents and tasks disappear from focus views and restore with all content intact", () => {
  const data = M.normalizeWorkspace(legacy());
  assert.equal(M.activeTasks(data).length, 2);
  data.projects[0].lists[0].cards[0].archived = true;
  assert.equal(M.activeTasks(data).length, 1);
  data.projects[0].archived = true;
  assert.equal(M.activeTasks(data).length, 0);
  data.projects[0].archived = false;
  data.projects[0].lists[0].cards[0].archived = false;
  assert.equal(M.activeTasks(data).length, 2);
  assert.equal(data.projects[0].lists[0].cards[0].description, "Original text");
});
test("rejects malformed new features, duplicate IDs and orphan milestone/note references", () => {
  const valid = M.normalizeWorkspace(legacy());
  assert.ok(M.validWorkspace(valid));
  for (const mutate of [
    (d) => (d.projects[0].lists[0].cards[0].repeat = "hourly"),
    (d) => (d.projects[0].lists[0].cards[0].milestoneId = "missing"),
    (d) => (d.projects[0].lists[1].id = "todo"),
    (d) =>
      d.notes.push({
        id: "n",
        title: "Idea",
        body: "",
        projectId: "missing",
        pinned: false,
        archived: false,
        createdAt: 1,
        updatedAt: 1,
      }),
  ]) {
    const data = M.copy(valid);
    mutate(data);
    assert.equal(M.validWorkspace(data), false);
  }
});

test("card stages persist and new recurring/template cards start in Plan", () => {
  const data = M.normalizeWorkspace(legacy());
  const project = data.projects[0],
    list = project.lists[0],
    card = list.cards[0];
  assert.equal(M.taskStatus(card), "plan");
  card.inMotion = true;
  assert.equal(M.taskStatus(card), "in-motion");
  assert.ok(M.validWorkspace(data));
  assert.equal(
    M.taskStatus(
      M.normalizeWorkspace(JSON.parse(JSON.stringify(data))).projects[0]
        .lists[0].cards[0],
    ),
    "in-motion",
  );
  const templateCopy = M.projectFromTemplate(project, "Fresh project");
  assert.equal(M.taskStatus(templateCopy.lists[0].cards[0]), "plan");
  card.repeat = "weekly";
  const next = M.completeTask(project, list, card, "2026-11-14");
  assert.equal(M.taskStatus(card), "completed");
  assert.equal(card.inMotion, false);
  assert.equal(M.taskStatus(next), "plan");
  card.completed = false;
  assert.equal(M.taskStatus(card), "open");
  next.inMotion = "invalid";
  assert.equal(M.validWorkspace(data), false);
});

test("workflow completion leaves active categories, preserves history and reopens without loss", () => {
  const data = M.normalizeWorkspace(legacy()),
    p = data.projects[0],
    l = p.lists[0],
    card = l.cards[0];
  const original = card.description;
  assert.equal(M.taskStatus(card), "plan");
  M.setStage(p, l, card, "open");
  assert.equal(M.taskStatus(card), "open");
  M.setStage(p, l, card, "in-motion");
  assert.equal(M.taskStatus(card), "in-motion");
  M.setStage(p, l, card, "completed");
  assert.equal(
    M.workflowCards(p)
      .filter((e) => !e.card.completed)
      .some((e) => e.card.id === card.id),
    false,
  );
  const history = M.workflowCards(p).filter((e) => e.card.completed);
  assert.ok(history.some((e) => e.card.id === card.id));
  assert.ok(card.completedAt > 0);
  const persisted = M.normalizeWorkspace(JSON.parse(JSON.stringify(data)));
  assert.ok(
    M.workflowCards(persisted.projects[0]).some(
      (e) => e.card.id === card.id && e.card.completed,
    ),
  );
  M.setStage(p, l, card, "plan");
  assert.equal(M.taskStatus(card), "plan");
  assert.equal(card.description, original);
  assert.equal(card.completedAt, 0);
  assert.ok(M.validWorkspace(data));
});
