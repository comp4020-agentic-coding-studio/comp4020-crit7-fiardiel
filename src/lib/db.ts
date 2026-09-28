import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { type Course, courses, enrolments } from "./schema";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

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

// ANU's full-time load (and the fixed load for international students):
// four courses a semester.
export const MAX_COURSES = 4;

export type EnrolResult = { ok: true; added: number } | { ok: false; wouldHave: number };

// Enrols in every real course among `codes` in one statement. Codes are
// normalised, de-duplicated and checked against the catalogue; courses
// already enrolled are skipped rather than erroring. A batch that would take
// the student past MAX_COURSES is refused whole, never enrolled in part.
export function enrol(codes: string[]): EnrolResult {
  const wanted = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (wanted.length === 0) return { ok: true, added: 0 };
  const current = new Set(listEnrolments().map((e) => e.code));
  const fresh = db
    .select({ code: courses.code })
    .from(courses)
    .where(inArray(courses.code, wanted))
    .all()
    .filter(({ code }) => !current.has(code));
  if (fresh.length === 0) return { ok: true, added: 0 };
  const wouldHave = current.size + fresh.length;
  if (wouldHave > MAX_COURSES) return { ok: false, wouldHave };
  const added = db
    .insert(enrolments)
    .values(fresh.map(({ code }) => ({ courseCode: code })))
    .onConflictDoNothing()
    .run().changes;
  return { ok: true, added };
}

export function drop(code: string): void {
  db.delete(enrolments)
    .where(eq(enrolments.courseCode, code.trim().toUpperCase()))
    .run();
}
