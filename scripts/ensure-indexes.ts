import "./_env";
import { closeDb, getDb } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";
import { getEnv } from "@/server/env";

async function main() {
  const db = await getDb();
  console.log(`Ensuring indexes on database "${getEnv().MONGODB_DB}"…`);
  const done = await ensureIndexes(db);
  for (const d of done) console.log(`  ✓ ${d.collection}.${d.index}`);
  console.log(`Done: ${done.length} indexes.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
