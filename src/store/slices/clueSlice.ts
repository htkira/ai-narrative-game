import type { StateCreator } from 'zustand';
import type { GameStore, ClueSlice } from '../types';

export const createClueSlice: StateCreator<
  GameStore,
  [],
  [],
  ClueSlice
> = (set, get) => ({
  clues: {
    total: 0,
    foundCount: 0,
    foundIds: [],
    records: [],
  },
  _clueDefinitions: [],

  addClue: (clueId: string) => {
    const state = get();
    if (state.clues.foundIds.includes(clueId)) return;

    const clueDef = state._clueDefinitions.find(
      (c) => c.clueId === clueId,
    );
    if (!clueDef) return;

    set({
      clues: {
        ...state.clues,
        foundCount: state.clues.foundCount + 1,
        foundIds: [...state.clues.foundIds, clueId],
        records: [...state.clues.records, clueDef],
      },
    });

    get().pushHistory('addClue', `发现线索: ${clueDef.title}`);
  },
});
