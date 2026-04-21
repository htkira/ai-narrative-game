/**
 * 内存会话管理 (V1)
 *
 * 每次 /api/game/init 创建一个 GameSession，存储完整的探索结果、
 * 辩论初始化数据、图片 URL，以及辩论过程中的历史记录。
 * Debug 端点可查看会话数据和工作流中间结果。
 */

import { randomUUID } from 'node:crypto';
import type {
  ExplorationResult,
  ClueRecord,
  SceneSkeletonOutput,
  ItemDetailsOutput,
  ClueMappingOutput,
} from '../workflows/exploration/types.js';
import type { ExplorationStepLog } from '../workflows/exploration/index.js';
import type { DebateInitData, DebateHistoryEntry } from '../workflows/debate/types.js';
import type { TokenUsage } from '../llm/index.js';

export interface WorkflowIntermediates {
  skeleton: SceneSkeletonOutput;
  details: ItemDetailsOutput;
  clues: ClueMappingOutput;
}

export interface GameSession {
  id: string;
  createdAt: string;

  explorationResult: ExplorationResult;
  debateInitData: DebateInitData;
  clueDefinitions: ClueRecord[];

  debateHistory: DebateHistoryEntry[];
  refutedClaimIds: string[];
  debateRound: number;

  sceneImageUrl: string;
  itemIconUrls: Record<string, string>;
  npcPortraitUrl: string;

  workflowSteps: ExplorationStepLog[];
  workflowIntermediates: WorkflowIntermediates | null;
  debateStepLog: { durationMs: number; usage: TokenUsage } | null;
  totalUsage: TokenUsage;
  totalDurationMs: number;
}

type SessionInitData = Omit<
  GameSession,
  'id' | 'createdAt' | 'debateHistory' | 'refutedClaimIds' | 'debateRound'
>;

const sessions = new Map<string, GameSession>();
let latestSessionId: string | null = null;

export function createSession(data: SessionInitData): GameSession {
  const session: GameSession = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    debateHistory: [],
    refutedClaimIds: [],
    debateRound: 0,
  };
  sessions.set(session.id, session);
  latestSessionId = session.id;
  return session;
}

export function getSession(id: string): GameSession | undefined {
  if (id === 'latest') {
    return latestSessionId ? sessions.get(latestSessionId) : undefined;
  }
  return sessions.get(id);
}

export function getLatestSessionId(): string | null {
  return latestSessionId;
}

export function getAllSessionsSummary(): Array<{
  id: string;
  createdAt: string;
  debateRound: number;
  refutedClaimIds: string[];
  totalDurationMs: number;
}> {
  return [...sessions.values()].map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    debateRound: s.debateRound,
    refutedClaimIds: s.refutedClaimIds,
    totalDurationMs: s.totalDurationMs,
  }));
}

export function addDebateHistory(
  sessionId: string,
  entry: DebateHistoryEntry,
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.debateHistory.push(entry);
  session.debateRound = entry.round;
}

export function addRefutedClaim(
  sessionId: string,
  claimId: string,
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (!session.refutedClaimIds.includes(claimId)) {
    session.refutedClaimIds.push(claimId);
  }
}
