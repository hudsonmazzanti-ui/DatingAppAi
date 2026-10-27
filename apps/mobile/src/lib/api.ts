import type { GeneratedProfiles, JobStatus, Questionnaire } from "@datingappai/shared";
import { accessToken } from "./google.ts";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

let accessCode = "";
export function setAccessCode(code: string) {
  accessCode = code;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { google?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-access-code": accessCode };
  if (init.google) headers["x-google-token"] = await accessToken();
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status}).`, res.status);
  return body as T;
}

export interface JobState {
  status: JobStatus;
  detail: string | null;
  error: string | null;
  photoIds: string[];
  profiles: GeneratedProfiles | null;
  warnings: string[];
}

export const api = {
  checkAccess: () => request<{ ok: true }>("/access"),
  createPickerSession: () =>
    request<{ id: string; pickerUri: string; pollIntervalMs: number }>("/picker/sessions", { method: "POST", google: true }),
  pickerSession: (id: string) => request<{ ready: boolean }>(`/picker/sessions/${id}`, { google: true }),
  createJob: (sessionId: string) =>
    request<{ jobId: string }>("/jobs", { method: "POST", google: true, body: JSON.stringify({ sessionId }) }),
  job: (id: string) => request<JobState>(`/jobs/${id}`),
  startJob: (id: string, referenceIds: string[], questionnaire: Questionnaire) =>
    request<{ status: JobStatus }>(`/jobs/${id}/start`, {
      method: "POST",
      body: JSON.stringify({ referenceIds, questionnaire }),
    }),
  rewrite: (id: string, body: { field: "tinder_bio"; instruction: string } | { field: "hinge_answer"; index: number; instruction: string }) =>
    request<{ text: string }>(`/jobs/${id}/rewrite`, { method: "POST", body: JSON.stringify(body) }),
  deleteJob: (id: string) => request<null>(`/jobs/${id}`, { method: "DELETE" }),
};

/** Source for expo-image; the photo endpoints need the access code header. */
export function photoSource(jobId: string, photoId: string, size: "thumb" | "full" = "thumb") {
  return { uri: `${API_URL}/jobs/${jobId}/photos/${photoId}?size=${size}`, headers: { "x-access-code": accessCode } };
}
