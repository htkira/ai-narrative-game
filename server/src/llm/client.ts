import OpenAI from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from '../config.js';
import { logLLMCall } from './logger.js';
import {
  LLMError,
  LLMRateLimitError,
  LLMContentFilterError,
  LLMEmptyResponseError,
} from './errors.js';

// ---- Clients ----

const proxyAgent = config.proxy.url
  ? new HttpsProxyAgent(config.proxy.url)
  : undefined;

const openRouterHeaders = {
  'HTTP-Referer': 'https://bai-village-game.dev',
  'X-Title': 'Bai Village Game',
};

// OpenRouter client — always used for image generation
const openai = new OpenAI({
  apiKey: config.openRouter.apiKey,
  baseURL: config.openRouter.baseUrl,
  defaultHeaders: openRouterHeaders,
  ...(proxyAgent ? { httpAgent: proxyAgent } : {}),
});

// Text LLM client — may point to a different provider (e.g. DeepSeek)
// External providers do NOT use the proxy; only OpenRouter needs it.
const textClient = config.textLlm.isExternal
  ? new OpenAI({
      apiKey: config.textLlm.apiKey,
      baseURL: config.textLlm.baseUrl,
    })
  : openai;

if (proxyAgent) {
  console.log(`[llm] Using HTTP proxy (OpenRouter only): ${config.proxy.url}`);
}
console.log(`[llm] OpenRouter base: ${config.openRouter.baseUrl}`);
if (config.textLlm.isExternal) {
  console.log(`[llm] Text LLM base: ${config.textLlm.baseUrl}`);
}
console.log(`[llm] Default model: ${config.textLlm.model}`);

// ---- Public types ----

export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CallResult<T = string> {
  data: T;
  usage: TokenUsage;
  durationMs: number;
  model: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming['response_format'];
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

// ---- Internal helpers ----

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRYABLE_NETWORK_PATTERNS = [
  'Premature close',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'timeout',
  'socket hang up',
  'fetch failed',
];

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  if (RETRYABLE_NETWORK_PATTERNS.some((p) => msg.includes(p))) return true;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ERR_STREAM_PREMATURE_CLOSE' || code === 'UND_ERR_SOCKET') return true;
  const cause = (error as { cause?: Error }).cause;
  if (cause instanceof Error) return isNetworkError(cause);
  return false;
}

function isRetryable(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  if (error instanceof OpenAI.APIError) {
    // 400 included: OpenRouter often wraps transient provider errors as 400
    return [400, 429, 500, 502, 503, 504].includes(error.status);
  }
  return false;
}

function wrapError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      return new LLMRateLimitError(error.message, error);
    }
    return new LLMError(
      error.message,
      `API_${error.status}`,
      error.status,
      error,
    );
  }
  const msg = error instanceof Error ? error.message : String(error);
  return new LLMError(msg, 'UNKNOWN', undefined, error);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !isRetryable(error)) {
        break;
      }
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      console.warn(
        `[llm] Attempt ${attempt + 1} failed, retrying in ${Math.round(jitter)}ms...`,
      );
      await sleep(jitter);
    }
  }
  throw wrapError(lastError);
}

// ---- Chat completion ----

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions & RetryOptions = {},
): Promise<CallResult> {
  const {
    model = config.textLlm.model,
    temperature = 0.7,
    maxTokens,
    responseFormat,
    maxRetries,
    baseDelayMs,
    maxDelayMs,
  } = options;

  const startTime = Date.now();

  try {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
      {
        model,
        messages,
        temperature,
      };
    if (maxTokens != null) params.max_tokens = maxTokens;
    if (responseFormat != null) params.response_format = responseFormat;

    const result = await withRetry(
      () => textClient.chat.completions.create(params),
      { maxRetries, baseDelayMs, maxDelayMs },
    );

    const durationMs = Date.now() - startTime;
    const choice = result.choices[0];

    if (choice?.finish_reason === 'content_filter') {
      throw new LLMContentFilterError();
    }

    const content = choice?.message?.content;
    if (!content) {
      throw new LLMEmptyResponseError();
    }

    const usage: TokenUsage = {
      promptTokens: result.usage?.prompt_tokens ?? 0,
      completionTokens: result.usage?.completion_tokens ?? 0,
      totalTokens: result.usage?.total_tokens ?? 0,
    };

    await logLLMCall({
      type: 'chat',
      model: result.model,
      messages,
      response: content,
      usage,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    return { data: content, usage, durationMs, model: result.model };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const wrapped = error instanceof LLMError ? error : wrapError(error);

    await logLLMCall({
      type: 'chat',
      model,
      messages,
      response: '',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      durationMs,
      timestamp: new Date().toISOString(),
      error: wrapped.message,
    });

    throw wrapped;
  }
}

export { openai };
