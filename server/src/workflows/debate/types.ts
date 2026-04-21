import type { TokenUsage } from '../../llm/index.js';

// ---- Attitude & Claim status (mirrors frontend game.ts) ----

export type AttitudeStage =
  | 'assertive'
  | 'defensive'
  | 'shaken'
  | 'retreating'
  | 'confessing';

export type ClaimStatus = 'active' | 'weakened' | 'refuted';

// ---- LLM output: NPC claim generation ----

export interface ClaimGenOutput {
  npc: {
    npcId: string;
    name: string;
    role: string;
    tone: string;
    appearance: string;
  };
  claims: Array<{
    claimId: string;
    opposedTruth: 'A' | 'B' | 'D';
    text: string;
    wrongPremise: string;
    basis: string;
    basedOnFalseClue: boolean;
    refutableByClueIds: string[];
  }>;
  openingSpeech: string;
}

// ---- LLM output: question response ----

export interface QuestionResponseLLMOutput {
  npcSpeech: string;
  claimUpdateClaimId: string;
  claimUpdateNewStatus: 'active' | 'weakened' | 'none';
  attitudeHint: string;
}

// ---- LLM output: evidence hit response ----

export interface EvidenceHitLLMOutput {
  npcSpeech: string;
  attitudeHint: string;
}

// ---- LLM output: evidence miss response ----

export interface EvidenceMissLLMOutput {
  npcSpeech: string;
}

// ---- LLM output: final confession ----

export interface ConfessionLLMOutput {
  npcSpeech: string;
}

// ---- Assembled types (compatible with frontend content.ts) ----

export interface DebateNpc {
  npcId: string;
  name: string;
  role: string;
  tone: string;
  appearance: string;
  currentSpeech: string;
  attitudeStage: AttitudeStage;
}

export interface DebateClaim {
  claimId: string;
  text: string;
  status: ClaimStatus;
  basis: string;
  refutableByClueIds: string[];
}

export interface DebateInitData {
  npc: DebateNpc;
  claims: DebateClaim[];
  openingSpeech: string;
}

export interface DebateContext {
  round: number;
  currentClaimId: string | null;
  refutedClaimIds: string[];
  attitudeStage: AttitudeStage;
}

export interface DebateHistoryEntry {
  round: number;
  type: 'question' | 'evidence';
  playerInput: string;
  evidenceId?: string;
  claimId?: string;
  npcResponse: string;
  resultTag?: 'hit' | 'miss' | 'info';
}

export interface DebateResponse {
  npcSpeech: string;
  claimUpdate?: {
    claimId: string;
    newStatus: ClaimStatus;
  };
  attitudeChange?: string;
}

export interface EvidenceResult {
  hit: boolean;
  npcSpeech: string;
  claimUpdate?: {
    claimId: string;
    newStatus: ClaimStatus;
  };
  attitudeChange?: string;
  destinationUnlocked?: boolean;
}

// ---- Validation ----

export interface DebateValidationError {
  rule: string;
  message: string;
}

export interface DebateValidationResult {
  valid: boolean;
  errors: DebateValidationError[];
}

// ---- Step result ----

export interface DebateStepResult<T> {
  data: T;
  usage: TokenUsage;
  durationMs: number;
}

// ---- Helpers ----

export function calculateAttitude(
  refutedCount: number,
  totalClaims: number,
): AttitudeStage {
  if (refutedCount >= totalClaims) return 'confessing';
  if (refutedCount >= totalClaims - 1) return 'retreating';
  if (refutedCount >= Math.ceil(totalClaims / 2)) return 'shaken';
  if (refutedCount >= 1) return 'defensive';
  return 'assertive';
}

export function formatHistory(
  history: DebateHistoryEntry[],
  maxEntries = 5,
): string {
  if (history.length === 0) return '（尚无对话记录）';
  return history
    .slice(-maxEntries)
    .map((h) => {
      if (h.type === 'question') {
        return `[第${h.round}轮-追问] 玩家: ${h.playerInput}\nNPC: ${h.npcResponse}`;
      }
      const tag = h.resultTag === 'hit' ? '命中' : '未命中';
      return `[第${h.round}轮-物证] 玩家出示证据 → ${tag}\nNPC: ${h.npcResponse}`;
    })
    .join('\n\n');
}
