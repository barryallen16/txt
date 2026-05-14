// Photo to SMS parts.
//
// The native compressor downsizes, converts to greyscale, posterises and saves
// a low quality JPEG. The presets trade detail for fewer SMS parts: a 1.2 KB
// image is about 13 parts, while 2.8 KB is about 29. Without the native module
// (iOS, or a build missing it) we fall back to resizing alone.

import { requireOptionalNativeModule } from "expo";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  KIND,
  encodeTransferFromBase64,
  partCountEncoded,
} from "./transfer";

const native = requireOptionalNativeModule("OffTxtSms");

/**
 * A 153 character SMS carries 128 base64 characters, which is 96 raw bytes.
 * @param {number} bytes
 */
export function partsForBytes(bytes) {
  return Math.max(1, Math.ceil((Number(bytes) || 0) * (4 / 3) / 128));
}

export const COMPRESSION_PRESETS = [
  {
    id: "fast",
    label: "Fast",
    detail: "Smallest, about 12 SMS",
    target: 1200,
    ladder: [
      { width: 240, quality: 15, levels: 5 },
      { width: 220, quality: 14, levels: 4 },
      { width: 200, quality: 12, levels: 4 },
      { width: 180, quality: 10, levels: 4 },
    ],
    fallback: [
      { width: 240, compress: 0.18 },
      { width: 200, compress: 0.12 },
      { width: 180, compress: 0.09 },
      { width: 160, compress: 0.07 },
    ],
  },
  {
    id: "balanced",
    label: "Balanced",
    detail: "Faces and text, about 18 SMS",
    target: 1800,
    ladder: [
      { width: 320, quality: 20, levels: 6 },
      { width: 280, quality: 18, levels: 6 },
      { width: 240, quality: 15, levels: 5 },
      { width: 200, quality: 12, levels: 4 },
    ],
    fallback: [
      { width: 320, compress: 0.28 },
      { width: 280, compress: 0.2 },
      { width: 240, compress: 0.14 },
      { width: 200, compress: 0.1 },
    ],
  },
  {
    id: "high",
    label: "High detail",
    detail: "Receipts and signs, about 28 SMS",
    target: 2800,
    ladder: [
      { width: 480, quality: 25, levels: 8 },
      { width: 420, quality: 22, levels: 7 },
      { width: 360, quality: 18, levels: 6 },
      { width: 300, quality: 15, levels: 5 },
      { width: 240, quality: 12, levels: 4 },
    ],
    fallback: [
      { width: 480, compress: 0.4 },
      { width: 400, compress: 0.3 },
      { width: 320, compress: 0.2 },
      { width: 260, compress: 0.14 },
    ],
  },
];

export const DEFAULT_PRESET = "fast";
/** Bytes of the default preset. Kept for callers that only show one target. */
export const TARGET_BYTES = COMPRESSION_PRESETS[0].target;

/** @param {string} [id] */
export function getCompressionPreset(id = DEFAULT_PRESET) {
  return (
    COMPRESSION_PRESETS.find((preset) => preset.id === id) ??
    COMPRESSION_PRESETS[0]
  );
}

function resolvePreset(input) {
  if (typeof input === "number") {
    return { ...getCompressionPreset(DEFAULT_PRESET), target: input };
  }
  if (typeof input === "string") return getCompressionPreset(input);
  if (input && Number.isFinite(input.target)) return input;
  return getCompressionPreset(DEFAULT_PRESET);
}

/**
 * @param {string} uri local file or content uri
 * @param {string | number | object} [preset] preset id, target bytes, or preset
 * @returns {Promise<{ base64: string, bytes: number, width: number, height: number, parts: number, compressed: boolean, preset: string, target: number }>}
 */
export async function compressToTarget(uri, preset = DEFAULT_PRESET) {
  const choice = resolvePreset(preset);

  if (native?.compressImage) {
    let last = null;
    let nativeFailed = false;

    for (const step of choice.ladder) {
      try {
        const result = await native.compressImage(
          uri,
          step.width,
          step.quality,
          step.levels,
        );
        const bytes = Number(result?.bytes) || 0;
        last = { ...result, bytes, step };

        if (bytes > 0 && bytes <= choice.target) {
          return pack(result.base64, bytes, result.width, result.height, true, choice);
        }
      } catch {
        // A broken native build must not skip the resize-only path below.
        nativeFailed = true;
        break;
      }
    }

    if (!nativeFailed && last?.base64) {
      return pack(
        last.base64,
        last.bytes,
        last.width,
        last.height,
        true,
        choice,
      );
    }
  }

  let last = null;
  for (const step of choice.fallback) {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: step.width } }],
      { compress: step.compress, format: SaveFormat.JPEG, base64: true },
    );
    const bytes = base64Bytes(result.base64);
    last = { ...result, bytes };

    if (bytes <= choice.target) {
      return pack(
        result.base64,
        bytes,
        result.width,
        result.height,
        false,
        choice,
      );
    }
  }

  return pack(last.base64, last.bytes, last.width, last.height, false, choice);
}

function pack(base64, bytes, width, height, compressed, preset) {
  const size = bytes || base64Bytes(base64);
  return {
    base64,
    bytes: size,
    width: Number(width) || 0,
    height: Number(height) || 0,
    parts: partCountEncoded(base64),
    compressed,
    preset: preset.id,
    target: preset.target,
  };
}

/** Byte length of a base64 string. */
export function base64Bytes(base64) {
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/** Split the compressed JPEG into SMS parts. */
export function buildImageTransfer(base64) {
  return encodeTransferFromBase64(KIND.IMAGE, base64);
}

/** "3.1 KB" */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
