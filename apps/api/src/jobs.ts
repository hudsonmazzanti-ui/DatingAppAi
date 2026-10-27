import { randomUUID } from "node:crypto";
import type { GeneratedProfiles, JobStatus, Questionnaire } from "@datingappai/shared";
import type { StructuredCaller } from "./claude.ts";
import { deleteSession, downloadPhoto, listPickedPhotos } from "./google/picker.ts";
import type { PreparedPhoto } from "./pipeline/prep.ts";
import { prepAll, runPipeline } from "./pipeline/run.ts";

/** Jobs and their photos are kept in memory only, and dropped after this long. */
export const JOB_TTL_MS = 60 * 60 * 1000;
const DOWNLOAD_CONCURRENCY = 6;

export interface Job {
  id: string;
  createdAt: number;
  status: JobStatus;
  detail?: string;
  error?: string;
  photos: Map<string, PreparedPhoto>;
  questionnaire?: Questionnaire;
  profiles?: GeneratedProfiles;
  warnings: string[];
}

export class JobStore {
  private jobs = new Map<string, Job>();

  constructor(private call: StructuredCaller) {
    setInterval(() => this.sweep(), 5 * 60 * 1000).unref();
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  delete(id: string): boolean {
    return this.jobs.delete(id);
  }

  /** Creates a job and downloads the photos picked in a Picker session in the background. */
  createFromPicker(token: string, sessionId: string): Job {
    const job = this.newJob();
    void this.download(job, token, sessionId).catch((err) => this.fail(job, err));
    return job;
  }

  /** Starts scoring and writing once the user has chosen their reference photos. */
  start(job: Job, referenceIds: string[], questionnaire: Questionnaire): void {
    job.questionnaire = questionnaire;
    job.status = "scoring";
    void runPipeline(this.call, { photos: [...job.photos.values()], referenceIds, questionnaire }, (u) => {
      job.status = u.status;
      job.detail = u.detail;
    })
      .then((result) => {
        job.profiles = result.profiles;
        job.warnings.push(...result.warnings);
        job.status = "done";
        job.detail = undefined;
      })
      .catch((err) => this.fail(job, err));
  }

  private newJob(): Job {
    const job: Job = { id: randomUUID(), createdAt: Date.now(), status: "downloading", photos: new Map(), warnings: [] };
    this.jobs.set(job.id, job);
    return job;
  }

  private async download(job: Job, token: string, sessionId: string) {
    const items = await listPickedPhotos(token, sessionId);
    job.detail = `0 of ${items.length} photos`;
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < items.length) {
        const index = next++;
        const item = items[index]!;
        // Short ids keep Claude's prompts compact and don't leak Google's ids.
        const id = `p_${index + 1}`;
        const { prepared, skipped } = await prepAll([{ id, data: await downloadPhoto(token, item) }]);
        if (prepared[0]) job.photos.set(id, prepared[0]);
        if (skipped.length) job.warnings.push(`Skipped a photo that couldn't be read (${item.mediaFile.filename ?? id}).`);
        job.detail = `${++done} of ${items.length} photos`;
      }
    };
    await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
    // The picked photos are now ours to process; Google recommends deleting the session.
    await deleteSession(token, sessionId).catch(() => {});
    // Downloads finish out of order; keep the order the user picked them in.
    job.photos = new Map([...job.photos].sort(([a], [b]) => Number(a.slice(2)) - Number(b.slice(2))));
    job.status = "awaiting_reference";
    job.detail = undefined;
  }

  private fail(job: Job, err: unknown) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
    console.error(`job ${job.id} failed:`, err);
  }

  private sweep() {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of this.jobs) if (job.createdAt < cutoff) this.jobs.delete(id);
  }
}
