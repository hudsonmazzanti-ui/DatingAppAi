import { z } from "zod";

// Schemas sent to Claude as structured outputs. Length and count limits are
// deliberately not encoded here (structured outputs ignore most of them); the
// validator in the API enforces them against platforms.ts instead.

export const PhotoFlag = z.enum([
  "face_hidden",
  "heavy_filter",
  "mirror_selfie",
  "possible_ex_or_partner",
  "someone_elses_child",
  "bathroom_or_messy_background",
  "user_hard_to_identify",
  "blurry",
  "holding_fish",
  "holding_weapon",
  "screenshot_or_meme",
]);
export type PhotoFlag = z.infer<typeof PhotoFlag>;

export const PhotoScore = z.object({
  photo_id: z.string(),
  user_present: z.boolean().describe("The user (from the reference photos) appears in this photo."),
  user_is_clear_subject: z.boolean().describe("The user is obviously the main subject."),
  face_visible: z.boolean(),
  people_count: z.number().int(),
  shot_type: z.enum(["close_up", "mid", "full_body", "no_user"]),
  setting: z.string().describe("Short description, e.g. 'beach at sunset', 'kitchen'."),
  activity: z.string().describe("What the user is doing, or 'posing' if nothing."),
  lighting: z.number().int().describe("1-10"),
  sharpness: z.number().int().describe("1-10"),
  expression: z.number().int().describe("1-10: how warm and approachable the user looks."),
  composition: z.number().int().describe("1-10"),
  overall: z.number().int().describe("1-10: how much this photo helps a dating profile."),
  // Plain strings so one unexpected value can't fail a whole batch; score.ts keeps only known flags.
  flags: z.array(z.string()).describe(`Zero or more of: ${PhotoFlag.options.join(", ")}.`),
  vibe_tags: z.array(z.string()).describe("2-4 words like adventurous, social, creative, outdoorsy."),
  story_hook: z.string().describe("Something a match could message about, or empty."),
  outfit: z.string().describe("Short outfit description, used to avoid near-repeats."),
});
export type PhotoScore = z.infer<typeof PhotoScore>;

export const PhotoScoreBatch = z.object({ photos: z.array(PhotoScore) });

export const PhotoPick = z.object({
  photo_id: z.string(),
  reason: z.string().describe("One short sentence on why this photo is in this slot."),
});

export const TinderProfile = z.object({
  photos: z.array(PhotoPick),
  bio: z.string(),
  bio_alternatives: z.array(z.string()),
  interests: z.array(z.string()),
  job_title: z.string(),
  anthem: z.string().describe("Song suggestion as 'Artist - Title'."),
});
export type TinderProfile = z.infer<typeof TinderProfile>;

export const HingePromptAnswer = z.object({
  prompt: z.string().describe("Exactly one of the provided Hinge prompts."),
  answer: z.string(),
  alternatives: z.array(z.string()),
});

export const HingeProfile = z.object({
  photos: z.array(PhotoPick.extend({ caption: z.string().describe("Optional short caption, or empty.") })),
  prompts: z.array(HingePromptAnswer),
});
export type HingeProfile = z.infer<typeof HingeProfile>;

export const GeneratedProfiles = z.object({
  tinder: TinderProfile.nullable(),
  hinge: HingeProfile.nullable(),
  tips: z.array(z.string()).describe("1-3 short tips, e.g. a type of photo worth taking."),
});
export type GeneratedProfiles = z.infer<typeof GeneratedProfiles>;

// Request-side schemas (validated by the API, not sent to Claude).

export const Questionnaire = z.object({
  firstName: z.string().min(1).max(40),
  age: z.number().int().min(18).max(99),
  job: z.string().max(80).default(""),
  interests: z.array(z.string().max(40)).max(10).default([]),
  lookingFor: z.string().max(200).default(""),
  tone: z.enum(["funny", "warm", "direct"]).default("warm"),
  funFacts: z.array(z.string().max(200)).max(5).default([]),
  platforms: z.array(z.enum(["tinder", "hinge"])).min(1).default(["tinder", "hinge"]),
});
export type Questionnaire = z.infer<typeof Questionnaire>;

export const JobStatus = z.enum([
  "downloading",
  "awaiting_reference",
  "scoring",
  "writing",
  "done",
  "failed",
]);
export type JobStatus = z.infer<typeof JobStatus>;
