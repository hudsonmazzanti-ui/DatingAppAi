import { HINGE, Questionnaire, TINDER } from "@datingappai/shared";
import { Hono, type Context } from "hono";
import sharp from "sharp";
import { z } from "zod";
import type { StructuredCaller } from "./claude.ts";
import { createSession, durationMs, getSession, GoogleApiError } from "./google/picker.ts";
import type { Job, JobStore } from "./jobs.ts";
import { rewriteText } from "./pipeline/regenerate.ts";

const StartBody = z.object({
  referenceIds: z.array(z.string()).min(1).max(2),
  questionnaire: Questionnaire,
});

const RewriteBody = z.discriminatedUnion("field", [
  z.object({ field: z.literal("tinder_bio"), instruction: z.string().min(1).max(300) }),
  z.object({ field: z.literal("hinge_answer"), index: z.number().int().min(0), instruction: z.string().min(1).max(300) }),
]);

const THUMB_EDGE = 400;

export interface AppOptions {
  jobs: JobStore;
  call: StructuredCaller;
  /** Shared code friends enter in the app, so strangers can't spend the Anthropic budget. */
  accessCode?: string;
}

export function createApp({ jobs, call, accessCode }: AppOptions) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.use("*", async (c, next) => {
    if (accessCode && c.req.header("x-access-code") !== accessCode) return c.json({ error: "Wrong access code." }, 401);
    await next();
  });

  // Lets the app check an access code before signing in to Google.
  app.get("/access", (c) => c.json({ ok: true }));

  app.onError((err, c) => {
    if (err instanceof z.ZodError) return c.json({ error: "Invalid request.", issues: err.issues }, 400);
    if (err instanceof GoogleApiError && err.status === 401) return c.json({ error: "Google sign-in expired." }, 401);
    console.error(err);
    return c.json({ error: "Something went wrong." }, 500);
  });

  const googleToken = (c: Context) => {
    const token = c.req.header("x-google-token");
    if (!token) throw new GoogleApiError("Missing Google token.", 401);
    return token;
  };

  const withJob = (c: Context): Job | undefined => jobs.get(c.req.param("id")!);

  app.post("/picker/sessions", async (c) => {
    const session = await createSession(googleToken(c));
    return c.json({
      id: session.id,
      // "/autoclose" makes Google close the picker tab once the user taps Done.
      pickerUri: `${session.pickerUri}/autoclose`,
      pollIntervalMs: durationMs(session.pollingConfig?.pollInterval, 3000),
    });
  });

  app.get("/picker/sessions/:id", async (c) => {
    const session = await getSession(googleToken(c), c.req.param("id"));
    return c.json({ ready: session.mediaItemsSet === true });
  });

  app.post("/jobs", async (c) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(await c.req.json());
    const job = jobs.createFromPicker(googleToken(c), sessionId);
    return c.json({ jobId: job.id }, 201);
  });

  app.get("/jobs/:id", (c) => {
    const job = withJob(c);
    if (!job) return c.json({ error: "Job not found or expired." }, 404);
    return c.json({
      status: job.status,
      detail: job.detail ?? null,
      error: job.error ?? null,
      photoIds: job.status === "downloading" ? [] : [...job.photos.keys()],
      profiles: job.profiles ?? null,
      warnings: job.warnings,
    });
  });

  app.get("/jobs/:id/photos/:photoId", async (c) => {
    const photo = withJob(c)?.photos.get(c.req.param("photoId"));
    if (!photo) return c.json({ error: "Photo not found." }, 404);
    const body =
      c.req.query("size") === "full"
        ? photo.full
        : await sharp(photo.scoring).resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside" }).jpeg({ quality: 75 }).toBuffer();
    return c.body(new Uint8Array(body), 200, { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" });
  });

  app.post("/jobs/:id/start", async (c) => {
    const job = withJob(c);
    if (!job) return c.json({ error: "Job not found or expired." }, 404);
    if (job.status !== "awaiting_reference") return c.json({ error: `Job is ${job.status}.` }, 409);
    const { referenceIds, questionnaire } = StartBody.parse(await c.req.json());
    if (referenceIds.some((id) => !job.photos.has(id))) return c.json({ error: "Unknown reference photo." }, 400);
    jobs.start(job, referenceIds, questionnaire);
    return c.json({ status: job.status }, 202);
  });

  app.post("/jobs/:id/rewrite", async (c) => {
    const job = withJob(c);
    if (!job?.profiles || !job.questionnaire) return c.json({ error: "Profile not ready." }, 409);
    const body = RewriteBody.parse(await c.req.json());
    const { profiles, questionnaire } = job;

    if (body.field === "tinder_bio") {
      if (!profiles.tinder) return c.json({ error: "No Tinder profile." }, 400);
      const text = await rewriteText(call, {
        label: "Tinder bio",
        current: profiles.tinder.bio,
        instruction: body.instruction,
        maxChars: TINDER.bioMaxChars,
        questionnaire,
      });
      profiles.tinder.bio = text;
      return c.json({ text });
    }

    const prompt = profiles.hinge?.prompts[body.index];
    if (!prompt) return c.json({ error: "No such Hinge prompt." }, 400);
    const text = await rewriteText(call, {
      label: `Hinge answer to the prompt "${prompt.prompt}"`,
      current: prompt.answer,
      instruction: body.instruction,
      maxChars: HINGE.promptAnswerMaxChars,
      questionnaire,
    });
    prompt.answer = text;
    return c.json({ text });
  });

  app.delete("/jobs/:id", (c) => {
    jobs.delete(c.req.param("id"));
    return c.body(null, 204);
  });

  return app;
}
