import { executePrompt } from '../../prompts/types.js';
import {
  questionResponsePrompt,
  type QuestionPromptInput,
} from '../../prompts/debate-interact.js';
import type { ClueRecord } from '../exploration/types.js';
import type {
  QuestionResponseLLMOutput,
  DebateInitData,
  DebateContext,
  DebateHistoryEntry,
  DebateResponse,
  DebateStepResult,
} from './types.js';
import { formatHistory } from './types.js';

function buildClaimsOverview(
  claims: DebateInitData['claims'],
  refutedClaimIds: string[],
): string {
  return claims
    .map((c) => {
      const status = refutedClaimIds.includes(c.claimId)
        ? '已驳倒'
        : c.status === 'weakened'
          ? '已动摇'
          : '未驳倒';
      return `- [${c.claimId}][${status}] ${c.text}`;
    })
    .join('\n');
}

/**
 * Process a player question during the debate phase.
 *
 * The LLM generates an in-character NPC response. Questions alone cannot
 * refute claims but may "weaken" them (hint to the player that evidence is needed).
 */
export async function processDebateQuestion(
  text: string,
  context: DebateContext,
  debateInit: DebateInitData,
  _clueDefinitions: ClueRecord[],
  history: DebateHistoryEntry[],
): Promise<DebateStepResult<DebateResponse>> {
  const startTime = Date.now();

  const currentClaim = context.currentClaimId
    ? debateInit.claims.find((c) => c.claimId === context.currentClaimId)
    : debateInit.claims.find(
        (c) => !context.refutedClaimIds.includes(c.claimId),
      );

  const promptInput: QuestionPromptInput = {
    npcName: debateInit.npc.name,
    npcTone: debateInit.npc.tone,
    attitudeStage: context.attitudeStage,
    currentClaimText: currentClaim?.text ?? '（无当前观点）',
    currentClaimBasis: currentClaim?.basis ?? '',
    claimsOverview: buildClaimsOverview(
      debateInit.claims,
      context.refutedClaimIds,
    ),
    recentHistory: formatHistory(history),
    playerQuestion: text,
  };

  const callResult = await executePrompt<
    QuestionPromptInput,
    QuestionResponseLLMOutput
  >(questionResponsePrompt, promptInput);

  const llm = callResult.data;

  const response: DebateResponse = {
    npcSpeech: llm.npcSpeech,
  };

  if (
    llm.claimUpdateNewStatus === 'weakened' &&
    llm.claimUpdateClaimId &&
    llm.claimUpdateClaimId !== ''
  ) {
    const targetClaim = debateInit.claims.find(
      (c) => c.claimId === llm.claimUpdateClaimId,
    );
    if (
      targetClaim &&
      !context.refutedClaimIds.includes(llm.claimUpdateClaimId)
    ) {
      response.claimUpdate = {
        claimId: llm.claimUpdateClaimId,
        newStatus: 'weakened',
      };
    }
  }

  return {
    data: response,
    usage: callResult.usage,
    durationMs: Date.now() - startTime,
  };
}
