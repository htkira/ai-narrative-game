/**
 * 物品图标生成工作流
 *
 * 使用 Gemini Flash Image 生成像素古风风格的物品图标。
 * 按 iconTag 缓存到 server/cache/icons/{iconTag}.png，
 * 相同 iconTag 的物品共享同一图标文件。
 * category === 'special'（佛珠）跳过生成，使用固定图片。
 *
 * iconTag 仅用于缓存键，不传入 prompt。
 * 模型根据物品名称 + 描述生成图标。
 * 生成后自动进行 flood-fill 背景透明化处理。
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { openai, withRetry, type RetryOptions, type TokenUsage } from '../llm/index.js';
import { logLLMCall } from '../llm/logger.js';
import { LLMError, LLMEmptyResponseError } from '../llm/errors.js';
import { config } from '../config.js';
import { removeBackground } from './removeBackground.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON_CACHE_DIR = join(__dirname, '../../cache/icons');

// ---- Public types ----

export interface ItemIconInput {
  itemId: string;
  name: string;
  description: string;
  iconTag: string;
  category: string;
}

export interface ItemIconResult {
  itemId: string;
  iconTag: string;
  imageDataUrl: string;
  cached: boolean;
  mimeType: string;
  sizeBytes: number;
  usage: TokenUsage;
  durationMs: number;
}

export interface ItemIconBatchResult {
  icons: Map<string, string>;
  results: ItemIconResult[];
  totalUsage: TokenUsage;
  totalDurationMs: number;
  cacheHits: number;
  cacheMisses: number;
  skipped: number;
}

// ---- OpenRouter image response types ----

interface OpenRouterImageEntry {
  type: 'image_url';
  image_url: { url: string };
}

interface OpenRouterAssistantMessage {
  role: string;
  content: string | null;
  images?: OpenRouterImageEntry[];
}

// ---- Cache helpers ----

function ensureCacheDir(): void {
  mkdirSync(ICON_CACHE_DIR, { recursive: true });
}

function getCachePath(iconTag: string): string {
  return join(ICON_CACHE_DIR, `${iconTag}.png`);
}

function readCachedIcon(iconTag: string): string | null {
  const path = getCachePath(iconTag);
  if (!existsSync(path)) return null;
  try {
    const buffer = readFileSync(path);
    if (buffer.length < 100) return null;
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function writeCachedIcon(iconTag: string, base64Data: string): void {
  ensureCacheDir();
  const buffer = Buffer.from(base64Data, 'base64');
  writeFileSync(getCachePath(iconTag), buffer);
}

// ---- Prompt ----

function buildIconPrompt(name: string, description: string): string {
  return [
    'Generate a single item icon for a Chinese supernatural mystery pixel art game.',
    '',
    `Item name: ${name}`,
    `Visual reference: ${description}`,
    '',
    'STRICT style requirements (follow ALL precisely):',
    '- HIGH-DETAIL pixel art with visible crisp pixels — like a hand-crafted RPG inventory icon',
    '- The item should be rendered at roughly 240×240 pixel scale with rich detail',
    '- Slightly isometric / 3D perspective, giving the item volume and depth',
    '- Ancient Chinese (古风) visual theme — materials, shapes and textures from rural mountain-village life',
    '- Single item centered, filling about 70-80% of the square canvas',
    '- PURE MAGENTA (#FF00FF) solid background — every background pixel must be exactly #FF00FF, no gradients, no vignette, no surface/shadow',
    '- NEVER use pink, magenta, or purple tones on the item itself — reserve #FF00FF strictly for background',
    '- Warm earth-tone palette: browns, ambers, muted greens, aged wood, tarnished metal, faded cloth',
    '- Strong dark outline around the item for a clean silhouette',
    '- Visible material textures: wood grain, cloth weave, ceramic cracks, rope fibers, metal patina',
    '- The icon must look like a hand-crafted pixel art game asset, NOT photorealistic',
    '',
    'ABSOLUTE TEXT BAN (THIS IS THE MOST IMPORTANT RULE):',
    '- ZERO text of any kind anywhere in the image — not on the item, not on the background, NOWHERE',
    '- NO Chinese characters (汉字), NO English letters, NO numbers, NO symbols, NO glyphs',
    '- NO writing, inscriptions, engravings, labels, signs, tags, stamps, seals, or calligraphy',
    '- NO text carved into the item surface, NO text printed/painted on the item',
    '- NO scroll text, NO book text, NO paper text, NO label text — if the item is a scroll or book, show it CLOSED or show only blank pages/surface',
    '- If the item logically contains text (e.g. prescription, scroll, letter), depict it as abstract ink marks, smudges, or illegible scribbles — NEVER readable characters',
    '- Any violation of this rule makes the entire icon INVALID',
  ].join('\n');
}

// ---- Single icon generation ----

async function generateSingleIcon(
  name: string,
  description: string,
  iconTag: string,
  retryOpts: RetryOptions = {},
): Promise<{ imageDataUrl: string; usage: TokenUsage; durationMs: number }> {
  const prompt = buildIconPrompt(name, description);
  const model = config.openRouter.imageModel;
  const startTime = Date.now();

  const requestBody = {
    model,
    messages: [{ role: 'user' as const, content: prompt }],
    modalities: ['image', 'text'],
    image_config: { aspect_ratio: '1:1', image_size: '1K' },
  };

  const result = await withRetry(
    async () => {
      const raw = await openai.chat.completions.create(
        requestBody as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
      );
      return raw as OpenAI.Chat.ChatCompletion;
    },
    retryOpts,
  );

  const durationMs = Date.now() - startTime;
  const message = result.choices[0]?.message as unknown as OpenRouterAssistantMessage;
  const images = message?.images;

  if (!images || images.length === 0) {
    throw new LLMEmptyResponseError('No icon image generated');
  }

  let imageDataUrl = images[0]!.image_url.url;
  if (!imageDataUrl.startsWith('data:image/')) {
    throw new LLMError(
      `Invalid icon data URL: ${imageDataUrl.substring(0, 60)}...`,
      'INVALID_IMAGE',
    );
  }

  const usage: TokenUsage = {
    promptTokens: result.usage?.prompt_tokens ?? 0,
    completionTokens: result.usage?.completion_tokens ?? 0,
    totalTokens: result.usage?.total_tokens ?? 0,
  };

  // Post-process: remove magenta chromakey background
  try {
    const bgResult = removeBackground(imageDataUrl, {
      tolerance: 90,
      targetColor: { r: 255, g: 0, b: 255 },
      erodePixels: 1,
    });
    imageDataUrl = bgResult.dataUrl;
    console.log(
      `[iconGen] Background removed (chromakey) for ${iconTag}: ` +
      `${bgResult.pixelsRemoved} px transparent (bg: ${bgResult.detectedColor})`,
    );
  } catch (bgErr) {
    console.warn(`[iconGen] Background removal failed for ${iconTag}, keeping original:`, bgErr);
  }

  await logLLMCall({
    type: 'image',
    model: result.model,
    prompt,
    response: `[icon ${iconTag} ${durationMs}ms]`,
    usage,
    durationMs,
    timestamp: new Date().toISOString(),
  });

  return { imageDataUrl, usage, durationMs };
}

// ---- Batch generation ----

/**
 * Generate icons for a batch of items.
 *
 * - category === 'special' items are skipped (bead uses a fixed local image)
 * - Icons are cached by iconTag on disk; same tag across items or across runs
 *   reuses the same cached file without calling the model.
 */
