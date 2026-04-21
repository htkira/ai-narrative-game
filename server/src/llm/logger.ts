import { mkdir, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, '../../logs');

export interface LLMLogEntry {
  type: 'chat' | 'image';
  model: string;
  messages?: unknown;
  prompt?: string;
  response: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
  timestamp: string;
  error?: string;
}

let logsDirReady = false;

async function ensureLogsDir(): Promise<void> {
  if (logsDirReady) return;
  await mkdir(LOGS_DIR, { recursive: true });
  logsDirReady = true;
}

function formatConsoleLog(entry: LLMLogEntry): string {
  const { type, model, usage, durationMs, error } = entry;
  const tokens = `${usage.promptTokens}+${usage.completionTokens}=${usage.totalTokens}`;
  const status = error ? `ERR: ${error.slice(0, 80)}` : 'ok';
  return `[llm] ${type} | ${model} | ${durationMs}ms | tokens: ${tokens} | ${status}`;
}

export async function logLLMCall(entry: LLMLogEntry): Promise<void> {
  console.log(formatConsoleLog(entry));

  if (!config.isDev) return;

  try {
    await ensureLogsDir();
    const date = entry.timestamp.split('T')[0] ?? 'unknown';
    const filePath = join(LOGS_DIR, `llm-${date}.jsonl`);
    await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    console.warn('[llm] Failed to write log file:', err);
  }
}
