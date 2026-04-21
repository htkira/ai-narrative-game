import { create } from 'zustand';
import type { GameStore } from './types';
import { createPhaseSlice } from './slices/phaseSlice';
import { createExplorationSlice } from './slices/explorationSlice';
import { createBeadSlice } from './slices/beadSlice';
import { createClueSlice } from './slices/clueSlice';
import { createDebateSlice } from './slices/debateSlice';

export const useGameStore = create<GameStore>()((...a) => ({
  ...createPhaseSlice(...a),
  ...createExplorationSlice(...a),
  ...createBeadSlice(...a),
  ...createClueSlice(...a),
  ...createDebateSlice(...a),
}));

export type { GameStore } from './types';
