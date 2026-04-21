/**
 * NPC 立绘生成工作流
 *
 * 使用 Gemini Flash Image 生成 NPC 全身像素画立绘。
 * 基于辩论工作流 initClaims 生成的 NPC appearance 描述。
 * 可选后处理：将纯色背景替换为透明，便于前端叠加显示。
 */

import OpenAI from 'openai';
import { openai, withRetry, type RetryOptions, type TokenUsage } from '../llm/index.js';
import { logLLMCall } from '../llm/logger.js';
import { LLMError, LLMEmptyResponseError } from '../llm/errors.js';
import { config } from '../config.js';
import { removeBackground } from './removeBackground.js';

// ---- Public types ----

export interface NpcPortraitInput {
  name: string;
  role: string;
  appearance: string;
  tone?: string;
}

export interface NpcPortraitResult {
  imageDataUrl: string;
  mimeType: string;
  sizeBytes: number;
  usage: TokenUsage;
  durationMs: number;
  model: string;
}

export interface NpcPortraitOptions extends RetryOptions {
  aspectRatio?: string;
  imageSize?: '0.5K' | '1K' | '2K' | '4K';
  /** Remove solid background and make it transparent (default: true). */
  transparentBg?: boolean;
  /** Color distance tolerance for background removal (default: 90). */
  bgTolerance?: number;
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

// ---- Prompt ----

function buildPortraitPrompt(input: NpcPortraitInput): string {
  const lines = [
    'Generate a FULL-BODY character sprite for a Chinese supernatural mystery pixel art game.',
    '',
    `Character name: ${input.name}`,
    `Role: ${input.role}`,
    `Appearance: ${input.appearance}`,
  ];
  if (input.tone) {
    lines.push(`Personality / tone: ${input.tone}`);
  }
  lines.push(
    '',
    'STRICT style requirements (follow ALL precisely):',
    '- HIGH-DETAIL pixel art with visible crisp pixels, retro RPG character sprite',
    '- FULL BODY from head to feet — the character should fill about 80-85% of the image height',
    '- Slightly chibi / exaggerated proportions (roughly 3.5-4 head heights), stocky build',
    '- Ancient Chinese (古风) clothing: layered fabric, belts, pouches, accessories — the character should look like a rural mountain-village NPC',
    '- Rich detail on clothing: patches, folds, worn textures, hanging items (keys, gourd, scroll, tools)',
    '- PURE MAGENTA (#FF00FF) solid background — every background pixel must be exactly #FF00FF, no gradients, no vignette, no ground shadow',
    '- Warm earth-tone palette: browns, ambers, muted greens, aged wood colors, faded cloth',
    '- Strong clear silhouette outline — the character must be cleanly separated from the magenta background',
    '- NEVER use pink, magenta, or purple tones on the character itself — reserve #FF00FF strictly for background',
    '- Idle standing pose, slight asymmetry (one hand holding a prop, leaning on a staff, etc.)',
    '- Expressive face: visible eyes, brows, mouth conveying personality',
    '- NO text, NO labels, NO UI, NO name plates, NO ground plane, NO shadow beneath feet',
    '- The sprite must look like a hand-crafted pixel art game asset, NOT photorealistic',
  );
  return lines.join('\n');
}

// ---- Generation ----

/**
 * Generate an NPC portrait using Gemini Flash Image via OpenRouter.
 *
 * Returns a base64 data URL (e.g. `data:image/png;base64,...`).
 */
export async function generateNpcPortrait(
  input: NpcPortraitInput,
  options: NpcPortraitOptions = {},
): Promise<NpcPortraitResult> {
  const {
    aspectRatio = '3:4',
    imageSize = '1K',
    transparentBg = true,
    bgTolerance = 90,
    maxRetries,
    baseDelayMs,
    maxDelayMs,
  } = options;
  const prompt = buildPortraitPrompt(input);
  const model = config.openRouter.imageModel;
  const startTime = Date.now();

  try {
    const requestBody = {
      model,
      messages: [{ role: 'user' as const, content: prompt }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: aspectRatio, image_size: imageSize },
    };

    const result = await withRetry(
      async () => {
        const raw = await openai.chat.completions.create(
          requestBody as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
        );
        return raw as OpenAI.Chat.ChatCompletion;
      },
      { maxRetries, baseDelayMs, maxDelayMs },
    );

    const durationMs = Date.now() - startTime;
    const message = result.choices[0]?.message as unknown as OpenRouterAssistantMessage;
    const images = message?.images;

    if (!images || images.length === 0) {
      throw new LLMEmptyResponseError('No portrait image generated');
    }

    const imageDataUrl = images[0]!.image_url.url;
    if (!imageDataUrl.startsWith('data:image/')) {
      throw new LLMError(
        `Invalid portrait data URL: ${imageDataUrl.substring(0, 60)}...`,
        'INVALID_IMAGE',
      );
    }

    const mimeMatch = imageDataUrl.match(/^data:(image\/[\w+]+);base64,/);
    const mimeType = mimeMatch?.[1] ?? 'image/png';
    const base64Data = imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
    const sizeBytes = Math.ceil((base64Data.length * 3) / 4);

    const usage: TokenUsage = {
      promptTokens: result.usage?.prompt_tokens ?? 0,
      completionTokens: result.usage?.completion_tokens ?? 0,
      totalTokens: result.usage?.total_tokens ?? 0,
    };

    await logLLMCall({
      type: 'image',
      model: result.model,
      prompt,
      response: `[portrait ${input.name} ${mimeType} ${sizeBytes} bytes]`,
      usage,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    let finalDataUrl = imageDataUrl;
    let finalMime = mimeType;
    let finalSize = sizeBytes;

    if (transparentBg) {
      try {
        const bgResult = removeBackground(imageDataUrl, {
          tolerance: bgTolerance,
          targetColor: { r: 255, g: 0, b: 255 },
          erodePixels: 2,
        });
        finalDataUrl = bgResult.dataUrl;
        finalMime = 'image/png';
        finalSize = bgResult.sizeBytes;
        console.log(
          `[portrait] Background removed (chromakey): ${sizeBytes} → ${finalSize} bytes, ` +
          `${bgResult.pixelsRemoved} pixels transparent (bg: ${bgResult.detectedColor})`,
        );
      } catch (bgErr) {
        console.warn('[portrait] Background removal failed, returning original:', bgErr);
      }
    }

    return {
      imageDataUrl: finalDataUrl,
      mimeType: finalMime,
      sizeBytes: finalSize,
      usage,
      durationMs,
      model: result.model,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (error instanceof LLMError) {
      await logLLMCall({
        type: 'image',
        model,
        prompt,
        response: '',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        durationMs,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
      throw error;
    }

    const wrapped = new LLMError(
      error instanceof Error ? error.message : String(error),
      'PORTRAIT_GEN_ERROR',
      undefined,
      error,
    );

    await logLLMCall({
      type: 'image',
      model,
      prompt,
      response: '',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      durationMs,
      timestamp: new Date().toISOString(),
      error: wrapped.message,
    });

    throw wrapped;
  }
}
