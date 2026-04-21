/**
 * B4 辩论工作流验证测试
 *
 * 运行方式:
 *   cd server && npx tsx test/test-debate.ts
 *   cd server && npx tsx test/test-debate.ts --fixture test/fixtures/exploration-result.json
 *
 * 验证内容:
 *   - NPC 观点生成质量（3-4 条、每条可驳倒）
 *   - 模拟 2-3 轮追问，检查 NPC 回应质量
 *   - 模拟出示正确物证，检查命中判断和 NPC 后撤话术
 *   - 模拟出示错误物证，检查防御性回应
 *   - 模拟全部驳倒后的松口收束
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateDebateInit,
  validateDebateInit,
  processDebateQuestion,
  processDebateEvidence,
  calculateAttitude,
  type DebateInitData,
  type DebateContext,
  type DebateHistoryEntry,
  type DebateStepResult,
  type DebateResponse,
  type EvidenceResult,
  type DebateValidationResult,
  type AttitudeStage,
} from '../src/workflows/debate/index.js';
import type {
  ExplorationResult,
  ClueRecord,
} from '../src/workflows/exploration/types.js';
import type { TokenUsage } from '../src/llm/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(__dirname, 'fixtures', 'exploration-result.json');

// ---- Parse args ----

const args = process.argv.slice(2);
let fixturePath = DEFAULT_FIXTURE;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--fixture' && args[i + 1]) {
    fixturePath = args[i + 1]!;
  }
}

// ---- Helpers ----

function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

function printValidation(v: DebateValidationResult): void {
  if (v.valid) {
    console.log('  ✅ 校验通过');
  } else {
    console.log(`  ⚠️  校验发现 ${v.errors.length} 个问题:`);
    for (const err of v.errors) {
      console.log(`    - [${err.rule}] ${err.message}`);
    }
  }
}

function printStep(
  name: string,
  result: { durationMs: number; usage: TokenUsage },
): void {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📋 ${name}`);
  console.log(`   耗时: ${result.durationMs}ms`);
  console.log(
    `   Tokens: ${result.usage.promptTokens}+${result.usage.completionTokens}=${result.usage.totalTokens}`,
  );
}

// ---- Mutable test state (simulates session) ----

interface TestState {
  debateInit: DebateInitData;
  context: DebateContext;
  history: DebateHistoryEntry[];
  round: number;
}

function createTestState(debateInit: DebateInitData): TestState {
  return {
    debateInit,
    context: {
      round: 1,
      currentClaimId: debateInit.claims[0]?.claimId ?? null,
      refutedClaimIds: [],
      attitudeStage: 'assertive',
    },
    history: [],
    round: 1,
  };
}

function recordQuestionResult(
  state: TestState,
  question: string,
  result: DebateResponse,
): void {
  state.history.push({
    round: state.round,
    type: 'question',
    playerInput: question,
    npcResponse: result.npcSpeech,
    resultTag: 'info',
  });
  if (result.claimUpdate) {
    const claim = state.debateInit.claims.find(
      (c) => c.claimId === result.claimUpdate!.claimId,
    );
    if (claim) {
      claim.status = result.claimUpdate.newStatus;
    }
  }
  state.round++;
  state.context.round = state.round;
}

function recordEvidenceResult(
  state: TestState,
  evidenceId: string,
  claimId: string,
  result: EvidenceResult,
): void {
  state.history.push({
    round: state.round,
    type: 'evidence',
    playerInput: `出示证据 ${evidenceId}`,
    evidenceId,
    claimId,
    npcResponse: result.npcSpeech,
    resultTag: result.hit ? 'hit' : 'miss',
  });

  if (result.hit && result.claimUpdate) {
    const claim = state.debateInit.claims.find(
      (c) => c.claimId === result.claimUpdate!.claimId,
    );
    if (claim) {
      claim.status = 'refuted';
    }
    state.context.refutedClaimIds.push(result.claimUpdate.claimId);
    state.context.attitudeStage = (result.attitudeChange ??
      state.context.attitudeStage) as AttitudeStage;
  }

  state.round++;
  state.context.round = state.round;

  // Move to next active claim
  const nextActive = state.debateInit.claims.find(
    (c) => !state.context.refutedClaimIds.includes(c.claimId),
  );
  state.context.currentClaimId = nextActive?.claimId ?? null;
}

// ---- Main test flow ----

async function main(): Promise<void> {
  console.log('═'.repeat(50));
  console.log('辩论工作流测试');
  console.log('═'.repeat(50));
  console.log(`Fixture: ${fixturePath}\n`);

  // Load fixture
  const raw = await readFile(fixturePath, 'utf-8');
  const fixture = JSON.parse(raw) as {
    result: ExplorationResult;
    intermediates: unknown;
  };
  const explorationResult = fixture.result;

  console.log(`已加载探索数据:`);
  console.log(`  场景: ${explorationResult.scene.title}`);
  console.log(`  物品: ${explorationResult.items.length} 个`);
  console.log(`  线索: ${explorationResult.clueDefinitions.length} 条`);

  let totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  let allPassed = true;

  // ========================================
  // Phase 1: Generate NPC claims
  // ========================================
  console.log(`\n${'═'.repeat(50)}`);
  console.log('Phase 1: NPC观点生成');
  console.log('═'.repeat(50));

  const initResult = await generateDebateInit(explorationResult);
  printStep('NPC观点生成', initResult);
  totalUsage = mergeUsage(totalUsage, initResult.usage);

  const debateInit = initResult.data;
  console.log(`\n  NPC: ${debateInit.npc.name} (${debateInit.npc.role})`);
  console.log(`  语气: ${debateInit.npc.tone}`);
  console.log(`  外貌: ${debateInit.npc.appearance}`);
  console.log(`  开场白: ${debateInit.openingSpeech.slice(0, 80)}...`);
  console.log(`  观点数: ${debateInit.claims.length}`);

  for (const claim of debateInit.claims) {
    console.log(`\n  [${claim.claimId}] ${claim.text}`);
    console.log(`    论据: ${claim.basis}`);
    console.log(`    可驳倒: ${claim.refutableByClueIds.join(', ')}`);
  }

  // Validate
  const validation = validateDebateInit(
    debateInit,
    explorationResult.clueDefinitions,
    explorationResult.items,
  );
  printValidation(validation);
  if (!validation.valid) allPassed = false;

  // Initialize test state
  const state = createTestState(debateInit);

  // ========================================
  // Phase 2: Simulated questions
  // ========================================
  console.log(`\n${'═'.repeat(50)}`);
  console.log('Phase 2: 模拟追问 (2轮)');
  console.log('═'.repeat(50));

  const questions = [
    '你说的这些，有什么真凭实据吗？光凭猜测就定罪，未免太草率了吧？',
    '屋里这般打斗痕迹，难道不该先查清楚到底发生了什么吗？',
  ];

  for (const question of questions) {
    console.log(`\n  🗣️ 玩家: "${question}"`);

    const qResult = await processDebateQuestion(
      question,
      state.context,
      state.debateInit,
      explorationResult.clueDefinitions,
      state.history,
    );
    printStep(`追问第${state.round}轮`, qResult);
    totalUsage = mergeUsage(totalUsage, qResult.usage);

    console.log(`  💬 NPC: "${qResult.data.npcSpeech}"`);
    if (qResult.data.claimUpdate) {
      console.log(
        `  📌 观点变化: ${qResult.data.claimUpdate.claimId} → ${qResult.data.claimUpdate.newStatus}`,
      );
    }

    recordQuestionResult(state, question, qResult.data);
  }
  console.log('\n  ✅ 追问模拟完成');

  // ========================================
  // Phase 3: Evidence miss
  // ========================================
  console.log(`\n${'═'.repeat(50)}`);
  console.log('Phase 3: 模拟出示错误物证');
  console.log('═'.repeat(50));

  const firstClaim = state.debateInit.claims.find(
    (c) => !state.context.refutedClaimIds.includes(c.claimId),
  )!;

  // Find a clueId NOT in this claim's refutableByClueIds
  const wrongClueId = explorationResult.clueDefinitions.find(
    (c) =>
      c.usableAsEvidence &&
      !firstClaim.refutableByClueIds.includes(c.clueId),
  )?.clueId;

  if (wrongClueId) {
    console.log(
      `\n  🎯 目标观点: [${firstClaim.claimId}] ${firstClaim.text}`,
    );
    console.log(`  ❌ 出示错误证据: ${wrongClueId}`);

    const missResult = await processDebateEvidence(
      wrongClueId,
      firstClaim.claimId,
      '你看看这个',
      state.context,
      state.debateInit,
      explorationResult.clueDefinitions,
      state.history,
    );
    printStep('物证判断(miss)', missResult);
    totalUsage = mergeUsage(totalUsage, missResult.usage);

    console.log(`  命中: ${missResult.data.hit}`);
    console.log(`  💬 NPC: "${missResult.data.npcSpeech}"`);

    if (missResult.data.hit) {
      console.log('  ⚠️  预期 miss 但实际 hit！');
      allPassed = false;
    } else {
      console.log('  ✅ 正确返回 miss');
    }

    recordEvidenceResult(
      state,
      wrongClueId,
      firstClaim.claimId,
      missResult.data,
    );
  } else {
    console.log('  ⚠️  无法找到合适的错误证据用于测试');
  }

  // ========================================
  // Phase 4: Evidence hit (first claim)
  // ========================================
  console.log(`\n${'═'.repeat(50)}`);
  console.log('Phase 4: 模拟出示正确物证');
  console.log('═'.repeat(50));

  const stillFirstClaim = state.debateInit.claims.find(
    (c) => !state.context.refutedClaimIds.includes(c.claimId),
  )!;
  const correctClueId = stillFirstClaim.refutableByClueIds[0]!;

  console.log(
    `\n  🎯 目标观点: [${stillFirstClaim.claimId}] ${stillFirstClaim.text}`,
  );
  console.log(`  ✅ 出示正确证据: ${correctClueId}`);

  const hitResult = await processDebateEvidence(
    correctClueId,
    stillFirstClaim.claimId,
    undefined,
    state.context,
    state.debateInit,
    explorationResult.clueDefinitions,
    state.history,
  );
  printStep('物证判断(hit)', hitResult);
  totalUsage = mergeUsage(totalUsage, hitResult.usage);

  console.log(`  命中: ${hitResult.data.hit}`);
  console.log(`  💬 NPC: "${hitResult.data.npcSpeech}"`);
  if (hitResult.data.claimUpdate) {
    console.log(
      `  📌 观点变化: ${hitResult.data.claimUpdate.claimId} → ${hitResult.data.claimUpdate.newStatus}`,
    );
  }
  if (hitResult.data.attitudeChange) {
    console.log(`  🎭 态度变化: → ${hitResult.data.attitudeChange}`);
  }

  if (!hitResult.data.hit) {
    console.log('  ⚠️  预期 hit 但实际 miss！');
    allPassed = false;
  } else {
    console.log('  ✅ 正确返回 hit');
  }

  recordEvidenceResult(
    state,
    correctClueId,
    stillFirstClaim.claimId,
    hitResult.data,
  );

  // ========================================
  // Phase 5: Refute remaining claims → confession
  // ========================================
  console.log(`\n${'═'.repeat(50)}`);
  console.log('Phase 5: 逐一驳倒剩余观点 → 松口');
  console.log('═'.repeat(50));

  let remainingClaims = state.debateInit.claims.filter(
    (c) => !state.context.refutedClaimIds.includes(c.claimId),
  );

  while (remainingClaims.length > 0) {
    const claim = remainingClaims[0]!;
    const clueId = claim.refutableByClueIds[0]!;

    console.log(`\n  🎯 驳倒: [${claim.claimId}] ${claim.text}`);
    console.log(`  📎 证据: ${clueId}`);

    const result = await processDebateEvidence(
      clueId,
      claim.claimId,
      undefined,
      state.context,
      state.debateInit,
      explorationResult.clueDefinitions,
      state.history,
    );
    printStep(`驳倒 ${claim.claimId}`, result);
    totalUsage = mergeUsage(totalUsage, result.usage);

    console.log(`  命中: ${result.data.hit}`);
    console.log(`  💬 NPC: "${result.data.npcSpeech}"`);
    if (result.data.attitudeChange) {
      console.log(`  🎭 态度: → ${result.data.attitudeChange}`);
    }
    if (result.data.destinationUnlocked) {
      console.log(`  🗺️ 目的地解锁`);
    }

    if (!result.data.hit) {
      console.log('  ⚠️  驳倒失败！这不应该发生');
      allPassed = false;
      break;
    }

    recordEvidenceResult(state, clueId, claim.claimId, result.data);

    remainingClaims = state.debateInit.claims.filter(
      (c) => !state.context.refutedClaimIds.includes(c.claimId),
    );
  }

  // Verify confession
  const lastEntry = state.history[state.history.length - 1];
  if (lastEntry?.resultTag === 'hit') {
    const allRefuted =
      state.context.refutedClaimIds.length === state.debateInit.claims.length;
    if (allRefuted) {
      console.log('\n  ✅ 所有观点已驳倒');
      const expectedAttitude = calculateAttitude(
        state.context.refutedClaimIds.length,
        state.debateInit.claims.length,
      );
      console.log(`  🎭 最终态度: ${state.context.attitudeStage}`);
      console.log(`  🎭 预期态度: ${expectedAttitude}`);
      if (state.context.attitudeStage !== 'confessing') {
        console.log('  ⚠️  最终态度不是 confessing');
        allPassed = false;
      }
    } else {
      console.log('  ⚠️  未能驳倒所有观点');
      allPassed = false;
    }
  }

  // ========================================
  // Summary
  // ========================================
  console.log(`\n${'═'.repeat(50)}`);
  console.log('辩论工作流测试摘要');
  console.log('═'.repeat(50));
  console.log(`总耗时: ${state.history.reduce((_, __) => 0, 0)}ms (各步详见上方)`);
  console.log(
    `总Tokens: ${totalUsage.promptTokens}+${totalUsage.completionTokens}=${totalUsage.totalTokens}`,
  );
  console.log(`辩论轮次: ${state.round - 1}`);
  console.log(`对话历史: ${state.history.length} 条`);
  console.log(`驳倒观点: ${state.context.refutedClaimIds.length}/${state.debateInit.claims.length}`);
  console.log(`最终态度: ${state.context.attitudeStage}`);

  console.log();
  if (allPassed) {
    console.log('🎉 辩论工作流全部测试通过！');
  } else {
    console.log('⚠️  存在测试问题，请检查上方日志。');
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ 测试执行失败:', err);
  process.exit(1);
});
