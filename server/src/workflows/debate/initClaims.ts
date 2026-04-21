import { executePrompt } from '../../prompts/types.js';
import { debateInitPrompt } from '../../prompts/debate-init.js';
import type { ExplorationResult, ClueRecord } from '../exploration/types.js';
import type {
  ClaimGenOutput,
  DebateInitData,
  DebateStepResult,
  DebateValidationResult,
  DebateValidationError,
} from './types.js';

/**
 * Generate NPC debate init data (claims + opening speech) from exploration results.
 *
 * This is effectively Step 4 of the game init pipeline:
 *   Step 1-3: Exploration workflow → ExplorationResult
 *   Step 4: This function → DebateInitData
 */
export async function generateDebateInit(
  explorationResult: ExplorationResult,
): Promise<DebateStepResult<DebateInitData>> {
  const startTime = Date.now();

  const callResult = await executePrompt<ExplorationResult, ClaimGenOutput>(
    debateInitPrompt,
    explorationResult,
  );

  const llmOutput = callResult.data;

  const debateInit: DebateInitData = {
    npc: {
      npcId: llmOutput.npc.npcId,
      name: llmOutput.npc.name,
      role: llmOutput.npc.role,
      tone: llmOutput.npc.tone,
      appearance: llmOutput.npc.appearance,
      currentSpeech: llmOutput.openingSpeech,
      attitudeStage: 'assertive',
    },
    claims: llmOutput.claims.map((c) => ({
      claimId: c.claimId,
      text: c.text,
      status: 'active' as const,
      basis: c.basis,
      refutableByClueIds: c.refutableByClueIds,
    })),
    openingSpeech: llmOutput.openingSpeech,
  };

  return {
    data: debateInit,
    usage: callResult.usage,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Validate generated debate init data against exploration clue definitions.
 */
export function validateDebateInit(
  data: DebateInitData,
  clueDefinitions: ClueRecord[],
  items: ExplorationResult['items'],
  rawClaims?: ClaimGenOutput['claims'],
): DebateValidationResult {
  const errors: DebateValidationError[] = [];
  const clueIds = new Set(clueDefinitions.map((c) => c.clueId));
  const evidenceClueIds = new Set(
    clueDefinitions.filter((c) => c.usableAsEvidence).map((c) => c.clueId),
  );

  // Rule: exactly 3 claims
  if (data.claims.length !== 3) {
    errors.push({
      rule: 'claim_count',
      message: `需要恰好3条观点，实际有${data.claims.length}条`,
    });
  }

  // Rule: each claim has at least 1 refutableByClueIds
  for (const claim of data.claims) {
    if (claim.refutableByClueIds.length === 0) {
      errors.push({
        rule: 'claim_refutable',
        message: `观点 ${claim.claimId} 没有可驳倒的线索ID`,
      });
    }

    // Rule: all referenced clueIds exist
    for (const id of claim.refutableByClueIds) {
      if (!clueIds.has(id)) {
        errors.push({
          rule: 'clue_exists',
          message: `观点 ${claim.claimId} 引用了不存在的线索 ${id}`,
        });
      }
    }

    // Rule: all referenced clueIds are usable as evidence
    for (const id of claim.refutableByClueIds) {
      if (clueIds.has(id) && !evidenceClueIds.has(id)) {
        errors.push({
          rule: 'clue_is_evidence',
          message: `观点 ${claim.claimId} 引用的线索 ${id} 不可作为证据`,
        });
      }
    }
  }

  // Rule: at least 1 claim based on false_clue (check via rawClaims if available)
  if (rawClaims) {
    const hasFalseClueBasedClaim = rawClaims.some((c) => c.basedOnFalseClue);
    if (!hasFalseClueBasedClaim) {
      errors.push({
        rule: 'false_clue_basis',
        message: '至少1条观点的论据应来自伪线索(false_clue)',
      });
    }
  }

  // Rule: refutableByClueIds should reference clues from actual items
  const falseClueItemIds = new Set(
    items.filter((i) => i.category === 'false_clue').map((i) => i.itemId),
  );
  const clueToItem = new Map(
    clueDefinitions.map((c) => [c.clueId, c.sourceItemId]),
  );
  const hasClueFromFalseItem = data.claims.some((claim) =>
    claim.refutableByClueIds.some((cid) =>
      falseClueItemIds.has(clueToItem.get(cid) ?? ''),
    ),
  );
  if (falseClueItemIds.size > 0 && !hasClueFromFalseItem && !rawClaims) {
    // Soft warning: at least one claim should be refutable via a false_clue-sourced clue
    errors.push({
      rule: 'false_clue_clue_coverage',
      message: '建议至少1条观点可被来自伪线索物品的线索驳倒',
    });
  }

  // Rule: unique claim IDs
  const claimIdSet = new Set(data.claims.map((c) => c.claimId));
  if (claimIdSet.size !== data.claims.length) {
    errors.push({
      rule: 'unique_claim_ids',
      message: 'claim ID 不唯一',
    });
  }

  // Rule: opening speech not empty
  if (!data.openingSpeech || data.openingSpeech.length < 20) {
    errors.push({
      rule: 'opening_speech',
      message: `开场白过短或为空（${data.openingSpeech?.length ?? 0}字）`,
    });
  }

  return { valid: errors.length === 0, errors };
}
