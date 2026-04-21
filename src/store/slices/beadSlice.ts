import type { StateCreator } from 'zustand';
import type { GameStore, BeadSlice } from '../types';

export const createBeadSlice: StateCreator<
  GameStore,
  [],
  [],
  BeadSlice
> = (set, get) => ({
  bead: {
    found: false,
    itemId: '',
    visible: false,
    active: false,
    hintText: '',
  },

  useBead: (itemId: string, remnantText: string) => {
    const state = get();
    if (!state.bead.found || !state.bead.active) return;

    const itemIndex = state.items.findIndex((i) => i.itemId === itemId);
    const item = state.items[itemIndex];
    if (itemIndex === -1 || !item) return;
    if (!item.beadReactive || item.isBeadUnlocked) return;

    const updatedItems = [...state.items];
    updatedItems[itemIndex] = {
      ...item,
      isBeadUnlocked: true,
      beadText: remnantText,
    };

    set({
      items: updatedItems,
      bead: { ...state.bead, active: false },
    });

    // If the remnant reveals a bead_memory clue, auto-collect it
    const beadClue = state._clueDefinitions.find(
      (c) => c.sourceItemId === itemId && c.type === 'bead_memory',
    );
    if (beadClue && !state.clues.foundIds.includes(beadClue.clueId)) {
      get().addClue(beadClue.clueId);
    }

    get().pushHistory('useBead', `对 ${item.name} 使用佛珠`);
  },
});
