import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { prepareTestDatabase } from "./database-fixture.mjs";
import { randomUUID } from "node:crypto";
import { normalizeBank } from "../supabase/functions/opensat-start/normalize.mjs";
import assert from "node:assert/strict";
const db = new PGlite();
try {
  await prepareTestDatabase(db);
  const learner = randomUUID(),
    plan = randomUUID();
  await db.query(
    "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
    [learner, { display_name: "Isolated QA" }],
  );
  await db.query(
    "insert into public.plans(id,name,active,ai_daily,ai_monthly,tests_daily,tests_monthly,library_rank,permissions) values($1,'QA',true,1,1,4,4,1,'{\"full_mock\":true}')",
    [plan],
  );
  await db.query(
    "insert into public.subscriptions(user_id,plan_id,expires_at) values($1,$2,now()+interval '1 day')",
    [learner, plan],
  );
  const bank = [];
  for (const [file, section] of [
    [process.argv[2], "english"],
    [process.argv[3], "math"],
  ]) {
    const all = normalizeBank(
      JSON.parse(await readFile(file, "utf8")),
      section,
    );
    for (const difficulty of ["Medium", "Easy", "Hard"])
      bank.push(
        ...all
          .filter((q) => q.difficulty === difficulty)
          .slice(0, section === "english" ? 27 : 22)
          .map((q) => ({
            ...q,
            id: randomUUID(),
            sat_section: section === "english" ? "reading_writing" : "math",
          })),
      );
  }
  const get = async (sql, args) => (await db.query(sql, args)).rows[0].value;
  const form = "fe816150-8c12-4b3a-b04a-000000000031";
  const keys = new Map(bank.map((q) => [q.id, q.answer]));
  let session = await get(
    "select public.start_opensat_with_bank($1,$2) value",
    [learner, JSON.stringify(bank)],
  );
  const id = session.id;
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    learner,
  ]);
  await db.exec("set role authenticated");
  const action = (stage, answers, action = "advance") =>
    get("select public.exam_session_action($1,$2,$3,$4) value", [
      id,
      JSON.stringify(answers),
      action,
      stage,
    ]);
  const seen = new Set();
  for (let stage = 0; stage < 4; stage++) {
    assert.equal(session.stage, stage);
    assert.equal(session.questions.length, stage < 2 ? 27 : 22);
    for (const q of session.questions) {
      assert(!seen.has(q.id));
      seen.add(q.id);
      assert(!("answer" in q));
    }
    if (stage === 1) assert.equal(session.route, "Hard");
    if (stage === 3) assert.equal(session.route, "Easy");
    const answers =
      stage < 2
        ? Object.fromEntries(
            session.questions.map((q) => [q.id, keys.get(q.id)]),
          )
        : {};
    if (stage === 0) {
      await db.query("select public.opensat_review_flags($1,$2)", [
        id,
        JSON.stringify([session.questions[0].id]),
      ]);
      await action(stage, answers, "save");
      const resume = await get("select public.start_exam_session($1) value", [
        form,
      ]);
      assert.equal(resume.id, id);
      assert.equal(Object.keys(resume.answers).length, 27);
      assert.equal(resume.review_flags.length, 1);
    }
    session = await action(stage, answers);
  }
  assert.equal(seen.size, 98);
  assert.equal(session.sat_scores.correct, 54);
  assert.equal(session.sat_scores.unanswered, 44);
  assert.equal(session.sat_scores.total, 1000);
  assert.deepEqual((await action(3, {})).sat_scores, session.sat_scores);
  const review = await get("select public.attempt_review($1) value", [id]);
  assert.equal(review.questions.length, 98);
  assert.equal(
    review.questions.filter((q) => q.difficulty === "Hard").length,
    27,
  );
  console.log(
    "Live OpenSAT corpus + isolated PostgreSQL: Hard/Easy routes, 98 unique items, answer protection, autosave, flags, resume, scoring and retry passed",
  );
} finally {
  await db.close();
}
