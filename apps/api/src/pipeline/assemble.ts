import { GeneratedProfiles, type PhotoScore, type Questionnaire } from "@datingappai/shared";
import { jpegBlock, textBlock, type StructuredCaller } from "../claude.ts";
import { assembleSystem, questionnaireText } from "../prompts.ts";
import type { PreparedPhoto } from "./prep.ts";

/** How many of the top-ranked photos Claude sees when writing the profile. */
export const ASSEMBLE_CANDIDATES = 15;

export async function assembleProfiles(
  call: StructuredCaller,
  ranked: PhotoScore[],
  photos: Map<string, PreparedPhoto>,
  questionnaire: Questionnaire,
): Promise<GeneratedProfiles> {
  const candidates = ranked.slice(0, ASSEMBLE_CANDIDATES);
  const platforms = questionnaire.platforms.join(" and ");
  const content = [
    ...candidates.flatMap((s) => [textBlock(`PHOTO ${s.photo_id}`), jpegBlock(photos.get(s.photo_id)!.scoring)]),
    textBlock(`Photo scores (best first):\n${JSON.stringify(candidates)}`),
    textBlock(questionnaireText(questionnaire)),
    textBlock(`Write the profile for: ${platforms}.`),
  ];
  const result = await call({ schema: GeneratedProfiles, system: assembleSystem(), content, effort: "medium" });
  return {
    ...result,
    tinder: questionnaire.platforms.includes("tinder") ? result.tinder : null,
    hinge: questionnaire.platforms.includes("hinge") ? result.hinge : null,
  };
}