export async function generateItemIcons(
  items: ItemIconInput[],
  options: RetryOptions = {},
): Promise<ItemIconBatchResult> {
  ensureCacheDir();

  const icons = new Map<string, string>();
  const results: ItemIconResult[] = [];
  let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let cacheHits = 0;
  let cacheMisses = 0;
  let skipped = 0;
  const startTime = Date.now();

  const tagToDataUrl = new Map<string, string>();

  for (const item of items) {
    if (item.category === 'special') {
      icons.set(item.itemId, '');
      skipped++;
      console.log(`[iconGen] Skipped ${item.itemId} (${item.name}) — special/bead`);
      continue;
    }

    const batchCached = tagToDataUrl.get(item.iconTag);
    if (batchCached) {
      icons.set(item.itemId, batchCached);
      results.push({
        itemId: item.itemId,
        iconTag: item.iconTag,
        imageDataUrl: batchCached,
        cached: true,
        mimeType: 'image/png',
        sizeBytes: 0,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        durationMs: 0,
      });
      cacheHits++;
      console.log(`[iconGen] ${item.itemId} (${item.iconTag}) — batch cached`);
      continue;
    }

    const fileCached = readCachedIcon(item.iconTag);
    if (fileCached) {
      icons.set(item.itemId, fileCached);
      tagToDataUrl.set(item.iconTag, fileCached);
      results.push({
        itemId: item.itemId,
        iconTag: item.iconTag,
        imageDataUrl: fileCached,
        cached: true,
        mimeType: 'image/png',
        sizeBytes: 0,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        durationMs: 0,
      });
      cacheHits++;
      console.log(`[iconGen] ${item.itemId} (${item.iconTag}) — file cached`);
      continue;
    }

    console.log(`[iconGen] Generating icon for ${item.itemId} (${item.name}, tag: ${item.iconTag})...`);
    try {
      const gen = await generateSingleIcon(item.name, item.description, item.iconTag, options);

      const base64Data = gen.imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
      writeCachedIcon(item.iconTag, base64Data);

      icons.set(item.itemId, gen.imageDataUrl);
      tagToDataUrl.set(item.iconTag, gen.imageDataUrl);

      const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
      results.push({
        itemId: item.itemId,
        iconTag: item.iconTag,
        imageDataUrl: gen.imageDataUrl,
        cached: false,
        mimeType: 'image/png',
        sizeBytes,
        usage: gen.usage,
        durationMs: gen.durationMs,
      });

      totalUsage = {
        promptTokens: totalUsage.promptTokens + gen.usage.promptTokens,
        completionTokens: totalUsage.completionTokens + gen.usage.completionTokens,
        totalTokens: totalUsage.totalTokens + gen.usage.totalTokens,
      };

      cacheMisses++;
      console.log(`[iconGen] ${item.itemId} (${item.iconTag}) — generated (${gen.durationMs}ms)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[iconGen] Failed to generate icon for ${item.itemId} (${item.iconTag}): ${msg}`);
      icons.set(item.itemId, '');
      results.push({
        itemId: item.itemId,
        iconTag: item.iconTag,
        imageDataUrl: '',
        cached: false,
        mimeType: '',
        sizeBytes: 0,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        durationMs: 0,
      });
    }
  }

  return {
    icons,
    results,
    totalUsage,
    totalDurationMs: Date.now() - startTime,
    cacheHits,
    cacheMisses,
    skipped,
  };
}

/** Return the cache directory path (useful for tests). */
export function getIconCacheDir(): string {
  return ICON_CACHE_DIR;
}
