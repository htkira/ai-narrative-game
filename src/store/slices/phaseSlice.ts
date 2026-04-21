import type { StateCreator } from 'zustand';
import type { GameStore, PhaseSlice } from '../types';
import type { SceneData, ClueDefinition, BeadData } from '../../types/content';

export const createPhaseSlice: StateCreator<
  GameStore,
  [],
  [],
  PhaseSlice
> = (set, get) => ({
  phase: 'start',
  actId: 'act1_scene1',
  history: [],

  startGame: () => {
    set({ phase: 'opening' });
    get().pushHistory('startGame', '进入开场演出');
  },

  completeOpening: (
    sceneData: SceneData,
    clueDefinitions: ClueDefinition[],
    beadData: BeadData,
  ) => {
    set({
      phase: 'exploration',
      scene: sceneData.scene,
      zones: sceneData.zones,
      items: sceneData.items,
      selectedZoneId: null,
      selectedItemId: null,
      _clueDefinitions: clueDefinitions,
      clues: {
        total: clueDefinitions.length,
        foundCount: 0,
        foundIds: [],
        records: [],
      },
      bead: {
        found: false,
        itemId: beadData.itemId,
        visible: false,
        active: false,
        hintText: beadData.hintText,
      },
    });
    get().pushHistory('completeOpening', '进入探索阶段');
  },

  goToEnding: () => {
    set({ phase: 'ending' });
    get().pushHistory('goToEnding', '进入幕终');
  },

  resetGame: () => {
    set({
      phase: 'start',
      actId: 'act1_scene1',
      scene: null,
      zones: [],
      items: [],
      selectedZoneId: null,
      selectedItemId: null,
      bead: {
        found: false,
        itemId: '',
        visible: false,
        active: false,
        hintText: '',
      },
      clues: { total: 0, foundCount: 0, foundIds: [], records: [] },
      _clueDefinitions: [],
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
      history: [],
    });
  },

  pushHistory: (action: string, detail?: string) => {
    set((state) => ({
      history: [
        ...state.history,
        {
          timestamp: Date.now(),
          phase: state.phase,
          action,
          detail,
        },
      ],
    }));
  },
});
