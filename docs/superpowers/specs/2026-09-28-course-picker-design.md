# Course picker — design

Crit 7: "Build the ANU system you wish existed". Slice: ANUHub course
selection, specifically the add → search → confirm loop that enrols one course
at a time in a cramped interface.

## Goal

Pick many courses on one roomy page and enrol in all of them with a single
confirm. Enrolments persist in SQLite across a reload and a redeploy.

Success at the crit: a visitor finds several courses by searching, ticks them
without losing earlier ticks, presses one button, reloads, and they're all
still enrolled — on `comp4020-crit7-fiardiel.fly.dev`.

## Out of scope (deliberately)

Login / multiple users, program selection and requirement rules, timetable
clashes, prerequisites, semesters/sessions, class capacity. Single anonymous
student.

## Data (Drizzle + SQLite)

- `courses`: `code` (text, PK, e.g. `COMP1100`), `title` (text), `units`
  (int), `description` (text, one line).
- `enrolments`: `id` (int PK autoincrement), `course_code` (text, unique,
  references `courses.code`), `created_at` (text, default now).
- Seed ~20 real ANU courses in a migration (student verifies titles/units).
- Drop the starter's `messages` table in a migration.

## Server

- `GET /` — server-rendered page: all courses, current enrolments, unit total.
- `POST /api/enrol` — form body carries repeated `code` fields. Unknown codes
  and already-enrolled codes are skipped (`INSERT … ON CONFLICT DO NOTHING`).
  Responds `303` to `/`.
- `POST /api/drop` — form body `code`. Deletes that enrolment. `303` to `/`.
- Removed: `/api/messages`, `/api/events`, `src/lib/events.ts`.

## Page

- `h1` "Pick your courses"; nav keeps the `/readme/` link.
- Large search input; a small inline script hides course cards whose code or
  title don't match. Hiding (not re-rendering) keeps checkbox state intact.
- Course cards in a responsive grid: checkbox + code, title, units,
  description. Already-enrolled courses show as enrolled and are not
  selectable.
- Sticky tray: "N selected · U units" and the **Enrol in all** submit button.
  Works without JS (the form still submits); JS only updates the counter and
  filter.
- "My enrolments" list with a **Drop** button per course and the enrolled
  unit total; a non-blocking warning above 24 units.

## Tests (`spec/enrolment.test.ts`, run by `pnpm check`)

Against the running built server (existing `global-setup.ts`):

1. POST three codes in one request → 303; a fresh `GET /` lists all three
   under My enrolments.
2. POST an already-enrolled code again → still exactly one enrolment for it.
3. POST `/api/drop` for one code → a fresh `GET /` no longer lists it as
   enrolled.

Starter invariants and readme tests stay; `guestbook.test.ts` is deleted with
the guestbook.

## Judged by a person, not tested

Whether it's genuinely better than ANUHub's flow; the roominess of the layout;
how the work was directed, grounded and corrected (PROCESS.md, reflection).
