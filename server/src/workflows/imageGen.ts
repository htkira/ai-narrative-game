/**
 * 场景图片生成工作流
 *
 * 使用 Gemini Flash Image (google/gemini-3.1-flash-image-preview) via OpenRouter
 * 生成游戏场景的插画。
 *
 * 调用方式：通过 OpenAI 兼容的 chat completions 接口，
 * 设置 modalities: ["image", "text"] 让模型输出图片。
 * 返回 base64 data URL。
 */

import OpenAI from 'openai';
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';
import { openai, withRetry, type RetryOptions, type TokenUsage } from '../llm/index.js';
import { logLLMCall } from '../llm/logger.js';
import { LLMError, LLMEmptyResponseError } from '../llm/errors.js';
import { config } from '../config.js';

export interface ImageGenInput {
  sceneTitle: string;
  sceneDescription: string;
  imageAlt: string;
}

export interface ImageGenResult {
  imageDataUrl: string;
  backgroundColor: string;
  mimeType: string;
  sizeBytes: number;
  usage: TokenUsage;
  durationMs: number;
  model: string;
}

export interface ImageGenOptions extends RetryOptions {
  aspectRatio?: string;
  imageSize?: '0.5K' | '1K' | '2K' | '4K';
}

function buildImagePrompt(input: ImageGenInput): string {
  return [
    'Generate a scene illustration for a Chinese supernatural mystery adventure game.',
    '',
    `Scene title: ${input.sceneTitle}`,
    `Scene narrative: ${input.sceneDescription}`,
    `Visual description: ${input.imageAlt}`,
    '',
    'STRICT style requirements (follow ALL of these precisely):',
    '- Pixel art style with visible, crisp pixels — retro game aesthetic',
    '- Isometric (2.5D) perspective, looking down at roughly 30-degree angle',
    '- Solid flat muted color background (use a medium-dark earthy tone like #4a4540, #504a44, or #3e4a50 — NOT white, NOT pure black, NOT too dark)',
    '- The scene floats on the background like an isometric tile with no ground plane fading out',
    '- IMPORTANT: The scene content (the building/room) must be centered in the canvas and occupy approximately 70-80% of the image area, with the remaining area being the solid background color. Keep the scene content scale consistent — do not make it too small or too large relative to the canvas.',
    '- Setting: ancient Chinese mountain village interior (thatched roof, earthen walls, wooden furniture, stone hearth)',
    '',
    'COLOR & LIGHTING (critical for mood):',
    '- Muted, DESATURATED earth tones — dusty browns, weathered amber, faded olive, slate gray',
    '- An oil lamp or candle provides warm but CONTAINED light — illuminating the central area while edges stay dimmer',
    '- Medium overall brightness: NOT pitch-dark, NOT sunny — think overcast dusk light filtering through paper windows',
    '- Aged, worn colors: weathered wood, stained walls, tarnished metal, dusty fabric — everything looks old and neglected',
    '- Avoid overly warm/cozy feeling — the warmth of the lamp should contrast with the coldness of the surroundings',
    '',
    'ATMOSPHERE (critical for story):',
    '- Neglected, unsettling, and quietly ominous — a place with dark history',
    '- Signs of abandonment: dust, cobwebs, cracked pottery, overturned furniture, dried stains',
    '- Withered herbs hanging, scattered papers, an eerie stillness',
    '- The mood should be mysterious and uneasy — supernatural suspense, not horror or total desolation',
    '',
    '- NO people, NO characters, NO text, NO labels, NO UI elements whatsoever',
    '- The image must look like a hand-crafted pixel art game asset, NOT photorealistic or AI-painterly',
  ].join('\n');
}

/**
 * OpenRouter extends the standard message format with an `images` array
 * when the model produces image output.
 */
interface OpenRouterImageEntry {
  type: 'image_url';
  image_url: { url: string };
}

interface OpenRouterAssistantMessage {
  role: string;
  content: string | null;
  images?: OpenRouterImageEntry[];
}

/**
 * Generate a scene illustration image using Gemini Flash Image via OpenRouter.
 *
 * Returns a base64 data URL (e.g. `data:image/png;base64,...`).
 */
export async function generateSceneImage(
  input: ImageGenInput,
  options: ImageGenOptions = {},
): Promise<ImageGenResult> {
  const { aspectRatio = '1:1', imageSize = '1K', maxRetries, baseDelayMs, maxDelayMs } = options;
  const prompt = buildImagePrompt(input);
  const model = config.openRouter.imageModel;
  const startTime = Date.now();

  try {
    const requestBody = {
      model,
      messages: [{ role: 'user' as const, content: prompt }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: aspectRatio, image_size: imageSize },
    };

    // OpenRouter-specific fields (modalities with "image", image_config) are not
    // part of the OpenAI SDK's type definitions, so we cast the params and the
    // non-streaming return type explicitly.
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
      throw new LLMEmptyResponseError('No image generated in response');
    }

    const imageDataUrl = images[0]!.image_url.url;
    if (!imageDataUrl.startsWith('data:image/')) {
      throw new LLMError(
        `Invalid image data URL format: ${imageDataUrl.substring(0, 60)}...`,
        'INVALID_IMAGE',
      );
    }

    const mimeMatch = imageDataUrl.match(/^data:(image\/[\w+]+);base64,/);
    const mimeType = mimeMatch?.[1] ?? 'image/png';
    const base64Data = imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
    const sizeBytes = Math.ceil((base64Data.length * 3) / 4);

    const backgroundColor = extractBackgroundColor(base64Data, mimeType);

    const usage: TokenUsage = {
      promptTokens: result.usage?.prompt_tokens ?? 0,
      completionTokens: result.usage?.completion_tokens ?? 0,
      totalTokens: result.usage?.total_tokens ?? 0,
    };

    await logLLMCall({
      type: 'image',
      model: result.model,
      prompt,
      response: `[image ${mimeType} ${sizeBytes} bytes bg:${backgroundColor}]`,
      usage,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    return { imageDataUrl, backgroundColor, mimeType, sizeBytes, usage, durationMs, model: result.model };
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
      'IMAGE_GEN_ERROR',
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

/**
 * Decode an image (PNG or JPEG) from base64 and sample corner pixels to
 * extract the solid background color. Returns a hex string like `#2B3856`.
 */
function extractBackgroundColor(base64Data: string, mimeType = 'image/png'): string {
  const FALLBACK = '#1a1a2e';
  try {
    const buffer = Buffer.from(base64Data, 'base64');

    let width: number;
    let height: number;
    let data: Buffer | Uint8Array;

    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      const decoded = jpeg.decode(buffer, { useTArray: true });
      width = decoded.width;
      height = decoded.height;
      data = decoded.data;
    } else {
      const png = PNG.sync.read(buffer);
      width = png.width;
      height = png.height;
      data = png.data;
    }

    const pixelAt = (x: number, y: number) => {
      const idx = (y * width + x) * 4;
      return { r: data[idx]!, g: data[idx + 1]!, b: data[idx + 2]! };
    };

    const corners = [
      pixelAt(0, 0),
      pixelAt(width - 1, 0),
      pixelAt(0, height - 1),
      pixelAt(width - 1, height - 1),
    ];

    const toHex = (c: { r: number; g: number; b: number }) =>
      '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');

    const bg = corners[0]!;
    console.log(
      `[imageGen] Background color samples: ${corners.map(toHex).join(', ')} → using ${toHex(bg)}`,
    );

    return toHex(bg);
  } catch (err) {
    console.warn('[imageGen] Failed to extract background color, using fallback:', err);
    return FALLBACK;
  }
}
