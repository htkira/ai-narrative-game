export {
  chatCompletion,
  withRetry,
  openai,
  type ChatMessage,
  type TokenUsage,
  type CallResult,
  type ChatOptions,
  type RetryOptions,
} from './client.js';

export {
  structuredOutput,
  defineSchema,
  enumSchema,
  arraySchema,
  type SchemaDefinition,
} from './structured.js';

export {
  LLMError,
  LLMRateLimitError,
  LLMParseError,
  LLMContentFilterError,
  LLMEmptyResponseError,
} from './errors.js';

export { logLLMCall, type LLMLogEntry } from './logger.js';
