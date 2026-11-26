import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { prepareTestDatabase } from "./database-fixture.mjs";
const db = new PGlite();
try {
  await prepareTestDatabase(db);
  const results = await db.exec(
    await readFile(new URL("../tests/platform.sql", import.meta.url), "utf8"),
  );
  const verdict = results
    .flatMap((r) => r.rows)
    .find((r) => r?.result === "platform transaction assertions passed");
  if (!verdict) throw Error("Test assertions did not complete.");
  console.log(verdict.result);
  console.log(
    "All canonical migrations replayed against isolated PostgreSQL. Auth and Storage schema contracts are local test fixtures.",
  );
} finally {
  await db.close();
}
