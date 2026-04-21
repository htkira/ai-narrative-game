/**
 * 探索工作流验证测试（4步工作流）
 *
 * 运行方式:
 *   cd server && npx tsx test/test-exploration.ts --step 1   # Step1: 场景布局
 *   cd server && npx tsx test/test-exploration.ts --step 2   # Step1-2: +物品骨架
 *   cd server && npx tsx test/test-exploration.ts --step 3   # Step1-3: +物品描述
 *   cd server && npx tsx test/test-exploration.ts --step 4   # Step1-4: +线索定义
 *   cd server && npx tsx test/test-exploration.ts --full      # 全量模式（含跨步校验）
 *
 * 全量模式额外行为:
 *   - 运行跨步校验
 *   - 将结果保存到 test/fixtures/exploration-result.json
 *   - 打印校验摘要报告
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runExplorationWorkflow,
  type ExplorationStepLog,
  type ExplorationWorkflowResult,
  type ValidationResult,
} from '../src/workflows/exploration/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

// ---- Parse args ----

const args = process.argv.slice(2);
let mode: 'step' | 'full' = 'full';
let targetStep: number | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--step' && args[i + 1]) {
    mode = 'step';
    targetStep = parseInt(args[i + 1]!, 10);
    if (isNaN(targetStep) || targetStep < 1 || targetStep > 4) {
      console.error('--step must be 1, 2, 3, or 4');
      process.exit(1);
    }
  }
  if (args[i] === '--full') {
    mode = 'full';
  }
}

// ---- Helpers ----

function printValidation(v: ValidationResult): void {
  if (v.valid) {
    console.log('  ✅ 校验通过');
  } else {
    console.log(`  ⚠️  校验发现 ${v.errors.length} 个问题:`);
    for (const err of v.errors) {
      console.log(`    - [${err.rule}] ${err.message}`);
    }
  }
}

function printStepLog(log: ExplorationStepLog): void {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📋 ${log.step}`);
  console.log(`   耗时: ${log.durationMs}ms`);
  console.log(
    `   Tokens: ${log.usage.promptTokens}+${log.usage.completionTokens}=${log.usage.totalTokens}`,
  );
  printValidation(log.validation);
}

function printSummary(result: ExplorationWorkflowResult): void {
  console.log(`\n${'═'.repeat(50)}`);
  console.log('探索工作流执行摘要');
  console.log('═'.repeat(50));
  console.log(`总耗时: ${result.totalDurationMs}ms`);
  console.log(
    `总Tokens: ${result.totalUsage.promptTokens}+${result.totalUsage.completionTokens}=${result.totalUsage.totalTokens}`,
  );

  let allValid = true;
  let totalErrors = 0;
  for (const step of result.steps) {
    const icon = step.validation.valid ? '✅' : '⚠️';
    const errCount = step.validation.errors.length;
    totalErrors += errCount;
    if (!step.validation.valid) allValid = false;
    console.log(`  ${icon} ${step.step} (${step.durationMs}ms, ${errCount} errors)`);
  }

  console.log();
  if (allValid) {
    console.log('🎉 全部校验通过！');
  } else {
    console.log(`⚠️  共 ${totalErrors} 个校验问题，请检查日志。`);
  }
}

function printResultOverview(result: ExplorationWorkflowResult): void {
  const r = result.result;
  console.log(`\n${'─'.repeat(50)}`);
  console.log('生成内容概览');
  console.log('─'.repeat(50));
  console.log(`场景: ${r.scene.title} (${r.scene.sceneId})`);
  console.log(`场景描述: ${r.scene.description.slice(0, 80)}...`);
  console.log(`区域 (${r.zones.length}):`);
  for (const z of r.zones) {
    console.log(`  - ${z.name} (${z.zoneId}): ${z.itemIds.length} items`);
  }
  console.log(`物品 (${r.items.length}):`);
  const skeletonItems = result.intermediates.skeleton?.items ?? [];
  for (const item of r.items) {
    const flags = [
      item.hasClue && 'clue',
      item.beadReactive && 'bead',
      item.isEvidence && 'evidence',
    ]
      .filter(Boolean)
      .join(',');
    const skelItem = skeletonItems.find((s: { itemId: string }) => s.itemId === item.itemId);
    const el = (skelItem as { evidenceLines?: string[] })?.evidenceLines;
    const elStr = el?.length ? ` lines=[${el.join(',')}]` : '';
    console.log(
      `  - ${item.name} [${item.category}] icon=${item.iconTag}${elStr} ${flags ? `(${flags})` : ''}`,
    );
  }
  console.log(`线索 (${r.clueDefinitions.length}):`);
  for (const clue of r.clueDefinitions) {
    console.log(
      `  - ${clue.title} [${clue.type}] from=${clue.sourceItemId} evidence=${clue.usableAsEvidence}`,
    );
  }
  console.log(`念珠: ${r.beadData.name} (${r.beadData.itemId})`);
  console.log(`残念文本: ${Object.keys(r.beadRemnants).length} 条`);
}

// ---- Main ----

async function main(): Promise<void> {
  console.log('═'.repeat(50));
  console.log(`探索工作流测试 (${mode === 'full' ? '全量模式' : `逐步模式 → Step ${targetStep}`})`);
  console.log('═'.repeat(50));

  const stopAfterStep = mode === 'step' ? targetStep : undefined;

  const workflowResult = await runExplorationWorkflow({
    stopAfterStep,
    onStepComplete: printStepLog,
  });

  printResultOverview(workflowResult);
  printSummary(workflowResult);

  // Print intermediates for debugging
  if (mode === 'step') {
    console.log(`\n${'─'.repeat(50)}`);
    console.log('中间数据 (JSON)');
    console.log('─'.repeat(50));
    console.log(JSON.stringify(workflowResult.intermediates, null, 2));
  }

  // Save fixtures
  {
    await mkdir(FIXTURES_DIR, { recursive: true });
    const fixturePath = join(FIXTURES_DIR, 'exploration-result.json');
    const fixtureData = {
      timestamp: new Date().toISOString(),
      mode,
      ...(mode === 'step' ? { step: targetStep } : {}),
      result: workflowResult.result,
      intermediates: workflowResult.intermediates,
      steps: workflowResult.steps.map((s) => ({
        step: s.step,
        durationMs: s.durationMs,
        usage: s.usage,
        validationPassed: s.validation.valid,
        validationErrors: s.validation.errors,
      })),
      totalDurationMs: workflowResult.totalDurationMs,
      totalUsage: workflowResult.totalUsage,
    };

    await writeFile(fixturePath, JSON.stringify(fixtureData, null, 2), 'utf-8');
    console.log(`\n💾 Fixtures saved to: ${fixturePath}`);
  }

  const hasErrors = workflowResult.steps.some((s) => !s.validation.valid);
  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error('\n❌ 工作流执行失败:', err);
  process.exit(1);
});
