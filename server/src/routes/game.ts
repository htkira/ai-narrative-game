/**
 * 游戏 API 路由
 *
 * POST /api/game/init          — 初始化游戏（探索+辩论+图片生成全流程）
 * POST /api/game/debate/question — 辩论追问
 * POST /api/game/debate/evidence — 出示物证
 */

import { Router } from 'express';
import { runExplorationWorkflow } from '../workflows/exploration/index.js';
import {
  generateDebateInit,
  validateDebateInit,
  processDebateQuestion,
  processDebateEvidence,
  calculateAttitude,
} from '../workflows/debate/index.js';
import { generateSceneImage } from '../workflows/imageGen.js';
import { generateItemIcons } from '../workflows/itemIconGen.js';
import { generateNpcPortrait } from '../workflows/npcPortraitGen.js';
import {
  createSession,
  getSession,
  addDebateHistory,
  addRefutedClaim,
} from '../session/store.js';
import type { DebateContext, DebateHistoryEntry } from '../workflows/debate/types.js';
import type { ItemIconInput } from '../workflows/itemIconGen.js';

class ClientGoneError extends Error {
  constructor() {
    super('Client disconnected');
    this.name = 'ClientGoneError';
  }
}

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/game/init
// ---------------------------------------------------------------------------

router.post('/init', async (req, res) => {
  const startTime = Date.now();

  let clientGone = false;
  req.on('close', () => {
    if (!res.writableEnded) {
      clientGone = true;
      console.log('[game/init] Client disconnected, will abort at next checkpoint');
    }
  });

  const assertClient = () => {
    if (clientGone) throw new ClientGoneError();
  };

  try {
    console.log('[game/init] Starting game initialization...');

    // Steps 1-3: Exploration workflow (scene skeleton → item details → clue mapping)
    assertClient();
    console.log('[game/init] Running exploration workflow...');
    const explorationWf = await runExplorationWorkflow();
    const {
      result: explorationResult,
      steps: workflowSteps,
      totalUsage: explorationUsage,
      intermediates,
    } = explorationWf;
    console.log(
      `[game/init] Exploration complete (${explorationWf.totalDurationMs}ms)`,
    );

    // Step 4: Debate init (NPC claims generation)
    assertClient();
    console.log('[game/init] Generating debate init data...');
    const debateStep = await generateDebateInit(explorationResult);
    const debateInitData = debateStep.data;

    const debateValidation = validateDebateInit(
      debateInitData,
      explorationResult.clueDefinitions,
      explorationResult.items,
    );
    if (!debateValidation.valid) {
      console.warn(
        '[game/init] Debate validation warnings:',
        debateValidation.errors,
      );
    }
    console.log(
      `[game/init] Debate init complete (${debateStep.durationMs}ms)`,
    );

    // Step 5: Image generation — scene / item icons / NPC portrait (parallel)
    assertClient();
    console.log('[game/init] Generating images in parallel...');

    const iconInputs: ItemIconInput[] = explorationResult.items.map(
      (item) => ({
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        iconTag: item.iconTag,
        category: item.category,
      }),
    );

    const [sceneImgSettled, iconsSettled, portraitSettled] =
      await Promise.allSettled([
        generateSceneImage({
          sceneTitle: explorationResult.scene.title,
          sceneDescription: explorationResult.scene.description,
          imageAlt: explorationResult.scene.imageAlt,
        }),
        generateItemIcons(iconInputs),
        generateNpcPortrait({
          name: debateInitData.npc.name,
          role: debateInitData.npc.role,
          appearance: debateInitData.npc.appearance,
          tone: debateInitData.npc.tone,
        }),
      ]);

    assertClient();

    const sceneImageUrl =
      sceneImgSettled.status === 'fulfilled'
        ? sceneImgSettled.value.imageDataUrl
        : '';
    if (sceneImgSettled.status === 'rejected') {
      console.error(
        '[game/init] Scene image failed:',
        sceneImgSettled.reason,
      );
    }

    let itemIconUrls: Record<string, string> = {};
    if (iconsSettled.status === 'fulfilled') {
      itemIconUrls = Object.fromEntries(iconsSettled.value.icons);
    } else {
      console.error('[game/init] Item icons failed:', iconsSettled.reason);
    }

    const npcPortraitUrl =
      portraitSettled.status === 'fulfilled'
        ? portraitSettled.value.imageDataUrl
        : '';
    if (portraitSettled.status === 'rejected') {
      console.error(
        '[game/init] NPC portrait failed:',
        portraitSettled.reason,
      );
    }

    console.log('[game/init] Image generation complete');

    // Fill image URLs into exploration result for SceneData coherence
    explorationResult.scene.imageUrl = sceneImageUrl;
    if (sceneImgSettled.status === 'fulfilled') {
      explorationResult.scene.backgroundColor = sceneImgSettled.value.backgroundColor;
    }
    for (const item of explorationResult.items) {
      item.iconUrl = itemIconUrls[item.itemId] ?? '';
    }

    // Persist session
    const totalUsage = {
      promptTokens:
        explorationUsage.promptTokens + debateStep.usage.promptTokens,
      completionTokens:
        explorationUsage.completionTokens +
        debateStep.usage.completionTokens,
      totalTokens:
        explorationUsage.totalTokens + debateStep.usage.totalTokens,
    };

    const session = createSession({
      explorationResult,
      debateInitData,
      clueDefinitions: explorationResult.clueDefinitions,
      sceneImageUrl,
      itemIconUrls,
      npcPortraitUrl,
      workflowSteps,
      workflowIntermediates: intermediates,
      debateStepLog: {
        durationMs: debateStep.durationMs,
        usage: debateStep.usage,
      },
      totalUsage,
      totalDurationMs: Date.now() - startTime,
    });

    // Build response matching plan §4.2
    const response = {
      sessionId: session.id,
      scene: {
        scene: explorationResult.scene,
        zones: explorationResult.zones,
        items: explorationResult.items,
      },
      beadData: explorationResult.beadData,
      clueDefinitions: explorationResult.clueDefinitions,
      debateInitData,
      itemDescriptions: explorationResult.itemDescriptions,
      beadRemnants: explorationResult.beadRemnants,
      sceneImageUrl,
      itemIconUrls,
      npcPortraitUrl,
    };

    const elapsed = Date.now() - startTime;
    console.log(
      `[game/init] Done! session=${session.id} elapsed=${elapsed}ms`,
    );
    res.json(response);
  } catch (error) {
    if (error instanceof ClientGoneError) {
      const elapsed = Date.now() - startTime;
      console.log(`[game/init] Aborted after ${elapsed}ms — client disconnected, skipping remaining steps`);
      return;
    }
    const elapsed = Date.now() - startTime;
    console.error(`[game/init] Failed after ${elapsed}ms:`, error);
    res.status(500).json({
      error: 'Game initialization failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/debate/question
// ---------------------------------------------------------------------------

router.post('/debate/question', async (req, res) => {
  try {
    const { sessionId, text, context } = req.body as {
      sessionId: string;
      text: string;
      context?: DebateContext;
    };

    if (!sessionId || !text) {
      res.status(400).json({ error: 'Missing required fields: sessionId, text' });
      return;
    }

    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: `Session ${sessionId} not found` });
      return;
    }

    const debateContext: DebateContext = context ?? {
      round: session.debateRound + 1,
      currentClaimId: null,
      refutedClaimIds: session.refutedClaimIds,
      attitudeStage: calculateAttitude(
        session.refutedClaimIds.length,
        session.debateInitData.claims.length,
      ),
    };

    const result = await processDebateQuestion(
      text,
      debateContext,
      session.debateInitData,
      session.clueDefinitions,
      session.debateHistory,
    );

    const newRound = session.debateRound + 1;
    const entry: DebateHistoryEntry = {
      round: newRound,
      type: 'question',
      playerInput: text,
      npcResponse: result.data.npcSpeech,
      resultTag: 'info',
    };
    addDebateHistory(sessionId, entry);

    res.json(result.data);
  } catch (error) {
    console.error('[debate/question] Error:', error);
    res.status(500).json({
      error: 'Debate question processing failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/debate/evidence
// ---------------------------------------------------------------------------

router.post('/debate/evidence', async (req, res) => {
  try {
    const { sessionId, evidenceId, claimId, text } = req.body as {
      sessionId: string;
      evidenceId: string;
      claimId: string;
      text?: string;
    };

    if (!sessionId || !evidenceId || !claimId) {
      res
        .status(400)
        .json({ error: 'Missing required fields: sessionId, evidenceId, claimId' });
      return;
    }

    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: `Session ${sessionId} not found` });
      return;
    }

    const context: DebateContext = {
      round: session.debateRound + 1,
      currentClaimId: claimId,
      refutedClaimIds: session.refutedClaimIds,
      attitudeStage: calculateAttitude(
        session.refutedClaimIds.length,
        session.debateInitData.claims.length,
      ),
    };

    const result = await processDebateEvidence(
      evidenceId,
      claimId,
      text,
      context,
      session.debateInitData,
      session.clueDefinitions,
      session.debateHistory,
    );

    const newRound = session.debateRound + 1;
    const entry: DebateHistoryEntry = {
      round: newRound,
      type: 'evidence',
      playerInput: text ?? `出示证据: ${evidenceId}`,
      evidenceId,
      claimId,
      npcResponse: result.data.npcSpeech,
      resultTag: result.data.hit ? 'hit' : 'miss',
    };
    addDebateHistory(sessionId, entry);

    if (result.data.hit && result.data.claimUpdate?.newStatus === 'refuted') {
      addRefutedClaim(sessionId, claimId);
    }

    res.json(result.data);
  } catch (error) {
    console.error('[debate/evidence] Error:', error);
    res.status(500).json({
      error: 'Evidence processing failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
