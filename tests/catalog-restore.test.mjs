import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { prepareTestDatabase } from "../scripts/database-fixture.mjs";

const migration = "20261126151731_restore_missing_release_catalog.sql";
const diagnostic = "fe816150-8c12-4b3a-b04a-000000000002";

test("restores the published release catalog to an empty TAFE database without reopening its diagnostic", async () => {
  const db = new PGlite();
  try {
    await prepareTestDatabase(db, async (file) => {
      if (file === migration) {
        await db.exec(`
          truncate table public.exam_categories, public.tests, public.plans,
            public.opensat_routing, public.platform_settings cascade;
        `);
      }
    });

    const { rows } = await db.query(
      `
      select (select count(*)::int from public.exam_categories where active) as categories,
        (select count(*)::int from public.tests where published) as tests,
        (select count(*)::int from public.questions) as questions,
        (select count(*)::int from public.answer_keys) as keys,
        (select count(*)::int from public.sat_scoring_models) as models,
        (select count(*)::int from public.opensat_routing) as routes,
        (select count(*)::int from public.platform_settings) as settings,
        (select count(*)::int from public.tests where id = $1) as diagnostics
    `,
      [diagnostic],
    );
    assert.deepEqual(rows[0], {
      categories: 4,
      tests: 8,
      questions: 150,
      keys: 150,
      models: 2,
      routes: 1,
      settings: 1,
      diagnostics: 0,
    });

    await db.exec(`
      update public.plans set tests_daily = 3 where name = 'TAFE Starter';
      insert into auth.users (id, raw_user_meta_data)
        values ('c1000000-0000-4000-8000-000000000004', '{}');
    `);
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + migration, import.meta.url),
        "utf8",
      ),
    );
    await db.exec(`
      select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000004',false);
      set role authenticated;
    `);
    const {
      rows: [attempt],
    } = await db.query(`
      select public.my_entitlements() -> 'plan' ->> 'tests_daily' as limit,
        public.web_exam_catalog() as catalog
    `);
    assert.equal(attempt.limit, "3");
    assert.deepEqual(
      attempt.catalog.map((entry) => entry.title).sort(),
      [
        "CEFR · Multilevel Reading",
        "IELTS Academic Reading · Practice Set 1",
        "SAT · Full Practice",
      ].sort(),
    );
  } finally {
    await db.close();
  }
});
