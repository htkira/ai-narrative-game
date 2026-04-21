import fetch from 'node-fetch';
import { sceneLayoutPrompt } from '../src/prompts/index.js';

const msgs = sceneLayoutPrompt.buildMessages();
const schemaJson = JSON.stringify(sceneLayoutPrompt.outputSchema!.schema, null, 2);
const schemaInstruction = `\n\n## Output Format\nYou MUST respond with a single JSON object conforming to this schema (no markdown, no extra text):\n\`\`\`\n${schemaJson}\n\`\`\``;

const effectiveMsgs = msgs.map((msg, i) => {
  if (i === 0 && msg.role === 'system') return { ...msg, content: (msg.content as string) + schemaInstruction };
  return msg;
});

const body = JSON.stringify({
  model: 'deepseek-chat',
  messages: effectiveMsgs,
  max_tokens: 2000,
  temperature: 0.8,
  response_format: { type: 'json_object' },
});

const API_KEY = 'sk-f2b5fde68c9a40009de673b2bb3128eb';
const TOTAL_RUNS = 3;

async function runOnce(index: number) {
  const start = Date.now();
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body,
      timeout: 60000,
    });
    const json = (await res.json()) as any;
    const elapsed = Date.now() - start;
    const tokens = json.usage?.total_tokens ?? 0;
    const len = json.choices?.[0]?.message?.content?.length ?? 0;
    console.log(`#${index} SUCCESS | ${elapsed}ms | tokens: ${tokens} | resp: ${len} chars`);
    return { ok: true, elapsed };
  } catch (e: any) {
    const elapsed = Date.now() - start;
    console.log(`#${index} FAILED | ${elapsed}ms | ${e.code || e.type}: ${e.message.substring(0, 100)}`);
    return { ok: false, elapsed };
  }
}

console.log(`=== Real prompt via raw node-fetch x${TOTAL_RUNS} (body: ${body.length} chars) ===`);
const results = [];
for (let i = 1; i <= TOTAL_RUNS; i++) {
  results.push(await runOnce(i));
}
const ok = results.filter((r) => r.ok).length;
console.log(`---\nResults: ${ok}/${TOTAL_RUNS} success`);
if (ok > 0) {
  const avg = Math.round(results.filter((r) => r.ok).reduce((s, r) => s + r.elapsed, 0) / ok);
  console.log(`Avg success time: ${avg}ms`);
}
