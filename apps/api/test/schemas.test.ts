import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GeneratedProfiles, PhotoScoreBatch } from "@datingappai/shared";
import { describe, expect, it } from "vitest";

describe("Claude output schemas", () => {
  it.each([
    ["PhotoScoreBatch", PhotoScoreBatch],
    ["GeneratedProfiles", GeneratedProfiles],
  ])("%s converts to a strict structured-output format", (_, schema) => {
    const format = betaZodOutputFormat(schema);
    expect(format.type).toBe("json_schema");
    expect(JSON.stringify(format.schema)).toContain('"additionalProperties":false');
  });
});
