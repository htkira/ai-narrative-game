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
import { endingText } from './mockData/debate';
import { Images } from '@/utils/assets';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ??
  'http://localhost:3001';

interface InitResponse {
  sessionId: string;
  scene: {
    scene: SceneData['scene'];
    zones: SceneData['zones'];
    items: SceneData['items'];
  };
  beadData: BeadData;
  clueDefinitions: ClueDefinition[];
  debateInitData: DebateInitData;
  itemDescriptions: Record<string, string>;
  beadRemnants: Record<string, string>;
  sceneImageUrl: string;
  itemIconUrls: Record<string, string>;
  npcPortraitUrl: string;
}

export class ApiContentProvider implements IContentProvider {
  private sessionId = '';
  private sceneData: SceneData | null = null;
  private beadDataCache: BeadData | null = null;
  private clueDefinitionsCache: ClueDefinition[] = [];
  private debateInitDataCache: DebateInitData | null = null;
  private itemDescriptionsCache: Record<string, string> = {};
  private beadRemnantsCache: Record<string, string> = {};
  private npcPortraitUrl = '';
  private initAbortController: AbortController | null = null;

  async init(): Promise<void> {
    this.initAbortController?.abort();
    const ac = new AbortController();
    this.initAbortController = ac;

    const res = await fetch(`${API_BASE}/api/game/init`, {
      method: 'POST',
      signal: ac.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[ApiContentProvider] init failed (${res.status}): ${body}`);
    }
    const data: InitResponse = await res.json();

    this.sessionId = data.sessionId;
    this.sceneData = data.scene;
    this.beadDataCache = data.beadData;
    this.clueDefinitionsCache = data.clueDefinitions;
    this.debateInitDataCache = data.debateInitData;
    this.itemDescriptionsCache = data.itemDescriptions;
    this.beadRemnantsCache = data.beadRemnants;
    this.npcPortraitUrl = data.npcPortraitUrl;

    if (this.beadDataCache) {
      this.beadDataCache.iconUrl = Images.bead;
    }
    if (this.sceneData) {
      for (const item of this.sceneData.items) {
        if (item.category === 'special') {
          item.iconUrl = Images.bead;
        }
      }
    }
  }

  abortInit(): void {
    this.initAbortController?.abort();
    this.initAbortController = null;
  }

  // ---- 开场（固定文本） ----

  getOpeningDialogs(): OpeningDialog[] {
    return openingDialogs;
  }

  // ---- 探索（从 init 缓存读取） ----

  getInitialScene(): SceneData {
    if (!this.sceneData) throw new Error('[ApiContentProvider] not initialized');
    return this.sceneData;
  }

  getZones(): Zone[] {
    return this.getInitialScene().zones;
  }

  getItemsByZone(zoneId: string): Item[] {
    return this.getInitialScene().items.filter((i) => i.zoneId === zoneId);
  }

  getItemDescription(itemId: string): string {
    return this.itemDescriptionsCache[itemId] ?? '（未找到该物品的描述）';
  }

  getBeadData(): BeadData {
    if (!this.beadDataCache) throw new Error('[ApiContentProvider] not initialized');
    return this.beadDataCache;
  }

  getBeadRemnant(itemId: string): string | null {
    return this.beadRemnantsCache[itemId] ?? null;
  }

  getClueDefinitions(): ClueDefinition[] {
    return this.clueDefinitionsCache;
  }

  // ---- 辩论 ----

  getDebateInitData(): DebateInitData {
    if (!this.debateInitDataCache) throw new Error('[ApiContentProvider] not initialized');
    return {
      ...this.debateInitDataCache,
      npc: {
        ...this.debateInitDataCache.npc,
        portraitUrl: this.npcPortraitUrl || undefined,
      },
    };
  }

  async processQuestion(text: string, context: DebateContext): Promise<DebateResponse> {
    const res = await fetch(`${API_BASE}/api/game/debate/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, text, context }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[ApiContentProvider] processQuestion failed (${res.status}): ${body}`);
    }
    return res.json();
  }

  async processEvidence(
    evidenceId: string,
    claimId: string,
    text?: string,
  ): Promise<EvidenceResult> {
    const res = await fetch(`${API_BASE}/api/game/debate/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, evidenceId, claimId, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[ApiContentProvider] processEvidence failed (${res.status}): ${body}`);
    }
    return res.json();
  }

  // ---- 幕终（固定文本） ----

  getEndingText(): string {
    return endingText;
  }
}
