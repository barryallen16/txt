import { beforeEach, describe, expect, mock, test } from "bun:test";

const calls = [];
let sizes = {};
let always = null;

function fakeSize(width) {
  return always == null ? (sizes[width] ?? 900) : always;
}

mock.module("expo", () => ({
  requireOptionalNativeModule: (name) =>
    name === "OffTxtSms"
      ? {
          compressImage: async (_uri, width) => {
            calls.push(width);
            const size = fakeSize(width);
            const base64 = Buffer.alloc(size, 65).toString("base64");
            return {
              base64,
              bytes: size,
              width,
              height: Math.round(width * 0.75),
            };
          },
        }
      : null,
}));

mock.module("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: async () => {
    throw new Error("the native compressor should handle this test");
  },
}));

const {
  COMPRESSION_PRESETS,
  DEFAULT_PRESET,
  TARGET_BYTES,
  compressToTarget,
  getCompressionPreset,
  partsForBytes,
} = await import("./image");

describe("picture compression presets", () => {
  beforeEach(() => {
    calls.length = 0;
    sizes = {};
    always = null;
  });

  test("the default preset targets about thirteen SMS parts", () => {
    expect(TARGET_BYTES).toBe(1200);
    expect(DEFAULT_PRESET).toBe("fast");
    expect(partsForBytes(TARGET_BYTES)).toBe(13);
    expect(COMPRESSION_PRESETS.map((preset) => preset.id)).toEqual([
      "fast",
      "balanced",
      "high",
    ]);
  });

  test("fast stops at the first frame under its target", async () => {
    sizes = { 240: 900 };
    const result = await compressToTarget("file:///photo.jpg", "fast");

    expect(calls).toEqual([240]);
    expect(result.bytes).toBe(900);
    expect(result.bytes).toBeLessThanOrEqual(1200);
    expect(result.parts).toBeLessThanOrEqual(13);
    expect(result).toMatchObject({
      compressed: true,
      preset: "fast",
      target: 1200,
    });
  });

  test("balanced and high keep more pixels inside their budgets", async () => {
    sizes = { 320: 1600, 480: 2450 };

    const balanced = await compressToTarget("file:///photo.jpg", "balanced");
    const high = await compressToTarget("file:///photo.jpg", "high");

    expect(balanced.bytes).toBeLessThanOrEqual(balanced.target);
    expect(balanced.target).toBe(1800);
    expect(balanced.parts).toBe(17);
    expect(high.bytes).toBeLessThanOrEqual(high.target);
    expect(high.target).toBe(2800);
    expect(high.parts).toBe(26);
    expect(high.width).toBe(480);
  });

  test("steps all the way down to 180px when every frame is too heavy", async () => {
    always = 5000;
    const result = await compressToTarget("file:///photo.jpg", "fast");

    expect(calls).toEqual([240, 220, 200, 180]);
    expect(result.width).toBe(180);
    expect(result.bytes).toBe(5000);
    expect(result.preset).toBe("fast");
  });

  test("unknown preset names fall back to fast", () => {
    expect(getCompressionPreset("nope").id).toBe("fast");
    expect(getCompressionPreset().id).toBe("fast");
  });
});
