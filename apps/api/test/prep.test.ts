import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { dedupe, dHash, hammingDistance, prepPhoto } from "../src/pipeline/prep.ts";
import { patternJpeg, phoneJpeg } from "./helpers.ts";

describe("prepPhoto", () => {
  it("strips EXIF and GPS from every output", async () => {
    const input = await phoneJpeg();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const photo = await prepPhoto("p_1", input);
    for (const out of [photo.full, photo.scoring]) {
      const meta = await sharp(out).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
    }
    expect(photo.full.includes(Buffer.from("TestPhone"))).toBe(false);
  });

  it("resizes to the full and scoring sizes, keeping aspect ratio", async () => {
    const photo = await prepPhoto("p_1", await phoneJpeg(3000, 2000));
    expect(await sharp(photo.full).metadata()).toMatchObject({ width: 1600, height: 1067 });
    expect(await sharp(photo.scoring).metadata()).toMatchObject({ width: 1024, height: 683 });
  });

  it("does not enlarge small photos", async () => {
    const photo = await prepPhoto("p_1", await phoneJpeg(800, 600));
    expect(await sharp(photo.full).metadata()).toMatchObject({ width: 800, height: 600 });
  });

  it("rejects input that isn't an image", async () => {
    await expect(prepPhoto("p_1", Buffer.from("not an image"))).rejects.toThrow();
  });
});

describe("dedupe", () => {
  it("treats a re-encoded copy as a duplicate and keeps the sharper one", async () => {
    const original = await patternJpeg(1);
    const recompressed = await sharp(original).jpeg({ quality: 40 }).toBuffer();
    const different = await patternJpeg(4);
    const [a, b, c] = await Promise.all([original, recompressed, different].map(dHash));
    expect(hammingDistance(a!, b!)).toBeLessThanOrEqual(6);
    expect(hammingDistance(a!, c!)).toBeGreaterThan(6);

    const photos = [
      { id: "blurry", hash: b!, sharpness: 1 },
      { id: "sharp", hash: a!, sharpness: 5 },
      { id: "other", hash: c!, sharpness: 2 },
    ];
    expect(dedupe(photos).map((p) => p.id)).toEqual(["sharp", "other"]);
  });
});
