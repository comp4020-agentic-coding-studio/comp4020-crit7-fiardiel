# Rules for this repo

This is a course picker: the slice of ANUHub course selection where you pick
many courses and enrol in them with one confirm. The brief and spec are on the
course site (crit 7, "Build the ANU system you wish existed").

- Stay inside the slice. No login, programs, timetable clashes,
  prerequisites, semesters or capacity unless I ask for them.
- Schema changes go through `src/lib/schema.ts` and `pnpm db:generate`, and
  the migration gets committed. Never edit the database by hand.
- Tests in `spec/` drive the running app over HTTP. Never import from `src/`
  in a test.
- Write the failing test first, and watch it fail, before the code that makes
  it pass.
- `pnpm check` must be green before every commit.
- Every page route goes in `spec/routes.ts`.
- Enrolling must keep working with JavaScript turned off. The script on the
  page is only for search and the tray counter.
