import sharp from "sharp";

export interface PreparedPhoto {
  id: string;
  /** Full-size JPEG (max 1600px), EXIF/GPS stripped. What the user saves and uploads. */
  full: Buffer;
  /** Small JPEG (max 1024px) sent to Claude for scoring. */
  scoring: Buffer;
  /** 64-bit difference hash as a hex string, for near-duplicate detection. */
  hash: string;
  sharpness: number;
}

const FULL_EDGE = 1600;
const SCORING_EDGE = 1024;
/** Hashes this close (out of 64 bits) are treated as the same shot. */
export const DUPLICATE_DISTANCE = 6;

export async function prepPhoto(id: string, input: Buffer): Promise<PreparedPhoto> {
  // rotate() applies the EXIF orientation; sharp drops all metadata (EXIF, GPS,
  // XMP) on output unless withMetadata() is called, which we never do.
  const base = sharp(input, { failOn: "none" }).rotate();
  const full = await base
    .clone()
    .resize(FULL_EDGE, FULL_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  const scoring = await sharp(full)
    .resize(SCORING_EDGE, SCORING_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  const [hash, stats] = await Promise.all([dHash(full), sharp(full).stats()]);
  return { id, full, scoring, hash, sharpness: stats.sharpness };
}

export async function dHash(input: Buffer): Promise<string> {
  const pixels = await sharp(input).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels[row * 9 + col]!;
      const right = pixels[row * 9 + col + 1]!;
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

export function hammingDistance(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/** Collapses bursts of near-identical shots, keeping the sharpest of each. */
export function dedupe<T extends Pick<PreparedPhoto, "hash" | "sharpness">>(photos: T[]): T[] {
  const kept: T[] = [];
  const bySharpness = [...photos].sort((a, b) => b.sharpness - a.sharpness);
  for (const photo of bySharpness) {
    if (!kept.some((k) => hammingDistance(k.hash, photo.hash) <= DUPLICATE_DISTANCE)) kept.push(photo);
  }
  // Keep the caller's original order for everything that survived.
  return photos.filter((p) => kept.includes(p));
}
