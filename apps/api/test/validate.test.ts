import { HINGE, TINDER, type GeneratedProfiles, type Questionnaire } from "@datingappai/shared";
import { describe, expect, it } from "vitest";
import { truncateAtBoundary } from "../src/pipeline/regenerate.ts";
import { fixPhotoPicks, repairProfiles } from "../src/pipeline/validate.ts";
import { score, stubCaller } from "./helpers.ts";

const questionnaire: Questionnaire = {
  firstName: "Sam",
  age: 29,
  job: "Nurse",
  interests: ["climbing"],
  lookingFor: "",
  tone: "warm",
  funFacts: [],
  platforms: ["tinder", "hinge"],
};

const ranked = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => score(id));
const pick = (id: string) => ({ photo_id: id, reason: "r" });
const filler = (s: { photo_id: string }) => pick(s.photo_id);

describe("fixPhotoPicks", () => {
  it("drops unknown and repeated ids, then fills up to the minimum from the ranking", () => {
    const result = fixPhotoPicks([pick("c"), pick("zzz"), pick("c"), pick("a")], ranked, { min: 4, max: 6 }, filler);
    expect(result.map((p) => p.photo_id)).toEqual(["c", "a", "b", "d"]);
  });

  it("caps at the maximum", () => {
    const result = fixPhotoPicks(ranked.map((s) => pick(s.photo_id)), ranked, { min: 1, max: 3 }, filler);
    expect(result).toHaveLength(3);
  });

  it("moves a solo face shot to the front when the first pick is a group photo", () => {
    const withGroup = [score("group", { people_count: 4 }), score("solo"), score("other")];
    const result = fixPhotoPicks([pick("group"), pick("other"), pick("solo")], withGroup, { min: 3, max: 3 }, filler);
    expect(result[0]!.photo_id).toBe("other");
  });
});

describe("truncateAtBoundary", () => {
  it("prefers ending at a sentence", () => {
    expect(truncateAtBoundary("First sentence here. Second one is much longer than allowed", 30)).toBe("First sentence here.");
  });
  it("falls back to a word boundary", () => {
    expect(truncateAtBoundary("one two three four", 12)).toBe("one two");
  });
});

function draft(overrides: Partial<GeneratedProfiles> = {}): GeneratedProfiles {
  return {
    tinder: {
      photos: ranked.slice(0, 6).map((s) => pick(s.photo_id)),
      bio: "Short bio.",
      bio_alternatives: ["alt", "x".repeat(TINDER.bioMaxChars + 1)],
      interests: ["a", "b", "c", "d", "e", "f", "g"],
      job_title: "Nurse",
      anthem: "Artist - Song",
    },
    hinge: {
      photos: ranked.slice(0, 6).map((s) => ({ ...pick(s.photo_id), caption: "" })),
      prompts: [
        { prompt: "typical sunday", answer: "Farmers market.", alternatives: [] },
        { prompt: "My made-up prompt", answer: "Nope.", alternatives: [] },
        { prompt: "Two truths and a lie", answer: "x".repeat(HINGE.promptAnswerMaxChars + 20), alternatives: [] },
      ],
    },
    tips: [],
    ...overrides,
  };
}

describe("repairProfiles", () => {
  it("enforces limits, normalises prompts and rewrites over-long answers", async () => {
    const { call, requests } = stubCaller([{ text: "Short enough now." }]);
    const { profiles, warnings } = await repairProfiles(call, draft(), ranked, questionnaire);

    expect(profiles.tinder!.interests).toHaveLength(TINDER.maxInterests);
    expect(profiles.tinder!.bio_alternatives).toEqual(["alt"]);
    expect(profiles.hinge!.prompts.map((p) => p.prompt)).toEqual(["Typical Sunday", "Two truths and a lie"]);
    expect(profiles.hinge!.prompts[1]!.answer).toBe("Short enough now.");
    expect(requests).toHaveLength(1);
    expect(warnings.some((w) => w.includes("My made-up prompt"))).toBe(true);
    expect(warnings.some((w) => w.includes("2 of 3"))).toBe(true);
  });

  it("truncates when Claude keeps returning text over the limit", async () => {
    const long = "word ".repeat(200);
    const { call, requests } = stubCaller(() => ({ text: long }));
    const tooLong = draft();
    tooLong.tinder!.bio = long;
    const { profiles } = await repairProfiles(call, { ...tooLong, hinge: null }, ranked, questionnaire);
    expect(profiles.tinder!.bio.length).toBeLessThanOrEqual(TINDER.bioMaxChars);
    expect(requests).toHaveLength(2);
  });

  it("warns when there aren't enough usable photos for Hinge", async () => {
    const few = ranked.slice(0, 4);
    const { call } = stubCaller([{ text: "Shortened." }]);
    const { profiles, warnings } = await repairProfiles(call, draft({ tinder: null }), few, questionnaire);
    expect(profiles.hinge!.photos).toHaveLength(4);
    expect(warnings.some((w) => w.includes("Hinge needs 6 photos"))).toBe(true);
  });
});
