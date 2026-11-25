import "./_env";
import { closeDb } from "@/server/db/client";
import { cols } from "@/server/db/collections";
import { getEnv } from "@/server/env";
import { buildKbDocs } from "@/server/kb/seed-data";
import { DEFAULT_SETTINGS } from "@/server/services/settings";

/*
  Idempotent seed: settings doc + every kbDiseases entry.
  Default: insert only what is missing, so admin edits are never overwritten.
  `npm run seed -- --force`: overwrite settings and KB entries with the seed values.
*/

const force = process.argv.includes("--force");

async function main() {
  const { settings, kbDiseases } = await cols();
  const now = new Date();
  console.log(`Seeding database "${getEnv().MONGODB_DB}"${force ? " (--force: overwrite)" : ""}…`);

  const s = force
    ? await settings.updateOne({ _id: "global" }, { $set: { ...DEFAULT_SETTINGS, updatedAt: now, updatedBy: "seed" } }, { upsert: true })
    : await settings.updateOne(
        { _id: "global" },
        { $setOnInsert: { ...DEFAULT_SETTINGS, updatedAt: now, updatedBy: "seed" } },
        { upsert: true },
      );
  console.log(`  settings: ${s.upsertedCount ? "created" : s.modifiedCount ? "overwritten" : "already present"}`);

  const docs = buildKbDocs(now);
  const ops = docs.map(({ _id, ...rest }) =>
    force
      ? { replaceOne: { filter: { _id }, replacement: rest, upsert: true } }
      : { updateOne: { filter: { _id }, update: { $setOnInsert: rest }, upsert: true } },
  );
  const r = await kbDiseases.bulkWrite(ops, { ordered: false });
  console.log(`  kbDiseases: ${docs.length} entries — ${r.upsertedCount} inserted, ${r.modifiedCount} overwritten, ${docs.length - r.upsertedCount - r.modifiedCount} unchanged`);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
