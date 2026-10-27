import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";

export const MODEL = "claude-opus-5-5";

export type Effort = "low" | "medium" | "high";

export interface StructuredRequest<S extends z.ZodType> {
  schema: S;
  system: string;
  content: BetaContentBlockParam[];
  effort: Effort;
  maxTokens?: number;
}

/** Calls Claude and returns output parsed against `schema`. Injectable so tests can stub it. */
export type StructuredCaller = <S extends z.ZodType>(req: StructuredRequest<S>) => Promise<z.infer<S>>;

export class ClaudeError extends Error {}

export function createClaudeCaller(client = new Anthropic()): StructuredCaller {
  return async ({ schema, system, content, effort, maxTokens = 32000 }) => {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      // Re-run on Anthropic's recommended model if a safety classifier declines.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      // The system prompt is fixed per pass, so it caches across a job's batches.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      throw new ClaudeError(`Claude declined the request (${message.stop_details?.category ?? "no category"}).`);
    }
    if (message.stop_reason === "max_tokens") {
      throw new ClaudeError("Claude's response was cut off at max_tokens.");
    }
    if (message.parsed_output == null) {
      throw new ClaudeError("Claude's response did not match the expected schema.");
    }
    return message.parsed_output;
  };
}

export function jpegBlock(data: Buffer): BetaContentBlockParam {
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: data.toString("base64") } };
}

export function textBlock(text: string): BetaContentBlockParam {
  return { type: "text", text };
}
