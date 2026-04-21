// ============================================================
// 白家村 · 第一世第一幕  —— 游戏核心类型定义
// 与 ai-text-adventure-dev-architecture.md 第 8 节状态字段字典对齐
// ============================================================

/** 游戏阶段 */
export type GamePhase = 'start' | 'opening' | 'exploration' | 'debate' | 'ending';

// ---- 场景 (8.1) ----

export interface Scene {
  sceneId: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  backgroundColor?: string;
}

// ---- 区域 (8.2) ----

export interface Zone {
  zoneId: string;
  name: string;
  summary: string;
  itemIds: string[];
  unlocked: boolean;
}

// ---- 物品 (8.3) ----

export type ItemCategory = 'atmosphere' | 'false_clue' | 'true_clue' | 'special';

export interface Item {
  itemId: string;
  name: string;
  iconUrl: string;
  category: ItemCategory;
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
}

// ---- 佛珠 / 残缺念珠 (8.4) ----

export interface Bead {
  found: boolean;
  itemId: string;
  visible: boolean;
  active: boolean;
  hintText: string;
}

// ---- 线索 (8.5 & 8.6) ----

export type ClueType =
  | 'pathology'
  | 'pharmacology'
  | 'conflict_trace'
  | 'bead_memory'
  | 'misc';

export interface Clue {
  clueId: string;
  title: string;
  summary: string;
  sourceItemId: string;
  type: ClueType;
  usableAsEvidence: boolean;
}

export interface CluesState {
  total: number;
  foundCount: number;
  foundIds: string[];
  records: Clue[];
}

// ---- 辩论 (8.7 ~ 8.9) ----

export type AttitudeStage =
  | 'assertive'
  | 'defensive'
  | 'shaken'
  | 'retreating'
  | 'confessing';

export interface NPC {
  npcId: string;
  name: string;
  role: string;
  tone: string;
  currentSpeech: string;
  attitudeStage: AttitudeStage;
  portraitUrl?: string;
}

export type ClaimStatus = 'active' | 'weakened' | 'refuted';

export interface Claim {
  claimId: string;
  text: string;
  status: ClaimStatus;
  basis: string;
  refutableByClueIds: string[];
}

export interface DebateHistoryEntry {
  round: number;
  type: 'question' | 'evidence';
  playerInput: string;
  evidenceId?: string;
  claimId?: string;
  npcResponse: string;
  resultTag?: 'hit' | 'miss' | 'info';
}

export interface DebateState {
  started: boolean;
  round: number;
  npc: NPC | null;
  claims: Claim[];
  currentClaimId: string | null;
  history: DebateHistoryEntry[];
  refutedCount: number;
  ended: boolean;
  destinationUnlocked: boolean;
}

// ---- 开场演出 ----

export interface OpeningDialog {
  id: string;
  speaker: string;
  text: string;
}

// ---- 全局事件历史 ----

export interface HistoryEntry {
  timestamp: number;
  phase: GamePhase;
  action: string;
  detail?: string;
}

// ---- GameStore 顶层状态结构 (M1 将实现) ----

export interface GameState {
  phase: GamePhase;
  actId: string;
  scene: Scene | null;
  zones: Zone[];
  items: Item[];
  selectedZoneId: string | null;
  selectedItemId: string | null;
  bead: Bead;
  clues: CluesState;
  debate: DebateState;
  history: HistoryEntry[];
}
