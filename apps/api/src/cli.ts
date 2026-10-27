// Runs the full pipeline on a local folder of photos, without Google or the app.
//
//   pnpm score <folder> [--me <file>[,<file>]] [--questionnaire <file.json>] [--out <folder>]
//
// Files whose names start with "me" are used as "this is me" reference photos
// when --me is not given. Results are written to <out>/profile.json, along with
// the chosen photos numbered in order.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { Questionnaire } from "@datingappai/shared";
import { createClaudeCaller } from "./claude.ts";
import { prepAll, runPipeline } from "./pipeline/run.ts";

// HEIC is not supported by the prebuilt sharp binaries; export those as JPEG first.
const IMAGE = /\.(jpe?g|png|webp)$/i;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    me: { type: "string" },
    questionnaire: { type: "string" },
    out: { type: "string", default: "out" },
  },
});

const folder = positionals[0];
if (!folder) {
  console.error("Usage: pnpm score <folder> [--me a.jpg,b.jpg] [--questionnaire q.json] [--out dir]");
  process.exit(1);
}

const files = (await readdir(folder)).filter((f) => IMAGE.test(f)).sort();
const referenceIds = values.me ? values.me.split(",").map((f) => path.basename(f)) : files.filter((f) => /^me/i.test(f));
const questionnaire = Questionnaire.parse(
  values.questionnaire
    ? JSON.parse(await readFile(values.questionnaire, "utf8"))
    : { firstName: "Alex", age: 28, interests: [], funFacts: [] },
);

console.log(`${files.length} photos, references: ${referenceIds.join(", ") || "none"}`);
const raw = await Promise.all(files.map(async (f) => ({ id: f, data: await readFile(path.join(folder, f)) })));
const { prepared: photos, skipped } = await prepAll(raw);
for (const id of skipped) console.warn(`warning: couldn't read ${id}`);
const started = Date.now();
const result = await runPipeline(createClaudeCaller(), { photos, referenceIds, questionnaire }, (u) =>
  console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${u.status}${u.detail ? `: ${u.detail}` : ""}`),
);

await mkdir(values.out!, { recursive: true });
await writeFile(
  path.join(values.out!, "profile.json"),
  JSON.stringify({ ...result.profiles, warnings: result.warnings, scores: result.scores }, null, 2),
);
for (const [platform, profile] of Object.entries({ tinder: result.profiles.tinder, hinge: result.profiles.hinge })) {
  if (!profile) continue;
  const dir = path.join(values.out!, platform);
  await mkdir(dir, { recursive: true });
  await Promise.all(
    profile.photos.map((p, i) => writeFile(path.join(dir, `${i + 1}-${p.photo_id}.jpg`), result.photos.get(p.photo_id)!.full)),
  );
}

console.log(JSON.stringify(result.profiles, null, 2));
for (const w of result.warnings) console.warn(`warning: ${w}`);
console.log(`Wrote ${values.out}/profile.json`);
