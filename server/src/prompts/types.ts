import type {
  ChatMessage,
  ChatOptions,
  RetryOptions,
  CallResult,
} from '../llm/index.js';
import { structuredOutput, type SchemaDefinition } from '../llm/index.js';

/**
 * A prompt template encapsulates the messages, output schema,
 * and default LLM options for a single workflow step.
 *
 * The output type is specified at call-site via `executePrompt<TInput, TOutput>(...)`.
 */
export interface PromptTemplate<TInput = void> {
  /** Human-readable name for logging */
  name: string;

  /** Output JSON Schema definition */
  outputSchema: SchemaDefinition;

  /** Build the message array from input context */
  buildMessages: (input: TInput) => ChatMessage[];

  /** Default LLM call options (can be overridden at execution time) */
  defaultOptions?: Omit<ChatOptions, 'responseFormat'> & RetryOptions;
}

/**
 * Execute a prompt template: build messages, call LLM with structured output,
 * and return the parsed result.
 */
export async function executePrompt<TInput, TOutput>(
  template: PromptTemplate<TInput>,
  input: TInput,
  optionOverrides?: Omit<ChatOptions, 'responseFormat'> & RetryOptions,
): Promise<CallResult<TOutput>> {
  const messages = template.buildMessages(input);
  const options = { ...template.defaultOptions, ...optionOverrides };

  return structuredOutput<TOutput>(messages, template.outputSchema, options);
}

/**
 * Helper to create system message.
 */
export function system(content: string): ChatMessage {
  return { role: 'system', content };
}

/**
 * Helper to create user message.
 */
export function user(content: string): ChatMessage {
  return { role: 'user', content };
}

/**
 * Helper to create assistant message.
 */
export function assistant(content: string): ChatMessage {
  return { role: 'assistant', content };
}
