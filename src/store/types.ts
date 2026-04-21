import type {
  GamePhase,
  Scene,
  Zone,
  Item,
  Bead,
  CluesState,
  DebateState,
  HistoryEntry,
  Clue,
} from '../types/game';
import type {
  SceneData,
  ClueDefinition,
  BeadData,
  DebateInitData,
  DebateResponse,
  EvidenceResult,
} from '../types/content';

// ---- Phase Slice ----

export interface PhaseSlice {
  phase: GamePhase;
  actId: string;
  history: HistoryEntry[];

  startGame: () => void;
  completeOpening: (
    sceneData: SceneData,
    clueDefinitions: ClueDefinition[],
    beadData: BeadData,
  ) => void;
  goToEnding: () => void;
  resetGame: () => void;
  pushHistory: (action: string, detail?: string) => void;
}

// ---- Exploration Slice ----

export interface ExplorationSlice {
  scene: Scene | null;
  zones: Zone[];
  items: Item[];
  selectedZoneId: string | null;
  selectedItemId: string | null;

  selectZone: (zoneId: string) => void;
  selectItem: (itemId: string) => void;
  returnToZoneList: () => void;
}

// ---- Bead Slice ----

export interface BeadSlice {
  bead: Bead;

  useBead: (itemId: string, remnantText: string) => void;
}

// ---- Clue Slice ----

export interface ClueSlice {
  clues: CluesState;
  _clueDefinitions: Clue[];

  addClue: (clueId: string) => void;
}

// ---- Debate Slice ----

export interface DebateSlice {
  debate: DebateState;

  triggerDebate: (data: DebateInitData) => void;
  applyQuestionResult: (
    playerInput: string,
    response: DebateResponse,
  ) => void;
  applyEvidenceResult: (
    evidenceId: string,
    claimId: string,
    playerText: string,
    result: EvidenceResult,
  ) => void;
  setCurrentClaim: (claimId: string) => void;
}

// ---- Combined Store ----

export type GameStore = PhaseSlice &
  ExplorationSlice &
  BeadSlice &
  ClueSlice &
  DebateSlice;
