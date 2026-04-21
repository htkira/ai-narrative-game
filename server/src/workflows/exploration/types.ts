import type { CallResult } from '../../llm/index.js';

// ---- Step 1: Scene Layout output (scene + zones, no items) ----

export interface SceneSkeletonScene {
  sceneId: string;
  title: string;
  description: string;
  imageAlt: string;
}

export interface SceneSkeletonZone {
  zoneId: string;
  name: string;
  summary: string;
}

export interface SceneLayoutOutput {
  scene: SceneSkeletonScene;
  zones: SceneSkeletonZone[];
}

// ---- Step 2: Item Skeleton output (items with evidenceLines) ----

export type EvidenceLine = 'A' | 'B' | 'C' | 'D' | 'E';

export interface SceneSkeletonItem {
  itemId: string;
  name: string;
  category: 'atmosphere' | 'false_clue' | 'true_clue' | 'special';
  zoneId: string;
  hasClue: boolean;
  beadReactive: boolean;
  iconTag: string;
  evidenceLines: EvidenceLine[];
}

export interface ItemSkeletonOutput {
  items: SceneSkeletonItem[];
}

// ---- Merged: Scene Layout + Item Skeleton = SceneSkeletonOutput ----

export interface SceneSkeletonOutput {
  scene: SceneSkeletonScene;
  zones: SceneSkeletonZone[];
  items: SceneSkeletonItem[];
}

// ---- Step 2: Item Details output ----

export interface ItemDescription {
  itemId: string;
  description: string;
}

export interface BeadRemnant {
  itemId: string;
  text: string;
}

export interface ItemDetailsOutput {
  descriptions: ItemDescription[];
  beadRemnants: BeadRemnant[];
}

// ---- Step 3: Clue Mapping output ----

export interface ClueRecord {
  clueId: string;
  title: string;
  summary: string;
  sourceItemId: string;
  type: 'pathology' | 'pharmacology' | 'conflict_trace' | 'bead_memory' | 'misc';
  usableAsEvidence: boolean;
}

export interface ClueMappingOutput {
  clues: ClueRecord[];
}

// ---- Assembled exploration result ----

export interface ExplorationResult {
  scene: {
    sceneId: string;
    title: string;
    description: string;
    imageUrl: string;
    imageAlt: string;
    backgroundColor?: string;
  };
  zones: Array<{
    zoneId: string;
    name: string;
    summary: string;
    itemIds: string[];
    unlocked: boolean;
  }>;
  items: Array<{
    itemId: string;
    name: string;
    iconUrl: string;
    iconTag: string;
    category: 'atmosphere' | 'false_clue' | 'true_clue' | 'special';
    zoneId: string;
    description: string;
    isDiscovered: boolean;
    isExamined: boolean;
    hasClue: boolean;
    clueId: string | null;
    beadReactive: boolean;
    beadText: string | null;
    isBeadUnlocked: boolean;
    isEvidence: boolean;
  }>;
  beadData: {
    itemId: string;
    name: string;
    description: string;
    iconUrl: string;
    hintText: string;
  };
  clueDefinitions: ClueRecord[];
  itemDescriptions: Record<string, string>;
  beadRemnants: Record<string, string>;
}

// ---- Validation ----

export interface ValidationError {
  step: string;
  rule: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ---- Step execution tracking ----

export interface StepResult<T> {
  data: T;
  usage: CallResult['usage'];
  durationMs: number;
}
