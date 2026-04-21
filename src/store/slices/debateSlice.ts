import type { StateCreator } from 'zustand';
import type { GameStore, DebateSlice } from '../types';
import type { AttitudeStage, DebateHistoryEntry } from '../../types/game';

export const createDebateSlice: StateCreator<
  GameStore,
  [],
  [],
  DebateSlice
> = (set, get) => ({
  debate: {
    started: false,
    round: 0,
    npc: null,
    claims: [],
    currentClaimId: null,
    history: [],
    refutedCount: 0,
    ended: false,
    destinationUnlocked: false,
  },

  triggerDebate: (data) => {
    set({
      phase: 'debate',
      debate: {
        started: true,
        round: 0,
        npc: { ...data.npc, currentSpeech: data.openingSpeech },
        claims: data.claims,
        currentClaimId: data.claims[0]?.claimId ?? null,
        history: [],
        refutedCount: 0,
        ended: false,
        destinationUnlocked: false,
      },
    });
    get().pushHistory('triggerDebate', '进入辩论阶段');
  },

  applyQuestionResult: (playerInput, response) => {
    const { debate } = get();
    if (!debate.npc || debate.ended) return;

    const newRound = debate.round + 1;

    const entry: DebateHistoryEntry = {
      round: newRound,
      type: 'question',
      playerInput,
      npcResponse: response.npcSpeech,
      resultTag: 'info',
    };

    let updatedNpc = {
      ...debate.npc,
      currentSpeech: response.npcSpeech,
    };
    let updatedClaims = [...debate.claims];

    if (response.attitudeChange) {
      updatedNpc.attitudeStage =
        response.attitudeChange as AttitudeStage;
    }

    if (response.claimUpdate) {
      const { claimId, newStatus } = response.claimUpdate;
      updatedClaims = updatedClaims.map((c) =>
        c.claimId === claimId ? { ...c, status: newStatus } : c,
      );
    }

    set({
      debate: {
        ...debate,
        round: newRound,
        npc: updatedNpc,
        claims: updatedClaims,
        history: [...debate.history, entry],
      },
    });

    get().pushHistory('question', playerInput);
  },

  applyEvidenceResult: (evidenceId, claimId, playerText, result) => {
    const { debate } = get();
    if (!debate.npc || debate.ended) return;

    const newRound = debate.round + 1;

    const entry: DebateHistoryEntry = {
      round: newRound,
      type: 'evidence',
      playerInput: playerText,
      evidenceId,
      claimId,
      npcResponse: result.npcSpeech,
      resultTag: result.hit ? 'hit' : 'miss',
    };

    let updatedNpc = {
      ...debate.npc,
      currentSpeech: result.npcSpeech,
    };
    let updatedClaims = [...debate.claims];
    let { refutedCount } = debate;

    if (result.claimUpdate) {
      const { claimId: cId, newStatus } = result.claimUpdate;
      updatedClaims = updatedClaims.map((c) =>
        c.claimId === cId ? { ...c, status: newStatus } : c,
      );
      if (newStatus === 'refuted') {
        refutedCount += 1;
      }
    }

    if (result.attitudeChange) {
      updatedNpc.attitudeStage =
        result.attitudeChange as AttitudeStage;
    }

    // Auto-advance focus to the next un-refuted claim
    let nextClaimId = debate.currentClaimId;
    if (result.hit && result.claimUpdate?.newStatus === 'refuted') {
      const next = updatedClaims.find(
        (c) => c.status === 'active' || c.status === 'weakened',
      );
      nextClaimId = next ? next.claimId : null;
    }

    const allRefuted = updatedClaims.every(
      (c) => c.status === 'refuted',
    );
    const ended =
      result.destinationUnlocked === true || allRefuted;

    set({
      debate: {
        ...debate,
        round: newRound,
        npc: updatedNpc,
        claims: updatedClaims,
        currentClaimId: nextClaimId,
        history: [...debate.history, entry],
        refutedCount,
        ended,
        destinationUnlocked:
          result.destinationUnlocked || debate.destinationUnlocked,
      },
    });

    get().pushHistory(
      'evidence',
      `出示 ${evidenceId} 针对 ${claimId}: ${result.hit ? '命中' : '未命中'}`,
    );
  },

  setCurrentClaim: (claimId) => {
    set((state) => ({
      debate: { ...state.debate, currentClaimId: claimId },
    }));
  },
});
