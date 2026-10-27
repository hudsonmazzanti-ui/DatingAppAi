import type { PhotoScore } from "@datingappai/shared";
import sharp from "sharp";
import type { StructuredCaller, StructuredRequest } from "../src/claude.ts";

/** A JPEG with camera EXIF and GPS tags, like a phone photo. */
export async function phoneJpeg(width = 3000, height = 2000, color = { r: 200, g: 120, b: 80 }): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg()
    .withExif({
      IFD0: { Make: "TestPhone", Model: "X1" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 46/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "122/1 25/1 0/1" },
    })
    .toBuffer();
}

/** A JPEG of smooth seeded noise, so different seeds give clearly different difference hashes. */
export async function patternJpeg(seed: number): Promise<Buffer> {
  let state = seed * 2654435761;
  const random = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 255;
  // 9x8 random grid, scaled up so the hash (taken at 9x8) sees it directly.
  const grid = Buffer.from(Array.from({ length: 9 * 8 * 3 }, random));
  return sharp(grid, { raw: { width: 9, height: 8, channels: 3 } })
    .resize(90, 80, { kernel: "nearest" })
    .jpeg({ quality: 95 })
    .toBuffer();
}

export function score(id: string, overrides: Partial<PhotoScore> = {}): PhotoScore {
  return {
    photo_id: id,
    user_present: true,
    user_is_clear_subject: true,
    face_visible: true,
    people_count: 1,
    shot_type: "mid",
    setting: "park",
    activity: "posing",
    lighting: 7,
    sharpness: 7,
    expression: 7,
    composition: 7,
    overall: 7,
    flags: [],
    vibe_tags: [],
    story_hook: "",
    outfit: "t-shirt",
    ...overrides,
  };
}

/** A StructuredCaller that answers from a queue (or a function) and records every request. */
export function stubCaller(responses: unknown[] | ((req: StructuredRequest<any>) => unknown)) {
  const requests: StructuredRequest<any>[] = [];
  const call = (async (req: StructuredRequest<any>) => {
    requests.push(req);
    const response = typeof responses === "function" ? responses(req) : responses.shift();
    if (response === undefined) throw new Error("stubCaller: no response queued");
    return req.schema.parse(response);
  }) as StructuredCaller;
  return { call, requests };
}
