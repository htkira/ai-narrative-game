import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

const orApiKey = required('OPENROUTER_API_KEY');
const orBaseUrl = optional('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
const orModel = optional('OPENROUTER_MODEL', 'openai/gpt-5.4');

const llmApiKey = optional('LLM_API_KEY', '');
const llmBaseUrl = optional('LLM_BASE_URL', '');
const llmModel = optional('LLM_MODEL', '');
const hasExternalLlm = !!(llmApiKey && llmBaseUrl);

export const config = {
  port: parseInt(optional('PORT', '3001'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  isDev: optional('NODE_ENV', 'development') === 'development',

  textLlm: {
    apiKey: hasExternalLlm ? llmApiKey : orApiKey,
    baseUrl: hasExternalLlm ? llmBaseUrl : orBaseUrl,
    model: llmModel || orModel,
    isExternal: hasExternalLlm,
  },

  openRouter: {
    apiKey: orApiKey,
    baseUrl: orBaseUrl,
    model: orModel,
    imageModel: optional('OPENROUTER_IMAGE_MODEL', 'google/gemini-3.1-flash-image-preview'),
  },

  proxy: {
    url: optional('HTTP_PROXY', ''),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
  },
} as const;
