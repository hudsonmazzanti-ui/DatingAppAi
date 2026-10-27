import { PhotoFlag, PhotoScoreBatch, type PhotoScore } from "@datingappai/shared";
import { jpegBlock, textBlock, type StructuredCaller } from "../claude.ts";
import { SCORE_SYSTEM } from "../prompts.ts";
import type { PreparedPhoto } from "./prep.ts";

export const SCORE_BATCH_SIZE = 10;
const CONCURRENCY = 4;

/** Flags that rule a photo out entirely. */
export const DISQUALIFYING_FLAGS: readonly PhotoFlag[] = [
  "face_hidden",
  "possible_ex_or_partner",
  "someone_elses_child",
  "user_hard_to_identify",
  "screenshot_or_meme",
  "holding_weapon",
];

export async function scorePhotos(
  call: StructuredCaller,
  photos: PreparedPhoto[],
  references: PreparedPhoto[],
  onProgress?: (scored: number, total: number) => void,
): Promise<PhotoScore[]> {
  const batches: PreparedPhoto[][] = [];
  for (let i = 0; i < photos.length; i += SCORE_BATCH_SIZE) batches.push(photos.slice(i, i + SCORE_BATCH_SIZE));

  const results: PhotoScore[][] = new Array(batches.length);
  let scored = 0;
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const index = next++;
      const batch = batches[index]!;
      results[index] = await scoreBatch(call, batch, references);
      scored += batch.length;
      onProgress?.(scored, photos.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  return results.flat();
}

async function scoreBatch(call: StructuredCaller, batch: PreparedPhoto[], references: PreparedPhoto[]) {
  // References first and in a fixed order, so the cached prefix is shared across batches.
  const content = [
    ...references.flatMap((r, i) => [textBlock(`REFERENCE ${i + 1} (this is the user)`), jpegBlock(r.scoring)]),
    ...batch.flatMap((p) => [textBlock(`PHOTO ${p.id}`), jpegBlock(p.scoring)]),
    textBlock(`Score these ${batch.length} photos: ${batch.map((p) => p.id).join(", ")}.`),
  ];
  const { photos } = await call({ schema: PhotoScoreBatch, system: SCORE_SYSTEM, content, effort: "low" });
  const ids = new Set(batch.map((p) => p.id));
  // Drop anything Claude returned for an id that wasn't in this batch, and any repeats.
  const seen = new Set<string>();
  return photos
    .filter((s) => ids.has(s.photo_id) && !seen.has(s.photo_id) && seen.add(s.photo_id))
    .map((s) => ({ ...s, flags: s.flags.filter((f) => PhotoFlag.safeParse(f).success) }));
}

export function isUsable(score: PhotoScore): boolean {
  return score.user_present && !score.flags.some((f) => (DISQUALIFYING_FLAGS as readonly string[]).includes(f));
}

/** Usable photos, best first. */
export function rankPhotos(scores: PhotoScore[]): PhotoScore[] {
  const quality = (s: PhotoScore) =>
    s.overall * 3 + s.expression * 1.5 + s.lighting + s.sharpness + s.composition + (s.user_is_clear_subject ? 3 : 0);
  return scores.filter(isUsable).sort((a, b) => quality(b) - quality(a));
}
