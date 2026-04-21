/**
 * Background removal for pixel art images.
 *
 * Two modes:
 *
 * 1. **Chromakey mode** (when `targetColor` is provided):
 *    Scan every pixel and set those within `tolerance` of the target color to
 *    transparent. Works like a green-screen — reliable for distinctive
 *    background colors (e.g. #FF00FF magenta) and handles enclosed regions.
 *
 * 2. **Flood-fill mode** (default, when `targetColor` is omitted):
 *    Detect background color from corner pixels, then BFS flood-fill from
 *    image edges. Only removes background pixels CONNECTED to the edges.
 */

import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

export interface RemoveBackgroundOptions {
  /** Max color distance (Euclidean in RGB space) to consider as background. Default: 30. */
  tolerance?: number;
  /**
   * Explicit background color to match (e.g. { r: 255, g: 0, b: 255 }).
   * When provided, uses global chromakey scan instead of edge flood-fill.
   */
  targetColor?: { r: number; g: number; b: number };
  /**
   * After background removal, erode the alpha boundary by this many pixels.
   * Removes anti-aliased fringe where character color blends with background.
   * Default: 0 (no erosion). Recommended: 1–2 for chromakey mode.
   */
  erodePixels?: number;
}

export interface RemoveBackgroundResult {
  dataUrl: string;
  sizeBytes: number;
  detectedColor: string;
  pixelsRemoved: number;
}

/**
 * Remove the solid-color background from an image data URL.
 *
 * Accepts `data:image/png;base64,...` (PNG only — other formats will throw).
 * Returns a new data URL with transparent background.
 */
export function removeBackground(
  imageDataUrl: string,
  options: RemoveBackgroundOptions = {},
): RemoveBackgroundResult {
  const { tolerance = 20, targetColor, erodePixels = 0 } = options;

  const base64Data = imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
  const inputBuffer = Buffer.from(base64Data, 'base64');

  const isJpeg =
    inputBuffer[0] === 0xff && inputBuffer[1] === 0xd8 && inputBuffer[2] === 0xff;

  let png: PNG;
  if (isJpeg) {
    const decoded = jpeg.decode(inputBuffer, { useTArray: true, formatAsRGBA: true });
    png = new PNG({ width: decoded.width, height: decoded.height });
    Buffer.from(decoded.data.buffer).copy(png.data);
  } else {
    png = PNG.sync.read(inputBuffer);
  }

  const { width, height, data } = png;

  const bgColor = targetColor ?? detectBackgroundColor(data, width, height);
  const tolSq = tolerance * tolerance;
  let pixelsRemoved = 0;

  if (targetColor) {
    pixelsRemoved = chromakeyScan(data, width, height, bgColor, tolSq);
  } else {
    pixelsRemoved = floodFillFromEdges(data, width, height, bgColor, tolSq);
  }

  if (erodePixels > 0) {
    pixelsRemoved += erodeAlpha(data, width, height, erodePixels);
  }

  const outputBuffer = PNG.sync.write(png);
  const outputBase64 = outputBuffer.toString('base64');

  return {
    dataUrl: `data:image/png;base64,${outputBase64}`,
    sizeBytes: outputBuffer.length,
    detectedColor: colorToHex(bgColor),
    pixelsRemoved,
  };
}

/** Chromakey: scan every pixel, set matching ones to transparent. */
function chromakeyScan(
  data: Buffer,
  width: number,
  height: number,
  bg: { r: number; g: number; b: number },
  tolSq: number,
): number {
  const total = width * height;
  let removed = 0;
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const dr = data[off]! - bg.r;
    const dg = data[off + 1]! - bg.g;
    const db = data[off + 2]! - bg.b;
    if (dr * dr + dg * dg + db * db <= tolSq) {
      data[off + 3] = 0;
      removed++;
    }
  }
  return removed;
}

/** Flood-fill: BFS from edge pixels that match background color. */
function floodFillFromEdges(
  data: Buffer,
  width: number,
  height: number,
  bgColor: { r: number; g: number; b: number },
  tolSq: number,
): number {
  const visited = new Uint8Array(width * height);
  let pixelsRemoved = 0;
  const queue: number[] = [];

  const colorDistSq = (pixelIdx: number): number => {
    const off = pixelIdx * 4;
    const dr = data[off]! - bgColor.r;
    const dg = data[off + 1]! - bgColor.g;
    const db = data[off + 2]! - bgColor.b;
    return dr * dr + dg * dg + db * db;
  };

  const seedIfMatch = (x: number, y: number): void => {
    const idx = y * width + x;
    if (visited[idx]) return;
    if (colorDistSq(idx) <= tolSq) {
      visited[idx] = 1;
      queue.push(idx);
    }
  };

  for (let x = 0; x < width; x++) {
    seedIfMatch(x, 0);
    seedIfMatch(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    seedIfMatch(0, y);
    seedIfMatch(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++]!;
    const x = idx % width;
    const y = (idx - x) / width;

    data[idx * 4 + 3] = 0;
    pixelsRemoved++;

    const neighbors = [
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1,
    ];

    for (const nIdx of neighbors) {
      if (nIdx < 0 || visited[nIdx]) continue;
      if (colorDistSq(nIdx) <= tolSq) {
        visited[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  return pixelsRemoved;
}

/**
 * Erode alpha boundary: for N iterations, set any opaque pixel adjacent to
 * a transparent pixel to transparent. Strips anti-aliased fringe.
 */
function erodeAlpha(
  data: Buffer,
  width: number,
  height: number,
  iterations: number,
): number {
  let totalEroded = 0;

  for (let iter = 0; iter < iterations; iter++) {
    const toErase: number[] = [];
    const total = width * height;

    for (let i = 0; i < total; i++) {
      if (data[i * 4 + 3] === 0) continue;

      const x = i % width;
      const y = (i - x) / width;

      const hasTransparentNeighbor =
        (y > 0 && data[(i - width) * 4 + 3] === 0) ||
        (y < height - 1 && data[(i + width) * 4 + 3] === 0) ||
        (x > 0 && data[(i - 1) * 4 + 3] === 0) ||
        (x < width - 1 && data[(i + 1) * 4 + 3] === 0);

      if (hasTransparentNeighbor) {
        toErase.push(i);
      }
    }

    for (const i of toErase) {
      data[i * 4 + 3] = 0;
    }
    totalEroded += toErase.length;
  }

  return totalEroded;
}

/**
 * Detect background color by averaging the 4 corner pixels.
 */
function detectBackgroundColor(
  data: Buffer,
  width: number,
  height: number,
): { r: number; g: number; b: number } {
  const pixelAt = (x: number, y: number) => {
    const off = (y * width + x) * 4;
    return { r: data[off]!, g: data[off + 1]!, b: data[off + 2]! };
  };

  const corners = [
    pixelAt(0, 0),
    pixelAt(width - 1, 0),
    pixelAt(0, height - 1),
    pixelAt(width - 1, height - 1),
  ];

  return {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4),
  };
}

function colorToHex(c: { r: number; g: number; b: number }): string {
  return (
    '#' +
    [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')
  );
}
