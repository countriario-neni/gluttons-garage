import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

export const MIGRATIONS = ["0001_schema.sql", "0002_functions.sql", "0003_rls.sql"].map((f) => `supabase/migrations/${f}`);

export const OWNER = "00000000-0000-4000-a000-000000000001";
export const KITCHEN = "00000000-0000-4000-a000-000000000002";
/** Signed-in user without a staff row (e.g. someone who signed up on their own). */
export const STRANGER = "00000000-0000-4000-a000-000000000003";

/** Fresh in-process Postgres with the Supabase shim, all migrations, seed.sql and two staff users. */
export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(read("tests/sql/shim.sql"));
  for (const m of MIGRATIONS) await db.exec(read(m));
  await db.exec(read("supabase/seed.sql"));
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@gluttonsgarage.demo'), ('${KITCHEN}', 'kitchen@gluttonsgarage.demo'), ('${STRANGER}', 'x@example.com');
    insert into public.staff (user_id, name, role) values ('${OWNER}', 'Owner', 'owner'), ('${KITCHEN}', 'Kitchen', 'kitchen');
  `);
  return db;
}

export type Who = "admin" | "anon" | "owner" | "kitchen" | "stranger";
const UID: Record<Who, string> = { admin: "", anon: "", owner: OWNER, kitchen: KITCHEN, stranger: STRANGER };

/** Switches the session to the given API role, as PostgREST does per request. */
export async function as(db: PGlite, who: Who) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [UID[who]]);
  if (who === "anon") await db.exec("set role anon");
  else if (who !== "admin") await db.exec("set role authenticated");
}

/** Calls `fn(args)` as `who` and returns its single jsonb/scalar result. */
export async function call<T = unknown>(db: PGlite, who: Who, fn: string, args: unknown[] = []): Promise<T> {
  await as(db, who);
  try {
    const params = args.map((a) => (a !== null && typeof a === "object" && !Array.isArray(a) ? JSON.stringify(a) : a));
    const ph = args.map((_, i) => `$${i + 1}`).join(", ");
    const r = await db.query<{ r: T }>(`select public.${fn}(${ph}) as r`, params);
    return r.rows[0].r;
  } finally {
    await as(db, "admin");
  }
}

/** Runs a query as `who` and returns its rows. */
export async function rows<T = Record<string, unknown>>(db: PGlite, who: Who, sql: string, params: unknown[] = []): Promise<T[]> {
  await as(db, who);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await as(db, "admin");
  }
}
