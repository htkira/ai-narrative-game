import { executePrompt } from '../../prompts/types.js';
import {
  evidenceHitPrompt,
  evidenceMissPrompt,
  confessionPrompt,
  type EvidenceHitPromptInput,
  type EvidenceMissPromptInput,
  type ConfessionPromptInput,
} from '../../prompts/debate-interact.js';
import type { ClueRecord } from '../exploration/types.js';
import type {
  EvidenceHitLLMOutput,
  EvidenceMissLLMOutput,
  ConfessionLLMOutput,
  DebateInitData,
  DebateContext,
  DebateHistoryEntry,
  EvidenceResult,
  DebateStepResult,
} from './types.js';
import { calculateAttitude, formatHistory } from './types.js';

function buildClaimsOverview(
  claims: DebateInitData['claims'],
  refutedClaimIds: string[],
  newlyRefutedId?: string,
): string {
  return claims
    .map((c) => {
      const isRefuted =
        refutedClaimIds.includes(c.claimId) || c.claimId === newlyRefutedId;
      const status = isRefuted ? '已驳倒' : '未驳倒';
      return `- [${c.claimId}][${status}] ${c.text}`;
    })
    .join('\n');
}

/**
 * Resolve an evidence ID to the list of associated clue IDs.
 * Accepts either a clueId directly or an itemId (resolves all clues for that item).
 */
function resolveEvidenceToClueIds(
  evidenceId: string,
  clueDefinitions: ClueRecord[],
): string[] {
  if (clueDefinitions.some((c) => c.clueId === evidenceId)) {
    return [evidenceId];
  }
  return clueDefinitions
    .filter((c) => c.sourceItemId === evidenceId && c.usableAsEvidence)
    .map((c) => c.clueId);
}

/**
 * Process evidence presentation during the debate phase.
 *
 * Uses a hybrid approach:
 * 1. Hard logic: check if evidence clueId is in target claim's refutableByClueIds
 * 2. On hit: call LLM for NPC retreat/confession response
 * 3. On miss: call LLM for NPC defensive response
 */
export async function processDebateEvidence(
  evidenceId: string,
  targetClaimId: string,
  playerText: string | undefined,
  context: DebateContext,
  debateInit: DebateInitData,
  clueDefinitions: ClueRecord[],
  history: DebateHistoryEntry[],
): Promise<DebateStepResult<EvidenceResult>> {
  const startTime = Date.now();

  const targetClaim = debateInit.claims.find(
    (c) => c.claimId === targetClaimId,
  );
  if (!targetClaim) {
    throw new Error(`Claim ${targetClaimId} not found`);
  }

  if (context.refutedClaimIds.includes(targetClaimId)) {
    throw new Error(`Claim ${targetClaimId} is already refuted`);
  }

  const resolvedClueIds = resolveEvidenceToClueIds(
    evidenceId,
    clueDefinitions,
  );
  if (resolvedClueIds.length === 0) {
    throw new Error(
      `Evidence ${evidenceId} does not resolve to any known clue`,
    );
  }

  const hit = resolvedClueIds.some((cid) =>
    targetClaim.refutableByClueIds.includes(cid),
  );

  const matchingClueId = resolvedClueIds.find((cid) =>
    targetClaim.refutableByClueIds.includes(cid),
  );
  const evidenceClue = clueDefinitions.find(
    (c) => c.clueId === (matchingClueId ?? resolvedClueIds[0]),
  );

  if (hit) {
    return handleHit(
      targetClaim,
      evidenceClue!,
      context,
      debateInit,
      history,
      startTime,
    );
  } else {
    return handleMiss(
      targetClaim,
      evidenceClue!,
      playerText,
      context,
      debateInit,
      history,
      startTime,
    );
  }
}

