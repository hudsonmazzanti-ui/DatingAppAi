import { z } from "zod";
import type { Questionnaire } from "@datingappai/shared";
import { textBlock, type StructuredCaller } from "../claude.ts";
import { questionnaireText, REGENERATE_SYSTEM } from "../prompts.ts";

const Rewrite = z.object({ text: z.string() });

export interface RewriteRequest {
  /** What the text is, e.g. "Tinder bio" or 'Hinge answer to "Typical Sunday"'. */
  label: string;
  current: string;
  instruction: string;
  maxChars: number;
  questionnaire: Questionnaire;
}

const MAX_ATTEMPTS = 2;

/** Rewrites one text field, retrying if it comes back over the limit and truncating as a last resort. */
export async function rewriteText(call: StructuredCaller, req: RewriteRequest): Promise<string> {
  let text = req.current;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const over = text.length > req.maxChars ? ` The current version is ${text.length} characters, which is too long.` : "";
    const { text: rewritten } = await call({
      schema: Rewrite,
      system: REGENERATE_SYSTEM,
      effort: "low",
      maxTokens: 8000,
      content: [
        textBlock(questionnaireText(req.questionnaire)),
        textBlock(
          `Rewrite this ${req.label}. Hard limit: ${req.maxChars} characters.${over}\n\nInstruction: ${req.instruction}\n\nCurrent text:\n${text}`,
        ),
      ],
    });
    text = rewritten.trim();
    if (text.length <= req.maxChars) return text;
  }
  return truncateAtBoundary(text, req.maxChars);
}

/** Cuts to the last sentence end (or word) that fits. */
export function truncateAtBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "), head.lastIndexOf("\n"));
  if (sentence > maxChars * 0.6) return head.slice(0, sentence + 1).trim();
  const word = head.lastIndexOf(" ");
  return (word > 0 ? head.slice(0, word) : head).trim();
}
