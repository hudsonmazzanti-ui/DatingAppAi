import { HINGE, HINGE_PROMPTS, PHOTO_RULES, TEXT_RULES, TINDER, type Questionnaire } from "@datingappai/shared";

const bullets = (lines: readonly string[]) => lines.map((l) => `- ${l}`).join("\n");

export const SCORE_SYSTEM = `You help someone build a dating profile from their own photos. You are scoring candidate photos so the best ones can be chosen for Tinder and Hinge.

The first images in each request are reference photos of the user, labelled "REFERENCE". Use them only to tell which person in each candidate photo is the user. Do not score the reference photos.

Each candidate photo is preceded by a label like "PHOTO p_3". Return exactly one entry per candidate photo, using that id as photo_id, in the same order.

How to score:
- Judge each photo as a dating profile photo: does it show clearly what the user looks like, do they look warm and approachable, and does it say something about their life?
- Scores are integers from 1 to 10. Be discriminating: a typical phone snapshot is a 5, and a 9 or 10 is a photo that would stand out on any profile.
- "overall" should heavily penalise photos where the user is absent, tiny, hard to pick out, or facing away.
- If the user is not in the photo, set user_present false, shot_type "no_user", overall 1 or 2, and still fill every field.
- Only add a flag when you can actually see the problem. "possible_ex_or_partner" means the user is in an intimate or couple-style pose with one other person.
- story_hook is a specific, concrete detail a match could ask about (e.g. "summit sign of Mount Whitney"), or an empty string if nothing stands out.`;

export function assembleSystem(): string {
  return `You turn someone's best photos and their own answers into a finished dating profile for Tinder and/or Hinge. They will copy what you write straight into the apps, so it must be ready to use.

You will get: candidate photos (each labelled "PHOTO <id>"), a JSON list of scores for those photos from an earlier pass, and the user's questionnaire.

Photo rules:
${bullets(PHOTO_RULES)}

Writing rules:
${bullets(TEXT_RULES)}

Tinder:
- Pick ${TINDER.recommendedPhotos} photos (up to ${TINDER.maxPhotos} only if there are that many strong, different ones), in display order.
- bio: at most ${TINDER.bioMaxChars} characters, ideally 150-300. A short hook beats a long list.
- bio_alternatives: 2 alternative bios in noticeably different styles.
- interests: exactly ${TINDER.maxInterests}, short (1-3 words each), drawn from the questionnaire and photos.
- job_title: at most ${TINDER.jobTitleMaxChars} characters, from the questionnaire; empty string if none given.

Hinge:
- Pick exactly ${HINGE.photos} photos, in display order. A caption is optional (at most ${HINGE.captionMaxChars} characters); use an empty string for no caption.
- Pick exactly ${HINGE.prompts} different prompts, copied exactly from this list:
${bullets(HINGE_PROMPTS)}
- Each answer is at most ${HINGE.promptAnswerMaxChars} characters. Give 2 alternative answers per prompt.
- Mix the prompts: one that shows personality or humour, one that's specific about how they spend their time, and one that invites a reply (a question, a debate, a "two truths and a lie").
- Hinge and Tinder may share photos, but the Hinge order should lead with the strongest face photo too.

If a platform is not requested, return null for it. Only use photo ids you were given. Add 1-3 tips about photos worth taking if the set is missing something (for example no full-body shot).`;
}

export function questionnaireText(q: Questionnaire): string {
  return `Questionnaire (the user's own words):
${JSON.stringify(q, null, 2)}`;
}

export const REGENERATE_SYSTEM = `You rewrite one piece of a dating profile. Follow the user's instruction, keep every fact true to the profile and questionnaire, and stay within the character limit you are given.

Writing rules:
${bullets(TEXT_RULES)}`;