async function handleHit(
  targetClaim: DebateInitData['claims'][number],
  evidenceClue: ClueRecord,
  context: DebateContext,
  debateInit: DebateInitData,
  history: DebateHistoryEntry[],
  startTime: number,
): Promise<DebateStepResult<EvidenceResult>> {
  const newRefutedIds = [...context.refutedClaimIds, targetClaim.claimId];
  const totalClaims = debateInit.claims.length;
  const isLastClaim = newRefutedIds.length >= totalClaims;

  if (isLastClaim) {
    return handleConfession(
      targetClaim,
      context,
      debateInit,
      history,
      startTime,
    );
  }

  const newAttitude = calculateAttitude(newRefutedIds.length, totalClaims);
  const remainingActive = totalClaims - newRefutedIds.length;

  const promptInput: EvidenceHitPromptInput = {
    npcName: debateInit.npc.name,
    npcTone: debateInit.npc.tone,
    attitudeStage: newAttitude,
    refutedClaimText: targetClaim.text,
    refutedClaimBasis: targetClaim.basis,
    evidenceTitle: evidenceClue.title,
    evidenceSummary: evidenceClue.summary,
    remainingActiveClaims: remainingActive,
    claimsOverview: buildClaimsOverview(
      debateInit.claims,
      context.refutedClaimIds,
      targetClaim.claimId,
    ),
    recentHistory: formatHistory(history),
  };

  const callResult = await executePrompt<
    EvidenceHitPromptInput,
    EvidenceHitLLMOutput
  >(evidenceHitPrompt, promptInput);

  return {
    data: {
      hit: true,
      npcSpeech: callResult.data.npcSpeech,
      claimUpdate: {
        claimId: targetClaim.claimId,
        newStatus: 'refuted',
      },
      attitudeChange: newAttitude,
    },
    usage: callResult.usage,
    durationMs: Date.now() - startTime,
  };
}

async function handleMiss(
  targetClaim: DebateInitData['claims'][number],
  evidenceClue: ClueRecord,
  playerText: string | undefined,
  context: DebateContext,
  debateInit: DebateInitData,
  history: DebateHistoryEntry[],
  startTime: number,
): Promise<DebateStepResult<EvidenceResult>> {
  const promptInput: EvidenceMissPromptInput = {
    npcName: debateInit.npc.name,
    npcTone: debateInit.npc.tone,
    attitudeStage: context.attitudeStage,
    targetClaimText: targetClaim.text,
    evidenceTitle: evidenceClue.title,
    evidenceSummary: evidenceClue.summary,
    playerText: playerText ?? '',
    recentHistory: formatHistory(history),
  };

  const callResult = await executePrompt<
    EvidenceMissPromptInput,
    EvidenceMissLLMOutput
  >(evidenceMissPrompt, promptInput);

  return {
    data: {
      hit: false,
      npcSpeech: callResult.data.npcSpeech,
    },
    usage: callResult.usage,
    durationMs: Date.now() - startTime,
  };
}

async function handleConfession(
  lastClaim: DebateInitData['claims'][number],
  context: DebateContext,
  debateInit: DebateInitData,
  history: DebateHistoryEntry[],
  startTime: number,
): Promise<DebateStepResult<EvidenceResult>> {
  const promptInput: ConfessionPromptInput = {
    npcName: debateInit.npc.name,
    npcTone: debateInit.npc.tone,
    claimsOverview: buildClaimsOverview(
      debateInit.claims,
      [...context.refutedClaimIds, lastClaim.claimId],
    ),
    recentHistory: formatHistory(history),
  };

  const callResult = await executePrompt<
    ConfessionPromptInput,
    ConfessionLLMOutput
  >(confessionPrompt, promptInput);

  return {
    data: {
      hit: true,
      npcSpeech: callResult.data.npcSpeech,
      claimUpdate: {
        claimId: lastClaim.claimId,
        newStatus: 'refuted',
      },
      attitudeChange: 'confessing',
      destinationUnlocked: true,
    },
    usage: callResult.usage,
    durationMs: Date.now() - startTime,
  };
}
