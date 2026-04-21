/**
 * Debug API 路由（仅用于开发调试）
 *
 * GET /api/debug/sessions          — 列出所有会话摘要
 * GET /api/debug/session/:id       — 查看会话完整数据（:id 可以是 "latest"）
 * GET /api/debug/workflow/:id      — 查看工作流每步中间结果
 */

import { Router } from 'express';
import {
  getSession,
  getAllSessionsSummary,
  getLatestSessionId,
} from '../session/store.js';

const router = Router();

/**
 * Replace long base64 data URLs with a short placeholder to keep
 * debug JSON responses readable.
 */
function summarizeDataUrl(url: string): string {
  if (!url || !url.startsWith('data:')) return url;
  const mimeMatch = url.match(/^data:([\w/+]+);base64,/);
  const mime = mimeMatch?.[1] ?? 'unknown';
  const base64Part = url.replace(/^data:[\w/+]+;base64,/, '');
  const sizeKB = Math.round((base64Part.length * 3) / 4 / 1024);
  return `[${mime} ~${sizeKB}KB base64]`;
}

// ---------------------------------------------------------------------------
// GET /api/debug/sessions
// ---------------------------------------------------------------------------

router.get('/sessions', (_req, res) => {
  const summaries = getAllSessionsSummary();
  res.json({
    count: summaries.length,
    latestId: getLatestSessionId(),
    sessions: summaries,
  });
});

// ---------------------------------------------------------------------------
// GET /api/debug/session/:id
// ---------------------------------------------------------------------------

router.get('/session/:id', (req, res) => {
  const id = req.params['id'];
  if (!id) {
    res.status(400).json({ error: 'Missing session ID' });
    return;
  }

  const session = getSession(id);
  if (!session) {
    const msg =
      id === 'latest'
        ? 'No sessions exist yet'
        : `Session ${id} not found`;
    res.status(404).json({ error: msg });
    return;
  }

  // Sanitize heavy image data for readability
  const sanitized = {
    id: session.id,
    createdAt: session.createdAt,
    totalDurationMs: session.totalDurationMs,
    totalUsage: session.totalUsage,
    debateRound: session.debateRound,
    refutedClaimIds: session.refutedClaimIds,
    debateHistory: session.debateHistory,

    explorationResult: {
      scene: {
        ...session.explorationResult.scene,
        imageUrl: summarizeDataUrl(session.explorationResult.scene.imageUrl),
      },
      zones: session.explorationResult.zones,
      items: session.explorationResult.items.map((item) => ({
        ...item,
        iconUrl: summarizeDataUrl(item.iconUrl),
      })),
      beadData: {
        ...session.explorationResult.beadData,
        iconUrl: summarizeDataUrl(session.explorationResult.beadData.iconUrl),
      },
      clueDefinitions: session.explorationResult.clueDefinitions,
      itemDescriptions: session.explorationResult.itemDescriptions,
      beadRemnants: session.explorationResult.beadRemnants,
    },

    debateInitData: session.debateInitData,
    debateStepLog: session.debateStepLog,

    sceneImageUrl: summarizeDataUrl(session.sceneImageUrl),
    npcPortraitUrl: summarizeDataUrl(session.npcPortraitUrl),
    itemIconUrls: Object.fromEntries(
      Object.entries(session.itemIconUrls).map(([k, v]) => [
        k,
        summarizeDataUrl(v),
      ]),
    ),
  };

  res.json(sanitized);
});

// ---------------------------------------------------------------------------
// GET /api/debug/workflow/:id
// ---------------------------------------------------------------------------

router.get('/workflow/:id', (req, res) => {
  const id = req.params['id'];
  if (!id) {
    res.status(400).json({ error: 'Missing session ID' });
    return;
  }

  const session = getSession(id);
  if (!session) {
    const msg =
      id === 'latest'
        ? 'No sessions exist yet'
        : `Session ${id} not found`;
    res.status(404).json({ error: msg });
    return;
  }

  res.json({
    sessionId: session.id,
    createdAt: session.createdAt,
    totalDurationMs: session.totalDurationMs,
    totalUsage: session.totalUsage,
    explorationSteps: session.workflowSteps,
    debateStep: session.debateStepLog,
    intermediates: session.workflowIntermediates,
  });
});

export default router;
