import type { GeneratedProfiles, JobStatus, PhotoScore, Questionnaire } from "@datingappai/shared";
import type { StructuredCaller } from "../claude.ts";
import { assembleProfiles } from "./assemble.ts";
import { dedupe, prepPhoto, type PreparedPhoto } from "./prep.ts";
import { rankPhotos, scorePhotos } from "./score.ts";
import { repairProfiles } from "./validate.ts";

export interface RawPhoto {
  id: string;
  data: Buffer;
}

export interface PipelineInput {
  photos: PreparedPhoto[];
  /** Ids (from `photos`) the user marked as "this is me". */
  referenceIds: string[];
  questionnaire: Questionnaire;
}

export interface PipelineResult {
  profiles: GeneratedProfiles;
  warnings: string[];
  scores: PhotoScore[];
  photos: Map<string, PreparedPhoto>;
}

export interface ProgressUpdate {
  status: JobStatus;
  detail?: string;
}

const MIN_USABLE_PHOTOS = 3;

/** Resizes and strips metadata from every photo, skipping any that can't be decoded. */
export async function prepAll(raw: RawPhoto[]): Promise<{ prepared: PreparedPhoto[]; skipped: string[] }> {
  const prepared: PreparedPhoto[] = [];
  const skipped: string[] = [];
  for (const photo of raw) {
    try {
      prepared.push(await prepPhoto(photo.id, photo.data));
    } catch {
      skipped.push(photo.id);
    }
  }
  return { prepared, skipped };
}

export async function runPipeline(
  call: StructuredCaller,
  input: PipelineInput,
  onProgress: (update: ProgressUpdate) => void = () => {},
): Promise<PipelineResult> {
  const warnings: string[] = [];
  const prepared = input.photos;
  const references = prepared.filter((p) => input.referenceIds.includes(p.id)).slice(0, 2);
  if (references.length === 0) throw new Error("Mark at least one photo as \"this is me\".");

  const candidates = dedupe(prepared);
  if (candidates.length < prepared.length) {
    warnings.push(`Skipped ${prepared.length - candidates.length} near-duplicate photos.`);
  }

  onProgress({ status: "scoring", detail: `0 of ${candidates.length} photos` });
  const scores = await scorePhotos(call, candidates, references, (done, total) =>
    onProgress({ status: "scoring", detail: `${done} of ${total} photos` }),
  );
  const ranked = rankPhotos(scores);
  if (ranked.length < MIN_USABLE_PHOTOS) {
    throw new Error(
      `Only ${ranked.length} of your photos clearly show you. Pick more photos where your face is visible and try again.`,
    );
  }

  onProgress({ status: "writing" });
  const photos = new Map(candidates.map((p) => [p.id, p]));
  const draft = await assembleProfiles(call, ranked, photos, input.questionnaire);
  const repaired = await repairProfiles(call, draft, ranked, input.questionnaire);

  return { profiles: repaired.profiles, warnings: [...warnings, ...repaired.warnings], scores, photos };
}
