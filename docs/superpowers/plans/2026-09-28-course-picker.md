# Course Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the starter guestbook with a one-page ANU course picker: search, tick many courses, enrol in all of them with one button, drop any, and have it persist across reloads.

**Architecture:** Server-rendered Astro page backed by Drizzle + SQLite. One HTML form carries every course as a checkbox; a small inline script filters cards by hiding them (so ticks survive searching) and updates a tray counter. `POST /api/enrol` takes repeated `code` fields and inserts them in one statement; `POST /api/drop` removes one. Both answer 303 to `/`, so the page works with no JavaScript.

**Tech Stack:** Astro 7 (server output, `@astrojs/node`), Drizzle ORM 0.45 + better-sqlite3, drizzle-kit migrations, Vitest + jsdom against the built server, Fly.io.

**Spec:** `docs/superpowers/specs/2026-09-28-course-picker-design.md`

## Global Constraints

- Deploy target: `comp4020-crit7-fiardiel.fly.dev`, live by the cutoff 2026-09-28 12:00 (Canberra).
- Run everything through mise: `mise exec -- pnpm …`, `mise exec -- flyctl …`.
- Schema changes go through `src/lib/schema.ts` → `pnpm db:generate` → committed migration in `drizzle/`. Never edit the database by hand.
- Keep `spec/invariants.test.ts` and `spec/readme.test.ts` untouched and green. Every page route is listed in `spec/routes.ts`.
- Single anonymous student: no login, programs, clashes, prerequisites, semesters or capacity.
- Unit warning threshold: enrolled total above 24 units, non-blocking.
- All forms POST with a 303 back to `/` (Astro requires a same-origin `Origin` header on form POSTs; tests send `origin: baseUrl`).
- `pnpm check` must be green before every commit that claims a task done.
- The repo stays private; no `gh repo edit --visibility`, that belongs to the ship step.

## Review Focus

1. **Enrol with nothing ticked** — submitting an empty form redirects back with no error and no change. Pinned in Task 1.
2. **Forged or unknown course code** (`code=FAKE9999`) — silently skipped, never shown as enrolled. Pinned in Task 1.
3. **Same code twice in one request** (`code=COMP1100&code=COMP1100`) — exactly one enrolment. Pinned in Task 1.
4. **Messy code input** (` comp1100 `) — trimmed and upper-cased before matching. Pinned in Task 1.
5. **Dropping a course you're not enrolled in** — redirects back with no error. Pinned in Task 1.

---

## File map

- `src/lib/schema.ts` — `courses` and `enrolments` tables (replaces `messages`).
- `src/lib/db.ts` — connection + migrate (unchanged part) and the query functions `listCourses`, `listEnrolments`, `enrol`, `drop`.
- `drizzle/0001_*.sql` — drop `messages`. `drizzle/0002_*.sql` — create tables. `drizzle/0003_seed_courses.sql` — seed data.
- `src/pages/api/enrol.ts`, `src/pages/api/drop.ts` — the two write routes.
- `src/pages/index.astro` — the picker page.
- `src/styles.css` — layout for the roomy grid and sticky tray.
- `spec/enrolment.test.ts` — your contract tests.
- Deleted: `src/pages/api/messages.ts`, `src/pages/api/events.ts`, `src/lib/events.ts`, `spec/guestbook.test.ts`.

---

### Task 1: Data, write routes and a bare page (tests first, then deploy)

**Files:**
- Create: `spec/enrolment.test.ts`, `src/pages/api/enrol.ts`, `src/pages/api/drop.ts`, three migrations under `drizzle/`
- Modify: `src/lib/schema.ts`, `src/lib/db.ts`, `src/pages/index.astro`
- Delete: `src/pages/api/messages.ts`, `src/pages/api/events.ts`, `src/lib/events.ts`, `spec/guestbook.test.ts`

**Interfaces:**
- Produces (`src/lib/db.ts`):
  - `listCourses(): Course[]` ordered by code
  - `listEnrolments(): Enrolment[]` — each `{ code, title, units, enrolledAt }`, ordered by code
  - `enrol(codes: string[]): number` — rows inserted
  - `drop(code: string): void`
  - types `Course = typeof courses.$inferSelect`, `Enrolment = { code: string; title: string; units: number; enrolledAt: string }`
