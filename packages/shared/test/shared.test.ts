import { describe, expect, it } from "vitest";
import { HINGE_PROMPTS, Questionnaire } from "../src/index.ts";

describe("Questionnaire", () => {
  it("fills defaults for optional answers", () => {
    expect(Questionnaire.parse({ firstName: "Sam", age: 29 })).toMatchObject({
      tone: "warm",
      interests: [],
      platforms: ["tinder", "hinge"],
    });
  });

  it("rejects under-18s and empty platform lists", () => {
    expect(Questionnaire.safeParse({ firstName: "Sam", age: 17 }).success).toBe(false);
    expect(Questionnaire.safeParse({ firstName: "Sam", age: 29, platforms: [] }).success).toBe(false);
  });
});

describe("HINGE_PROMPTS", () => {
  it("has no duplicates", () => {
    expect(new Set(HINGE_PROMPTS.map((p) => p.toLowerCase())).size).toBe(HINGE_PROMPTS.length);
  });
});
