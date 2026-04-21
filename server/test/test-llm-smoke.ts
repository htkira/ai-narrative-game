/**
 * B2 冒烟测试：验证 LLM 封装层三项核心功能
 *
 * 运行方式: cd server && npx tsx test/test-llm-smoke.ts
 *
 * 测试项:
 *   1. 连接验证 — API Key 有效，能收到模型响应
 *   2. 结构化输出验证 — JSON Schema 模式调用，返回值通过解析
 *   3. 重试验证 — 模拟可恢复错误，确认重试机制工作
 */

import {
  chatCompletion,
  structuredOutput,
  defineSchema,
  withRetry,
  LLMError,
} from '../src/llm/index.js';

// ---- Test runner ----

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  process.stdout.write(`\n▶ ${name}...\n`);
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.push({ name, passed: true, durationMs: ms });
    console.log(`  ✅ PASS (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: msg, durationMs: ms });
    console.log(`  ❌ FAIL (${ms}ms)`);
    console.log(`  Error: ${msg}`);
  }
}

function assert(condition: boolean, message?: string): void {
  if (!condition) throw new Error(message ?? 'Assertion failed');
}

// ---- Test 1: Connection ----

await runTest('连接验证', async () => {
  const result = await chatCompletion(
    [{ role: 'user', content: 'Say "hello" and nothing else.' }],
    { maxTokens: 20, temperature: 0 },
  );

  assert(result.data.length > 0, 'Response should not be empty');
  assert(result.usage.totalTokens > 0, 'Token usage should be reported');
  assert(result.durationMs > 0, 'Duration should be positive');

  console.log(`  Response: "${result.data.trim()}"`);
  console.log(
    `  Tokens: ${result.usage.promptTokens}+${result.usage.completionTokens}=${result.usage.totalTokens}`,
  );
  console.log(`  Model: ${result.model}`);
});

// ---- Test 2: Structured Output ----

await runTest('结构化输出验证', async () => {
  interface TestOutput {
    greeting: string;
    number: number;
    is_valid: boolean;
  }

  const schema = defineSchema({
    greeting: { type: 'string', description: 'A greeting message' },
    number: { type: 'integer', description: 'A number between 1 and 10' },
    is_valid: { type: 'boolean', description: 'Always true' },
  });

  const result = await structuredOutput<TestOutput>(
    [
      {
        role: 'user',
        content:
          'Respond with a greeting, pick a number between 1 and 10, and set is_valid to true.',
      },
    ],
    { name: 'test_structured_output', schema },
    { maxTokens: 100, temperature: 0 },
  );

  assert(typeof result.data.greeting === 'string', 'greeting should be string');
  assert(
    typeof result.data.number === 'number' && Number.isInteger(result.data.number),
    'number should be integer',
  );
  assert(result.data.is_valid === true, 'is_valid should be true');
  assert(
    result.data.number >= 1 && result.data.number <= 10,
    `number should be 1-10, got ${result.data.number}`,
  );

  console.log(`  Parsed: ${JSON.stringify(result.data)}`);
  console.log(
    `  Tokens: ${result.usage.promptTokens}+${result.usage.completionTokens}=${result.usage.totalTokens}`,
  );
});

// ---- Test 3: Retry ----

await runTest('重试机制验证', async () => {
  let attempts = 0;

  const result = await withRetry(
    async () => {
      attempts++;
      if (attempts <= 2) {
        throw new Error('Connection timeout — simulated for retry test');
      }
      return 'recovered-after-retries';
    },
    { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 200 },
  );

  assert(result === 'recovered-after-retries', 'Should return success value');
  assert(attempts === 3, `Expected 3 attempts, got ${attempts}`);
  console.log(`  Retried ${attempts - 1} times, succeeded on attempt #${attempts}`);

  // Also verify that non-retryable errors are NOT retried
  let nonRetryAttempts = 0;
  try {
    await withRetry(
      async () => {
        nonRetryAttempts++;
        throw new Error('Simulated non-retryable failure');
      },
      { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 200 },
    );
    assert(false, 'Should have thrown');
  } catch (err) {
    assert(err instanceof LLMError, 'Should be wrapped as LLMError');
    assert(nonRetryAttempts === 1, `Non-retryable should not retry, got ${nonRetryAttempts} attempts`);
    console.log(`  Non-retryable error correctly stopped after 1 attempt`);
  }
});

// ---- Summary ----

console.log('\n' + '='.repeat(50));
console.log('LLM 冒烟测试结果');
console.log('='.repeat(50));

for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`  ${icon} ${r.name} (${r.durationMs}ms)`);
  if (r.error) console.log(`     ${r.error}`);
}

const passed = results.filter((r) => r.passed).length;
const total = results.length;
console.log(`\n${passed}/${total} 项通过`);

if (passed < total) {
  console.log('\n⚠️  部分测试未通过，请检查 .env 中的 OPENAI_API_KEY 配置。');
  process.exit(1);
}

console.log('\n🎉 全部通过！LLM 封装层工作正常。');
process.exit(0);
