// Google Photos Picker API. The user picks photos in Google's own UI (pickerUri);
// we then list and download only those items with the user's OAuth token
// (scope photospicker.mediaitems.readonly).
// https://developers.google.com/photos/picker/reference/rest

const API = "https://photospicker.googleapis.com/v1";
export const MAX_PICKED_ITEMS = 200;
const DOWNLOAD_SIZE = "w1600-h1600";

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface PickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  pollingConfig?: { pollInterval?: string; timeoutIn?: string };
}

interface PickedMediaItem {
  id: string;
  type: "PHOTO" | "VIDEO" | "TYPE_UNSPECIFIED";
  mediaFile: { baseUrl: string; mimeType: string; filename?: string };
}

async function google<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new GoogleApiError(`Google Photos ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`, res.status);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function createSession(token: string): Promise<PickerSession> {
  return google(token, "/sessions", {
    method: "POST",
    body: JSON.stringify({ pickingConfig: { maxItemCount: String(MAX_PICKED_ITEMS) } }),
  });
}

export function getSession(token: string, sessionId: string): Promise<PickerSession> {
  return google(token, `/sessions/${encodeURIComponent(sessionId)}`);
}

export async function deleteSession(token: string, sessionId: string): Promise<void> {
  await google(token, `/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

export async function listPickedPhotos(token: string, sessionId: string): Promise<PickedMediaItem[]> {
  const items: PickedMediaItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ sessionId, pageSize: "100", ...(pageToken ? { pageToken } : {}) });
    const page = await google<{ mediaItems?: PickedMediaItem[]; nextPageToken?: string }>(token, `/mediaItems?${params}`);
    items.push(...(page.mediaItems ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items.filter((i) => i.type === "PHOTO");
}

export async function downloadPhoto(token: string, item: PickedMediaItem): Promise<Buffer> {
  const res = await fetch(`${item.mediaFile.baseUrl}=${DOWNLOAD_SIZE}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new GoogleApiError(`Downloading ${item.id} failed: ${res.status}`, res.status);
  return Buffer.from(await res.arrayBuffer());
}

/** "5s" → 5000. */
export function durationMs(duration: string | undefined, fallback: number): number {
  const seconds = duration ? Number.parseFloat(duration) : Number.NaN;
  return Number.isFinite(seconds) ? seconds * 1000 : fallback;
}
