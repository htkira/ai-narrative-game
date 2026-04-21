export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(message = 'API rate limit exceeded', cause?: unknown) {
    super(message, 'RATE_LIMIT', 429, cause);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMParseError extends LLMError {
  public readonly rawResponse: string;

  constructor(message: string, rawResponse: string, cause?: unknown) {
    super(message, 'PARSE_ERROR', undefined, cause);
    this.name = 'LLMParseError';
    this.rawResponse = rawResponse;
  }
}

export class LLMContentFilterError extends LLMError {
  constructor(message = 'Content filtered by model safety system', cause?: unknown) {
    super(message, 'CONTENT_FILTER', undefined, cause);
    this.name = 'LLMContentFilterError';
  }
}

export class LLMEmptyResponseError extends LLMError {
  constructor(message = 'Model returned empty response') {
    super(message, 'EMPTY_RESPONSE');
    this.name = 'LLMEmptyResponseError';
  }
}
