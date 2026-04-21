import type {
  IContentProvider,
  SceneData,
  BeadData,
  ClueDefinition,
  DebateInitData,
  DebateContext,
  DebateResponse,
  EvidenceResult,
} from '@/types/content';
import type { OpeningDialog, Zone, Item } from '@/types/game';

import { openingDialogs } from './mockData/opening';
import {
  sceneData,
  zones as mockZones,
  items as mockItems,
  beadData as mockBeadData,
  beadRemnants,
  clueDefinitions as mockClueDefinitions,
  itemDescriptions,
} from './mockData/exploration';
import {
  debateInitData,
  mockProcessQuestion,
  mockProcessEvidence,
  endingText,
} from './mockData/debate';

export class MockContentProvider implements IContentProvider {
  async init(): Promise<void> {
    // Mock 不需要预取
  }

  // ---- 开场 ----

  getOpeningDialogs(): OpeningDialog[] {
    return openingDialogs;
  }

  // ---- 探索 ----

  getInitialScene(): SceneData {
    return sceneData;
  }

  getZones(): Zone[] {
    return mockZones;
  }

  getItemsByZone(zoneId: string): Item[] {
    return mockItems.filter((item) => item.zoneId === zoneId);
  }

  getItemDescription(itemId: string): string {
    return itemDescriptions[itemId] ?? '（未找到该物品的描述）';
  }

  getBeadData(): BeadData {
    return mockBeadData;
  }

  getBeadRemnant(itemId: string): string | null {
    return beadRemnants[itemId] ?? null;
  }

  getClueDefinitions(): ClueDefinition[] {
    return mockClueDefinitions;
  }

  // ---- 辩论 ----

  getDebateInitData(): DebateInitData {
    return debateInitData;
  }

  async processQuestion(text: string, context: DebateContext): Promise<DebateResponse> {
    return mockProcessQuestion(text, context);
  }

  async processEvidence(evidenceId: string, claimId: string, text?: string): Promise<EvidenceResult> {
    return mockProcessEvidence(evidenceId, claimId, text);
  }

  // ---- 幕终 ----

  getEndingText(): string {
    return endingText;
  }
}
