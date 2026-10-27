import type { Questionnaire } from "@datingappai/shared";
import { describe, expect, it } from "vitest";
import { prepPhoto } from "../src/pipeline/prep.ts";
import { runPipeline } from "../src/pipeline/run.ts";
import { rankPhotos, SCORE_BATCH_SIZE } from "../src/pipeline/score.ts";
import { patternJpeg, score, stubCaller } from "./helpers.ts";

const questionnaire: Questionnaire = {
  firstName: "Sam",
  age: 29,
  job: "",
  interests: [],
  lookingFor: "",
  tone: "funny",
  funFacts: [],
  platforms: ["hinge"],
};

/** Pulls the "PHOTO <id>" labels out of a request, in order. */
function photoIds(content: { type: string; text?: string }[]): string[] {
  return content.flatMap((b) => (b.type === "text" && b.text?.startsWith("PHOTO ") ? [b.text.slice(6)] : []));
}

describe("rankPhotos", () => {
  it("drops photos without the user or with disqualifying flags, best first", () => {
    const ranked = rankPhotos([
      score("ok"),
      score("great", { overall: 10, expression: 9 }),
      score("absent", { user_present: false }),
      score("ex", { flags: ["possible_ex_or_partner"] }),
      score("mirror", { flags: ["mirror_selfie"] }),
    ]);
    expect(ranked.map((s) => s.photo_id)).toEqual(["great", "ok", "mirror"]);
  });
});

describe("runPipeline", () => {
  it("scores in batches with references first, then writes the profile from the top photos", async () => {
    const photos = await Promise.all(Array.from({ length: 12 }, async (_, i) => prepPhoto(`p_${i + 1}`, await patternJpeg(i + 1))));

    const { call, requests } = stubCaller((req) => {
      const ids = photoIds(req.content as any);
      if (req.effort === "low") {
        // Scoring: echo one score per photo, plus a bogus id and an unknown flag that must be ignored.
        return {
          photos: [
            ...ids.map((id) => score(id, { overall: Number(id.slice(2)) % 10, flags: ["not_a_flag"] })),
            score("p_999"),
          ],
        };
      }
      return {
        tinder: null,
        hinge: {
          photos: ids.slice(0, 6).map((id) => ({ photo_id: id, reason: "good", caption: "" })),
          prompts: [
            { prompt: "Typical Sunday", answer: "Long run, longer brunch.", alternatives: [] },
            { prompt: "I geek out on", answer: "Maps.", alternatives: [] },
            { prompt: "Two truths and a lie", answer: "I've met a moose. I can juggle. I hate cheese.", alternatives: [] },
          ],
        },
        tips: [],
      };
    });

    const updates: string[] = [];
    const result = await runPipeline(call, { photos, referenceIds: ["p_1"], questionnaire }, (u) => updates.push(u.status));

    const scoring = requests.filter((r) => r.effort === "low");
    expect(scoring).toHaveLength(Math.ceil(12 / SCORE_BATCH_SIZE));
    const first = scoring[0]!.content[0] as { type: string; text: string };
    expect(first.text).toMatch(/^REFERENCE 1/);
    expect(result.scores).toHaveLength(12);
    expect(result.scores.every((s) => s.flags.length === 0)).toBe(true);

    // Writing sees the top-ranked photos, best first.
    const writing = requests.find((r) => r.effort === "medium")!;
    expect(photoIds(writing.content as any)[0]).toBe("p_9");

    expect(result.profiles.hinge!.photos).toHaveLength(6);
    expect(result.profiles.hinge!.prompts).toHaveLength(3);
    expect(updates).toContain("writing");
  });

  it("refuses to run without a reference photo", async () => {
    const photos = [await prepPhoto("p_1", await patternJpeg(1))];
    const { call } = stubCaller([]);
    await expect(runPipeline(call, { photos, referenceIds: [], questionnaire })).rejects.toThrow(/this is me/);
  });

  it("fails with a clear message when too few photos show the user", async () => {
    const photos = await Promise.all([1, 2, 3].map(async (i) => prepPhoto(`p_${i}`, await patternJpeg(i))));
    const { call } = stubCaller(() => ({ photos: ["p_1", "p_2", "p_3"].map((id) => score(id, { user_present: false })) }));
    await expect(runPipeline(call, { photos, referenceIds: ["p_1"], questionnaire })).rejects.toThrow(/clearly show you/);
  });
});
