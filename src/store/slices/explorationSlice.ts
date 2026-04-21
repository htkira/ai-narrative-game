import type { StateCreator } from 'zustand';
import type { GameStore, ExplorationSlice } from '../types';

export const createExplorationSlice: StateCreator<
  GameStore,
  [],
  [],
  ExplorationSlice
> = (set, get) => ({
  scene: null,
  zones: [],
  items: [],
  selectedZoneId: null,
  selectedItemId: null,

  selectZone: (zoneId: string) => {
    const state = get();
    set({
      selectedZoneId: zoneId,
      selectedItemId: null,
      bead: state.bead.found
        ? { ...state.bead, active: false }
        : state.bead,
    });
    get().pushHistory('selectZone', zoneId);
  },

  selectItem: (itemId: string) => {
    const state = get();
    const itemIndex = state.items.findIndex((i) => i.itemId === itemId);
    const item = state.items[itemIndex];
    if (itemIndex === -1 || !item) return;

    const updatedItems = [...state.items];
    updatedItems[itemIndex] = {
      ...item,
      isDiscovered: true,
      isExamined: true,
    };

    let updatedBead = { ...state.bead };

    // Discovering the bead item itself
    if (item.itemId === state.bead.itemId && !state.bead.found) {
      updatedBead = { ...updatedBead, found: true, visible: true };
    }

    // Activate bead icon when viewing a bead-reactive item that hasn't
    // had its remnant unlocked yet; deactivate otherwise.
    if (item.beadReactive && updatedBead.found && !item.isBeadUnlocked) {
      updatedBead = { ...updatedBead, active: true };
    } else if (updatedBead.found) {
      updatedBead = { ...updatedBead, active: false };
    }

    set({
      selectedItemId: itemId,
      items: updatedItems,
      bead: updatedBead,
    });

    // Auto-collect the clue attached to this item (idempotent)
    if (
      item.hasClue &&
      item.clueId &&
      !state.clues.foundIds.includes(item.clueId)
    ) {
      get().addClue(item.clueId);
    }

    get().pushHistory('selectItem', `${item.name} (${itemId})`);
  },

  returnToZoneList: () => {
    const state = get();
    set({
      selectedZoneId: null,
      selectedItemId: null,
      bead: state.bead.found
        ? { ...state.bead, active: false }
        : state.bead,
    });
  },
});
