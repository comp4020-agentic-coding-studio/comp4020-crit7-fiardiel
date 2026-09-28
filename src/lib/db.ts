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
  db.delete(enrolments)
    .where(eq(enrolments.courseCode, code.trim().toUpperCase()))
    .run();
}
