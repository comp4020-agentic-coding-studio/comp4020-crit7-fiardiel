import { sql } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
export const courses = sqliteTable("courses", {
  code: text().primaryKey(),
  title: text().notNull(),
  units: int().notNull(),
  description: text().notNull(),
  // Set only for courses that need the convenor's permission to enrol.
  // Server-side only: never render it into a page.
  permissionCode: text("permission_code"),
});

// One row per course the (single, anonymous) student is enrolled in; the
// unique course_code is what makes enrolling twice a no-op.
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