- Produces (HTML contract, used by tests and Task 2): the page has a `<section id="enrolled">` whose items carry `data-code="<CODE>"`, and each course card is `<li class="course" data-code="<CODE>">`.

- [ ] **Step 1: Write the failing tests**

Create `spec/enrolment.test.ts`:

```ts
import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The week's contract: pick many courses, enrol in all of them with one
// request, and they're still enrolled after a reload. Drives the running app
// over HTTP, so it checks what ships, not how it's built.
const baseUrl = inject("baseUrl");

const post = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body,
    redirect: "manual",
  });

const enrolIn = (...codes: string[]) =>
  post("/api/enrol", new URLSearchParams(codes.map((code) => ["code", code])));

async function enrolledCodes(): Promise<string[]> {
  const html = await (await fetch(baseUrl)).text();
  const doc = new JSDOM(html).window.document;
  return [...doc.querySelectorAll("#enrolled [data-code]")].map(
    (el) => el.getAttribute("data-code") ?? "",
  );
}

describe("enrolment", () => {
  it("enrols in several courses with one request, and they survive a reload", async () => {
    const res = await enrolIn("COMP1100", "COMP1600", "MATH1013");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
    expect(await enrolledCodes()).toEqual(
      expect.arrayContaining(["COMP1100", "COMP1600", "MATH1013"]),
    );
  });

  it("enrolling again in a course leaves exactly one enrolment", async () => {
    await enrolIn("COMP2100");
    await enrolIn("COMP2100");
    const codes = await enrolledCodes();
    expect(codes.filter((c) => c === "COMP2100")).toHaveLength(1);
  });

  it("drops a course", async () => {
    await enrolIn("COMP2400");
    const res = await post("/api/drop", new URLSearchParams({ code: "COMP2400" }));
    expect(res.status).toBe(303);
    expect(await enrolledCodes()).not.toContain("COMP2400");
  });

  it("an empty submission changes nothing", async () => {
    const before = await enrolledCodes();
    const res = await post("/api/enrol", new URLSearchParams());
    expect(res.status).toBe(303);
    expect(await enrolledCodes()).toEqual(before);
  });

  it("ignores codes that aren't real courses", async () => {
    const res = await enrolIn("FAKE9999");
    expect(res.status).toBe(303);
    expect(await enrolledCodes()).not.toContain("FAKE9999");
  });

  it("the same code twice in one request is one enrolment", async () => {
    await enrolIn("COMP2310", "COMP2310");
    const codes = await enrolledCodes();
    expect(codes.filter((c) => c === "COMP2310")).toHaveLength(1);
  });

  it("normalises messy codes", async () => {
    await enrolIn(" comp3600 ");
    expect(await enrolledCodes()).toContain("COMP3600");
  });

  it("dropping a course you aren't enrolled in is harmless", async () => {
    const res = await post("/api/drop", new URLSearchParams({ code: "COMP4300" }));
    expect(res.status).toBe(303);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `mise exec -- pnpm test`
Expected: the `enrolment` tests FAIL (404 from `/api/enrol`, no `#enrolled`); guestbook, invariants and readme still pass.

- [ ] **Step 3: Remove the guestbook**

```sh
git rm spec/guestbook.test.ts src/pages/api/messages.ts src/pages/api/events.ts src/lib/events.ts
```

- [ ] **Step 4: Migration 1 — drop `messages`**

Replace `src/lib/schema.ts` with only the header comment and the imports it needs (no tables yet):

```ts
// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
export {};
```

Run: `mise exec -- pnpm db:generate --name drop_guestbook`
Expected: `drizzle/0001_drop_guestbook.sql` containing `DROP TABLE \`messages\`;`

