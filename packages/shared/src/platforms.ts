export type Platform = "tinder" | "hinge";

export const TINDER = {
  maxPhotos: 9,
  recommendedPhotos: 6,
  bioMaxChars: 500,
  maxInterests: 5,
  jobTitleMaxChars: 50,
} as const;

export const HINGE = {
  photos: 6,
  prompts: 3,
  promptAnswerMaxChars: 150,
  captionMaxChars: 40,
} as const;

// A subset of Hinge's written prompts. Claude must pick from this list so the
// user can find the exact prompt in the app.
export const HINGE_PROMPTS = [
  "A life goal of mine",
  "A shower thought I recently had",
  "All I ask is that you",
  "Dating me is like",
  "Don't hate me if I",
  "Give me travel tips for",
  "Green flags I look for",
  "I bet you can't",
  "I geek out on",
  "I go crazy for",
  "I recently discovered that",
  "I want someone who",
  "I won't shut up about",
  "I'll fall for you if",
  "I'm convinced that",
  "I'm looking for",
  "I'm weirdly attracted to",
  "Let's debate this topic",
  "My greatest strength",
  "My love language is",
  "My most irrational fear",
  "My simple pleasures",
  "Never have I ever",
  "One thing I'll never do again",
  "Our first date will be",
  "Something that's non-negotiable for me is",
  "Teach me something about",
  "The hallmark of a good relationship is",
  "The key to my heart is",
  "The way to win me over is",
  "Together, we could",
  "Two truths and a lie",
  "Typical Sunday",
  "Unusual skills",
  "We'll get along if",
  "What I order for the table",
  "You should *not* go out with me if",
  "I'm the type of texter who",
  "My cry-in-the-car song is",
  "This year, I really want to",
] as const;

export type HingePrompt = (typeof HINGE_PROMPTS)[number];

// Rules for choosing and ordering photos, shared by the assembly prompt and the validator.
export const PHOTO_RULES = [
  "Photo 1 is a clear, well-lit solo shot where the user's face is visible and they look approachable (ideally smiling). No sunglasses, no group, no heavy filter.",
  "Include at least one full-body or mid-length shot so matches know what the user looks like.",
  "Include at least one photo of the user doing an activity, hobby or travel that gives a match something to ask about.",
  "Use at most one group photo, and only one where the user is obviously the main subject. Never put a group photo first.",
  "Avoid near-repeats: no two photos with the same outfit and setting.",
  "Never use photos flagged for: face hidden, heavy filter, possible ex/partner, someone else's child, bathroom or messy background, user hard to identify.",
  "Mirror selfies only if there is nothing better, and never first.",
  "Order the rest for variety: alternate close-ups with wider shots and indoor with outdoor.",
] as const;

export const TEXT_RULES = [
  "Write in the user's voice using their real details. Specific beats generic: name the actual hobby, place or story.",
  "Every text item should give a match an easy, obvious thing to reply to.",
  "No clichés: avoid 'love to laugh', 'partner in crime', 'work hard play hard', 'fluent in sarcasm', 'just ask', 'here for a good time'.",
  "No negativity, no lists of dealbreakers, no height or income demands.",
  "Keep emoji to at most two per item, and only if they fit the chosen tone.",
  "Never invent facts that the user did not give or that are not visible in their photos.",
] as const;
