// ============================================================
// 白家村 · 第一世第一幕  —— 内容提供层类型定义
// 定义 IContentProvider 接口及其辅助类型
// ============================================================

import type {
  OpeningDialog,
  Scene,
  Zone,
  Item,
  Clue,
  NPC,
  Claim,
} from './game';

/** getInitialScene 返回的完整场景数据包 */
export interface SceneData {
  scene: Scene;
  zones: Zone[];
  items: Item[];
}

/** getBeadData 返回的佛珠初始数据 */
export interface BeadData {
  itemId: string;
  name: string;
  description: string;
  iconUrl: string;
  hintText: string;
}

/** 线索定义（用于 MockContentProvider 提供完整线索表） */
export interface ClueDefinition extends Clue {}

/** getDebateInitData 返回的辩论初始化数据 */
export interface DebateInitData {
  npc: NPC;
  claims: Claim[];
  openingSpeech: string;
}

/** processQuestion 需要的当前辩论上下文 */
export interface DebateContext {
  round: number;
  currentClaimId: string | null;
  refutedClaimIds: string[];
  attitudeStage: string;
}

/** processQuestion 返回的响应 */
export interface DebateResponse {
  npcSpeech: string;
  claimUpdate?: {
    claimId: string;
    newStatus: 'active' | 'weakened' | 'refuted';
  };
  attitudeChange?: string;
}

/** processEvidence 返回的物证判断结果 */
export interface EvidenceResult {
  hit: boolean;
  npcSpeech: string;
  claimUpdate?: {
    claimId: string;
    newStatus: 'active' | 'weakened' | 'refuted';
  };
  attitudeChange?: string;
  destinationUnlocked?: boolean;
}

/**
 * 统一内容提供接口
 *
 * MockContentProvider — 本地 mock 数据（init 为空操作）
 * ApiContentProvider — 后端 BFF（init 预取全部数据，getter 从缓存读取）
 */
export interface IContentProvider {
  /**
   * 异步初始化：ApiContentProvider 在此调用后端 /api/game/init
   * 预取全部场景 / 物品 / 线索 / 辩论初始化数据。
   * MockContentProvider 为空操作。
   */
  init(): Promise<void>;

  // 开场（固定文本，不依赖 AI）
  getOpeningDialogs(): OpeningDialog[];

  // 探索（init 后从缓存读取，保持同步）
  getInitialScene(): SceneData;
  getZones(): Zone[];
  getItemsByZone(zoneId: string): Item[];
  getItemDescription(itemId: string): string;
  getBeadData(): BeadData;
  getBeadRemnant(itemId: string): string | null;
  getClueDefinitions(): ClueDefinition[];

  // 辩论（init 后 getter 同步；交互方法需要实时请求，返回 Promise）
  getDebateInitData(): DebateInitData;
  processQuestion(text: string, context: DebateContext): Promise<DebateResponse>;
  processEvidence(evidenceId: string, claimId: string, text?: string): Promise<EvidenceResult>;

  // 幕终
  getEndingText(): string;
}
