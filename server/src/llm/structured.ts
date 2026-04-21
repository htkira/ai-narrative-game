import {
  chatCompletion,
  type ChatMessage,
  type ChatOptions,
  type RetryOptions,
  type CallResult,
} from './client.js';
import { LLMParseError } from './errors.js';
import { config } from '../config.js';

export interface SchemaDefinition {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

/**
 * Call LLM with structured JSON output and parse the result.
 *
 * - OpenAI / OpenRouter: uses native json_schema response format (strict mode).
 * - External providers (e.g. DeepSeek): falls back to json_object mode
 *   with the schema injected into the prompt.
 */
export async function structuredOutput<T>(
  messages: ChatMessage[],
  schemaDef: SchemaDefinition,
  options?: Omit<ChatOptions, 'responseFormat'> & RetryOptions,
): Promise<CallResult<T>> {
  const useNativeSchema = !config.textLlm.isExternal;

  let effectiveMessages = messages;
  let responseFormat: ChatOptions['responseFormat'];

  if (useNativeSchema) {
    responseFormat = {
      type: 'json_schema' as const,
      json_schema: {
        name: schemaDef.name,
        description: schemaDef.description,
        strict: schemaDef.strict ?? true,
        schema: schemaDef.schema,
      },
    };
  } else {
    responseFormat = { type: 'json_object' as const };
    const schemaJson = JSON.stringify(schemaDef.schema, null, 2);
    const schemaInstruction =
      `\n\n## Output Format\nYou MUST respond with a single JSON object conforming to this schema (no markdown, no extra text):\n\`\`\`\n${schemaJson}\n\`\`\``;
    effectiveMessages = messages.map((msg, i) => {
      if (i === 0 && msg.role === 'system') {
        return { ...msg, content: (msg.content as string) + schemaInstruction };
      }
      return msg;
    });
  }

  const result = await chatCompletion(effectiveMessages, {
    ...options,
    responseFormat,
  });

  try {
    const parsed = JSON.parse(result.data) as T;
    return { ...result, data: parsed };
  } catch (cause) {
    throw new LLMParseError(
      `Failed to parse JSON from structured output "${schemaDef.name}": ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      result.data,
      cause,
    );
  }
}

/**
 * Helper to build a JSON Schema object definition compatible with
 * OpenAI's strict mode requirements:
 * - All properties listed in `required`
 * - `additionalProperties: false`
 */
export function defineSchema(
  properties: Record<string, unknown>,
  options: { description?: string } = {},
): Record<string, unknown> {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    ...(options.description ? { description: options.description } : {}),
  };
}

/**
 * Helper to build a JSON Schema enum definition.
 */
export function enumSchema(values: readonly string[]): Record<string, unknown> {
  return { type: 'string', enum: [...values] };
}

/**
 * Helper to build a JSON Schema array definition.
 */
export function arraySchema(
  items: Record<string, unknown>,
  options: { minItems?: number; maxItems?: number } = {},
): Record<string, unknown> {
  return {
    type: 'array',
    items,
    ...(options.minItems != null ? { minItems: options.minItems } : {}),
    ...(options.maxItems != null ? { maxItems: options.maxItems } : {}),
  };
}
