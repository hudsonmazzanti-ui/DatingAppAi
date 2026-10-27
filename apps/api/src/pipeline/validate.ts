import {
  HINGE,
  HINGE_PROMPTS,
  TINDER,
  type GeneratedProfiles,
  type HingeProfile,
  type PhotoScore,
  type Questionnaire,
  type TinderProfile,
} from "@datingappai/shared";
import type { StructuredCaller } from "../claude.ts";
import { rewriteText, truncateAtBoundary } from "./regenerate.ts";

interface Pick {
  photo_id: string;
  reason: string;
}

const isStrongLead = (s: PhotoScore) => s.people_count === 1 && s.face_visible && !s.flags.includes("mirror_selfie");

/**
 * Makes a photo list obey the rules that can be checked without looking at the
 * photos: only usable ids, no repeats, the right count, and a solo face shot first.
 * `ranked` is the usable photos, best first.
 */
export function fixPhotoPicks<P extends Pick>(
  picks: P[],
  ranked: PhotoScore[],
  count: { min: number; max: number },
  filler: (s: PhotoScore) => P,
): P[] {
  const byId = new Map(ranked.map((s) => [s.photo_id, s]));
  const seen = new Set<string>();
  const result = picks.filter((p) => byId.has(p.photo_id) && !seen.has(p.photo_id) && seen.add(p.photo_id));

  for (const s of ranked) {
    if (result.length >= count.min) break;
    if (!seen.has(s.photo_id)) {
      seen.add(s.photo_id);
      result.push(filler(s));
    }
  }
  result.splice(count.max);

  const first = result[0] && byId.get(result[0].photo_id);
  if (first && !isStrongLead(first)) {
    const swapIndex = result.findIndex((p) => isStrongLead(byId.get(p.photo_id)!));
    if (swapIndex > 0) [result[0], result[swapIndex]] = [result[swapIndex]!, result[0]!];
  }
  return result;
}

const fillerReason = "Added to fill the set: one of your highest-scoring remaining photos.";

function matchHingePrompt(prompt: string): string | undefined {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").trim();
  return HINGE_PROMPTS.find((p) => normalise(p) === normalise(prompt));
}

export interface RepairResult {
  profiles: GeneratedProfiles;
  warnings: string[];
}

export async function repairProfiles(
  call: StructuredCaller,
  profiles: GeneratedProfiles,
  ranked: PhotoScore[],
  questionnaire: Questionnaire,
): Promise<RepairResult> {
  const warnings: string[] = [];
  const tinder = profiles.tinder && (await repairTinder(call, profiles.tinder, ranked, questionnaire, warnings));
  const hinge = profiles.hinge && (await repairHinge(call, profiles.hinge, ranked, questionnaire, warnings));
  return { profiles: { ...profiles, tinder, hinge }, warnings };
}

async function repairTinder(
  call: StructuredCaller,
  t: TinderProfile,
  ranked: PhotoScore[],
  questionnaire: Questionnaire,
  warnings: string[],
): Promise<TinderProfile> {
  const photos = fixPhotoPicks(
    t.photos,
    ranked,
    { min: Math.min(TINDER.recommendedPhotos, ranked.length), max: TINDER.maxPhotos },
    (s) => ({ photo_id: s.photo_id, reason: fillerReason }),
  );
  if (photos.length < TINDER.recommendedPhotos) {
    warnings.push(`Only ${photos.length} usable photos for Tinder; ${TINDER.recommendedPhotos} is recommended.`);
  }
  const bio =
    t.bio.length > TINDER.bioMaxChars
      ? await rewriteText(call, {
          label: "Tinder bio",
          current: t.bio,
          instruction: "Shorten it, keeping the strongest hook.",
          maxChars: TINDER.bioMaxChars,
          questionnaire,
        })
      : t.bio;
  return {
    ...t,
    photos,
    bio,
    bio_alternatives: t.bio_alternatives.filter((b) => b.length <= TINDER.bioMaxChars),
    interests: t.interests.slice(0, TINDER.maxInterests),
    job_title: truncateAtBoundary(t.job_title, TINDER.jobTitleMaxChars),
  };
}

async function repairHinge(
  call: StructuredCaller,
  h: HingeProfile,
  ranked: PhotoScore[],
  questionnaire: Questionnaire,
  warnings: string[],
): Promise<HingeProfile> {
  const photos = fixPhotoPicks(h.photos, ranked, { min: HINGE.photos, max: HINGE.photos }, (s) => ({
    photo_id: s.photo_id,
    reason: fillerReason,
    caption: "",
  })).map((p) => (p.caption.length > HINGE.captionMaxChars ? { ...p, caption: "" } : p));
  if (photos.length < HINGE.photos) {
    warnings.push(`Hinge needs ${HINGE.photos} photos but only ${photos.length} were usable. Add more photos and run again.`);
  }

  const seenPrompts = new Set<string>();
  const prompts: HingeProfile["prompts"] = [];
  for (const p of h.prompts) {
    const prompt = matchHingePrompt(p.prompt);
    if (!prompt) {
      warnings.push(`Dropped a prompt that isn't on Hinge's list: "${p.prompt}".`);
      continue;
    }
    if (seenPrompts.has(prompt) || prompts.length >= HINGE.prompts) continue;
    seenPrompts.add(prompt);
    const answer =
      p.answer.length > HINGE.promptAnswerMaxChars
        ? await rewriteText(call, {
            label: `Hinge answer to the prompt "${prompt}"`,
            current: p.answer,
            instruction: "Shorten it, keeping what makes it easy to reply to.",
            maxChars: HINGE.promptAnswerMaxChars,
            questionnaire,
          })
        : p.answer;
    prompts.push({
      prompt,
      answer,
      alternatives: p.alternatives.filter((a) => a.length <= HINGE.promptAnswerMaxChars),
    });
  }
  if (prompts.length < HINGE.prompts) {
    warnings.push(`Only ${prompts.length} of ${HINGE.prompts} Hinge prompts are ready. Regenerate to fill the rest.`);
  }
  return { photos, prompts };
}