(Doing the drop on its own avoids drizzle-kit's interactive "renamed from messages?" prompt.)

- [ ] **Step 5: Migration 2 — create `courses` and `enrolments`**

Replace `src/lib/schema.ts` body (keep the header comment):

```ts
import { sql } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

// (header comment as above)
export const courses = sqliteTable("courses", {
  code: text().primaryKey(),
  title: text().notNull(),
  units: int().notNull(),
  description: text().notNull(),
});

export const enrolments = sqliteTable("enrolments", {
  id: int().primaryKey({ autoIncrement: true }),
  courseCode: text("course_code")
    .notNull()
    .unique()
    .references(() => courses.code),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Course = typeof courses.$inferSelect;
```

Run: `mise exec -- pnpm db:generate --name courses_and_enrolments`
Expected: `drizzle/0002_courses_and_enrolments.sql` with two `CREATE TABLE`s and a unique index on `course_code`.

- [ ] **Step 6: Migration 3 — seed courses**

Run: `mise exec -- pnpm db:generate --custom --name seed_courses`
Then fill `drizzle/0003_seed_courses.sql` (the student verifies titles/units against Programs and Courses before the crit):

```sql
INSERT INTO `courses` (`code`, `title`, `units`, `description`) VALUES
('COMP1100', 'Programming as Problem Solving', 6, 'Functional programming in Haskell as a way to think about problems.'),
('COMP1110', 'Structured Programming', 6, 'Object-oriented programming, data structures and testing in Java.'),
('COMP1600', 'Foundations of Computing', 6, 'Logic, proof, automata and the mathematics behind programs.'),
('COMP2100', 'Software Design Methodologies', 6, 'Designing larger programs: patterns, abstraction and structure.'),
('COMP2120', 'Software Engineering', 6, 'Working as a team on a real software project.'),
('COMP2300', 'Computer Organisation and Program Execution', 6, 'How programs run on hardware, from assembly up.'),
('COMP2310', 'Systems, Networks and Concurrency', 6, 'Concurrent programs, operating systems and networks.'),
('COMP2400', 'Relational Databases', 6, 'Relational modelling, SQL and database design.'),
('COMP2420', 'Introduction to Data Management, Analysis and Security', 6, 'Working with data end to end, safely.'),
('COMP3310', 'Computer Networks', 6, 'Protocols and the design of the internet.'),
('COMP3425', 'Data Mining', 6, 'Finding patterns in large datasets.'),
('COMP3600', 'Algorithms', 6, 'Designing and analysing efficient algorithms.'),
('COMP3620', 'Artificial Intelligence', 6, 'Search, reasoning and planning for intelligent agents.'),
('COMP3670', 'Introduction to Machine Learning', 6, 'The mathematics and practice of learning from data.'),
('COMP3900', 'Human-Computer Interaction', 6, 'Designing and evaluating interfaces with people.'),
('COMP4020', 'Agentic Coding Studio', 6, 'Building software by directing coding agents, crit by crit.'),
('COMP4300', 'Parallel Systems', 6, 'Programming many processors at once.'),
('MATH1013', 'Mathematics and Applications 1', 6, 'Calculus and linear algebra for science and engineering.'),
('MATH1014', 'Mathematics and Applications 2', 6, 'Further calculus and linear algebra.'),
('STAT1003', 'Statistical Techniques', 6, 'Introductory statistics for analysing data.');
```

- [ ] **Step 7: Query functions**

In `src/lib/db.ts`, replace the imports of `desc`/`messages` and everything after `migrate(...)`:

```ts
import { asc, eq, inArray } from "drizzle-orm";
import { type Course, courses, enrolments } from "./schema";

// … (connection + migrate unchanged) …

export type { Course };
export type Enrolment = { code: string; title: string; units: number; enrolledAt: string };

export function listCourses(): Course[] {
  return db.select().from(courses).orderBy(asc(courses.code)).all();
}

export function listEnrolments(): Enrolment[] {
  return db
    .select({
      code: courses.code,
      title: courses.title,
      units: courses.units,
      enrolledAt: enrolments.createdAt,
    })
    .from(enrolments)
    .innerJoin(courses, eq(enrolments.courseCode, courses.code))
    .orderBy(asc(courses.code))
    .all();
}

// Enrols in every real course among `codes` in one statement. Codes are
// normalised, de-duplicated and checked against the catalogue; courses
// already enrolled are skipped rather than erroring.
export function enrol(codes: string[]): number {
  const wanted = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (wanted.length === 0) return 0;
  const known = db
    .select({ code: courses.code })
    .from(courses)
    .where(inArray(courses.code, wanted))
    .all();
  if (known.length === 0) return 0;
  return db
    .insert(enrolments)
    .values(known.map(({ code }) => ({ courseCode: code })))
    .onConflictDoNothing()
    .run().changes;
}

export function drop(code: string): void {
  db.delete(enrolments).where(eq(enrolments.courseCode, code.trim().toUpperCase())).run();
}
```

- [ ] **Step 8: Write routes**

`src/pages/api/enrol.ts`:

```ts
import type { APIRoute } from "astro";
import { enrol } from "../../lib/db";

// The whole point of the app: every ticked course arrives in one request as
// repeated `code` fields and is enrolled in one go. The 303 re-renders the
// page from SQLite, so it works with no client-side JavaScript.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  enrol(form.getAll("code").map(String));
  return redirect("/", 303);
};
```

`src/pages/api/drop.ts`:

```ts
import type { APIRoute } from "astro";
import { drop } from "../../lib/db";

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  drop(String(form.get("code") ?? ""));
  return redirect("/", 303);
};
```

- [ ] **Step 9: Bare page**

Replace `src/pages/index.astro`:

```astro
---
import { listCourses, listEnrolments } from "../lib/db";
import "../styles.css";

const courses = listCourses();
const enrolled = listEnrolments();
const enrolledCodes = new Set(enrolled.map((e) => e.code));
---

<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pick your courses · ANU course picker</title>
  </head>
  <body>
    <nav aria-label="site">
      <a href="/">Courses</a>
      <a href="/readme/">About</a>
    </nav>
    <main>
      <h1>Pick your courses</h1>
      <form method="post" action="/api/enrol">
        <ul>
          {courses.map((c) => (
            <li class="course" data-code={c.code}>
              <label>
                <input type="checkbox" name="code" value={c.code} disabled={enrolledCodes.has(c.code)} />
                {c.code} {c.title} ({c.units} units)
              </label>
            </li>
          ))}
        </ul>
        <button>Enrol in all</button>
      </form>
      <section id="enrolled" aria-labelledby="enrolled-heading">
        <h2 id="enrolled-heading">My enrolments</h2>
        <ul>
          {enrolled.map((e) => (
            <li data-code={e.code}>
              {e.code} {e.title}
              <form method="post" action="/api/drop">
                <input type="hidden" name="code" value={e.code} />
                <button aria-label={`Drop ${e.code}`}>Drop</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  </body>
</html>
```

In `src/pages/readme.astro`, change the nav link text `Guestbook` → `Courses`.

- [ ] **Step 10: Run to verify they pass**

Run: `mise exec -- pnpm check`
Expected: typecheck clean; `enrolment` (8), `invariants` and `readme` all PASS.

- [ ] **Step 11: Commit**

```sh
git add -A
git commit -m "feat: batch-enrol course picker replaces the guestbook"
```

- [ ] **Step 12: Deploy early and check it live**

Run: `mise exec -- flyctl deploy --remote-only --ha=false -a comp4020-crit7-fiardiel`
Then: `curl -s https://comp4020-crit7-fiardiel.fly.dev/ | grep -c 'class="course"'`
Expected: `20`. Tick two courses in a browser, enrol, reload — both listed.

---

### Task 2: The roomy picker — search, card grid, sticky tray, unit warning

**Files:**
- Modify: `src/pages/index.astro`, `src/styles.css`, `spec/enrolment.test.ts`

**Interfaces:**
- Consumes: `listCourses`, `listEnrolments`, `Course`, `Enrolment` from Task 1; the `#enrolled [data-code]` and `.course[data-code]` HTML contract (keep both).

- [ ] **Step 1: Write the failing tests**

Append to `spec/enrolment.test.ts`:

```ts
describe("picker page", () => {
  const page = async () =>
    new JSDOM(await (await fetch(baseUrl)).text()).window.document;

  it("has a labelled search box", async () => {
    const doc = await page();
    const search = doc.querySelector<HTMLInputElement>("input#search");
    expect(search?.type).toBe("search");
    expect(doc.querySelector('label[for="search"]')).not.toBeNull();
  });

  it("marks enrolled courses so they can't be picked again", async () => {
    await enrolIn("COMP3900");
    const doc = await page();
    const box = doc.querySelector<HTMLInputElement>('.course[data-code="COMP3900"] input');
    expect(box?.disabled).toBe(true);
  });

  it("warns, without blocking, when enrolled above 24 units", async () => {
    await enrolIn("COMP3310", "COMP3425", "COMP3620", "COMP3670", "COMP4020");
    const doc = await page();
    expect(doc.querySelector("#load-warning")?.textContent).toMatch(/24 units/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `mise exec -- pnpm test`
Expected: "has a labelled search box" and "warns…" FAIL; "marks enrolled courses" PASSES already (Task 1 disables them) — keep it as a guard.

- [ ] **Step 3: Full page**

Replace the `<main>` of `src/pages/index.astro` and add the script; frontmatter gains the totals:

```astro
---
import { listCourses, listEnrolments } from "../lib/db";
import "../styles.css";

const FULL_LOAD = 24;
const courses = listCourses();
const enrolled = listEnrolments();
const enrolledCodes = new Set(enrolled.map((e) => e.code));
const enrolledUnits = enrolled.reduce((sum, e) => sum + e.units, 0);
---
```

```astro
    <main>
      <h1>Pick your courses</h1>
      <p class="lede">Search, tick as many as you like, then enrol in all of them at once.</p>

      <form method="post" action="/api/enrol" id="picker">
        <div class="search">
          <label for="search">Search by code or title</label>
          <input type="search" id="search" placeholder="e.g. COMP2 or databases" autocomplete="off" />
        </div>

        <ul class="courses">
          {courses.map((c) => {
            const done = enrolledCodes.has(c.code);
            return (
              <li class="course" data-code={c.code} data-search={`${c.code} ${c.title}`.toLowerCase()}>
                <label>
                  <input type="checkbox" name="code" value={c.code} data-units={c.units} disabled={done} />
                  <span class="code">{c.code}</span>
                  <span class="title">{c.title}</span>
                  <span class="meta">{c.units} units{done && " · enrolled"}</span>
                  <span class="desc">{c.description}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <p id="no-match" hidden>No courses match that search.</p>

        <div class="tray">
          <p id="selected" aria-live="polite">Tick courses to add them here.</p>
          <button>Enrol in all</button>
        </div>
      </form>

      <section id="enrolled" aria-labelledby="enrolled-heading">
        <h2 id="enrolled-heading">My enrolments · {enrolledUnits} units</h2>
        {enrolledUnits > FULL_LOAD && (
          <p id="load-warning" class="warn">
            That's more than a full-time load of {FULL_LOAD} units. You can still enrol, but check it's what you meant.
          </p>
        )}
        {enrolled.length === 0 ? (
          <p>Nothing yet.</p>
        ) : (
          <ul class="enrolments">
            {enrolled.map((e) => (
              <li data-code={e.code}>
                <span><strong>{e.code}</strong> {e.title} · {e.units} units</span>
                <form method="post" action="/api/drop">
                  <input type="hidden" name="code" value={e.code} />
                  <button aria-label={`Drop ${e.code}`}>Drop</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
    <script>
      // Filtering hides cards instead of re-rendering them, so ticks made
      // before a search survive it. None of this is needed to enrol: the
      // form posts every ticked box with or without JavaScript.
      const search = document.querySelector<HTMLInputElement>("#search")!;
      const cards = [...document.querySelectorAll<HTMLElement>(".course")];
      const noMatch = document.querySelector<HTMLElement>("#no-match")!;
      const selected = document.querySelector<HTMLElement>("#selected")!;
      const picker = document.querySelector<HTMLFormElement>("#picker")!;

      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        let shown = 0;
        for (const card of cards) {
          const match = (card.dataset.search ?? "").includes(q);
          card.hidden = !match;
          if (match) shown++;
        }
        noMatch.hidden = shown > 0;
      });

      picker.addEventListener("change", () => {
        const ticked = [...picker.querySelectorAll<HTMLInputElement>('input[name="code"]:checked')];
        const units = ticked.reduce((sum, box) => sum + Number(box.dataset.units), 0);
        selected.textContent = ticked.length
          ? `${ticked.length} selected · ${units} units`
          : "Tick courses to add them here.";
      });
    </script>
```

- [ ] **Step 4: Styles**

Replace `src/styles.css`:

```css
body {
  margin: 0;
  padding: 1.5rem 1rem 6rem;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
  color: #1a1a1a;
  background: #f6f5f2;
}

nav { max-width: 72rem; margin: 0 auto 1rem; display: flex; gap: 1rem; }
main { max-width: 72rem; margin: 0 auto; }
a { color: #0b5fff; }
[hidden] { display: none !important; }

.lede { font-size: 1.15rem; margin-top: 0; }

.search { display: grid; gap: 0.35rem; margin-block: 1.5rem; }
.search input { font: inherit; font-size: 1.25rem; padding: 0.75rem 1rem; border: 2px solid #999; border-radius: 0.5rem; }

.courses {
  list-style: none; padding: 0; margin: 0;
  display: grid; gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
}
.course label {
  display: grid; gap: 0.2rem; height: 100%; box-sizing: border-box;
  padding: 1rem; background: #fff; border: 2px solid #ddd; border-radius: 0.75rem;
  cursor: pointer;
}
.course label:has(input:checked) { border-color: #0b5fff; background: #eef3ff; }
.course label:has(input:disabled) { opacity: 0.6; cursor: default; }
.course input { width: 1.25rem; height: 1.25rem; margin: 0 0 0.25rem; }
.course .code { font-weight: 700; }
.course .meta, .course .desc { font-size: 0.9rem; color: #555; }

.tray {
  position: sticky; bottom: 0; margin-top: 1rem;
  display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;
  padding: 1rem; background: #1a1a1a; color: #fff; border-radius: 0.75rem;
}
.tray p { margin: 0; }

button { font: inherit; padding: 0.5rem 1.1rem; border-radius: 0.4rem; border: 0; cursor: pointer; }
.tray button { background: #fff; color: #1a1a1a; font-weight: 700; font-size: 1.1rem; }

#enrolled { margin-top: 2.5rem; }
.enrolments { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
.enrolments li {
  display: flex; gap: 1rem; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem; background: #fff; border-radius: 0.5rem;
}
.enrolments form { margin: 0; }
.warn { padding: 0.75rem 1rem; background: #fff4d6; border-left: 4px solid #d99a00; }
```

- [ ] **Step 5: Run to verify they pass**

Run: `mise exec -- pnpm check`
Expected: all PASS, including the axe floor on `/` (every input has a label).

- [ ] **Step 6: Check it in a browser**

Run: `mise exec -- pnpm dev`, open the printed URL. Tick COMP1100, search "data", tick COMP2400, clear the search — COMP1100 still ticked; tray reads "2 selected · 12 units". Enrol, reload: both under My enrolments.

- [ ] **Step 7: Commit**

```sh
git add -A
git commit -m "feat: roomy picker with live search, sticky tray and load warning"
```

---

### Task 3: README, harness and deploy

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `PROCESS.md`
- Create: `reflections/crit-7.md` (**the student writes this, not the agent**)

- [ ] **Step 1: README** — replace the template (the `/readme/` test checks it's served whole). One paragraph on what it is (ANUHub course picking without add → search → confirm per course); "What good looks like here": one confirm for many courses, search that keeps your ticks, room to read; enforced by `spec/enrolment.test.ts`; judged by a person: whether it's actually better than ANUHub. List what was deliberately left out (login, programs, clashes, prerequisites, semesters). Remove the TEMPLATE comment.

- [ ] **Step 2: CLAUDE.md** — the student's own rules for the agent, e.g. schema changes only via `pnpm db:generate`; tests drive HTTP, never import `src/`; keep `pnpm check` green before commits; no features from the out-of-scope list.

- [ ] **Step 3: PROCESS.md** — the student's account, citing commits as `https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-fiardiel/commit/<sha>`: the spec commit, Task 1 (red → green tests), Task 2. Quote one or two real prompts. Delete the TEMPLATE comment.

- [ ] **Step 4: Reflection** — student writes `reflections/crit-7.md`, 150–300 words, answering the two prompts in `reflections/README.md`.

- [ ] **Step 5: Verify evidence and checks**

Run: `mise exec -- pnpm check && mise exec -- pnpm check:evidence`
Expected: both PASS.

- [ ] **Step 6: Commit, push, deploy**

```sh
git add -A
git commit -m "docs: README, harness, process and crit 7 reflection"
git push
mise exec -- flyctl deploy --remote-only --ha=false -a comp4020-crit7-fiardiel
```

Then open `https://comp4020-crit7-fiardiel.fly.dev/` and `/readme/`, enrol in two courses, reload, confirm they persist. Hand off to the **preflight** and **ship** skills.
