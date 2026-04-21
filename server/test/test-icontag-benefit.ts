/**
 * iconTag 复用收益对比测试
 *
 * 流程:
 *   1. 清空图标缓存
 *   2. 用现有 fixture 物品数据生成图标（第一轮，全部 miss）
 *   3. 运行探索文本工作流生成全新物品数据
 *   4. 用新物品数据生成图标（第二轮，部分可能命中第一轮缓存）
 *   5. 打印对比报告
 *
 * 运行: cd server && npx tsx test/test-icontag-benefit.ts
 */

import { readFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateItemIcons,
  getIconCacheDir,
  type ItemIconInput,
  type ItemIconBatchResult,
} from '../src/workflows/itemIconGen.js';
import {
  runExplorationWorkflow,
} from '../src/workflows/exploration/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

// ---- Load existing fixture items ----

const fixturesPath = join(FIXTURES_DIR, 'exploration-result.json');
const raw = await readFile(fixturesPath, 'utf-8');
const fixtureData = JSON.parse(raw) as Record<string, unknown>;
const result = fixtureData.result as Record<string, unknown>;
const fixtureItems = (result.items as Array<Record<string, unknown>>).map((item) => ({
  itemId: item.itemId as string,
  name: item.name as string,
  description: (item.description as string) ?? '',
  iconTag: item.iconTag as string,
  category: item.category as string,
}));

console.log('='.repeat(60));
console.log('iconTag 复用收益对比测试');
console.log('='.repeat(60));

// ---- Step 1: Clear icon cache ----

const cacheDir = getIconCacheDir();
if (existsSync(cacheDir)) {
  await rm(cacheDir, { recursive: true });
  console.log('\n[准备] 已清空图标缓存目录');
}
await mkdir(cacheDir, { recursive: true });

// ---- Step 2: Round 1 — generate icons from fixture data ----

const round1Items = fixtureItems.filter((i) => i.category !== 'special');
const round1Tags = [...new Set(round1Items.map((i) => i.iconTag))];

console.log('\n' + '-'.repeat(60));
console.log('第一轮：使用现有 fixture 物品数据生成图标');
console.log('-'.repeat(60));
console.log(`物品总数: ${fixtureItems.length} (其中 special 跳过: ${fixtureItems.length - round1Items.length})`);
console.log(`不同 iconTag 数: ${round1Tags.length}`);
console.log(`iconTag 列表: ${round1Tags.join(', ')}`);
console.log('\n正在生成...');

const round1Result: ItemIconBatchResult = await generateItemIcons(fixtureItems, { maxRetries: 2 });

console.log(`\n第一轮结果:`);
console.log(`  缓存命中: ${round1Result.cacheHits}`);
console.log(`  新生成:   ${round1Result.cacheMisses}`);
console.log(`  跳过:     ${round1Result.skipped}`);
console.log(`  总耗时:   ${formatMs(round1Result.totalDurationMs)}`);

const round1GenResults = round1Result.results.filter((r) => !r.cached);
if (round1GenResults.length > 0) {
  const perIconMs = round1GenResults.map((r) => r.durationMs);
  const avgMs = perIconMs.reduce((a, b) => a + b, 0) / perIconMs.length;
  console.log(`  单张生成耗时: ${perIconMs.map(formatMs).join(', ')}`);
  console.log(`  单张平均耗时: ${formatMs(Math.round(avgMs))}`);
}

// ---- Step 3: Run exploration workflow for new items ----

console.log('\n' + '-'.repeat(60));
console.log('运行探索文本工作流，生成全新物品数据...');
console.log('-'.repeat(60));

const workflowStart = Date.now();
const workflowResult = await runExplorationWorkflow({
  onStepComplete: (log) => {
    const icon = log.validation.valid ? '✅' : '⚠️';
    console.log(`  ${icon} ${log.step} (${formatMs(log.durationMs)})`);
  },
});
const workflowDuration = Date.now() - workflowStart;
console.log(`文本工作流总耗时: ${formatMs(workflowDuration)}`);

const newItems: ItemIconInput[] = workflowResult.result.items.map((item: Record<string, unknown>) => ({
  itemId: item.itemId as string,
  name: item.name as string,
  description: (item.description as string) ?? '',
  iconTag: item.iconTag as string,
  category: item.category as string,
}));

const round2Items = newItems.filter((i) => i.category !== 'special');
const round2Tags = [...new Set(round2Items.map((i) => i.iconTag))];
const overlappingTags = round2Tags.filter((t) => round1Tags.includes(t));
const newTags = round2Tags.filter((t) => !round1Tags.includes(t));

console.log(`\n新物品总数: ${newItems.length} (其中 special 跳过: ${newItems.length - round2Items.length})`);
console.log(`不同 iconTag 数: ${round2Tags.length}`);
console.log(`iconTag 列表: ${round2Tags.join(', ')}`);
console.log(`与第一轮重叠的 iconTag: ${overlappingTags.length > 0 ? overlappingTags.join(', ') : '(无)'}`);
console.log(`全新的 iconTag: ${newTags.length > 0 ? newTags.join(', ') : '(无)'}`);

// ---- Step 4: Round 2 — generate icons from new items ----

console.log('\n' + '-'.repeat(60));
console.log('第二轮：使用全新物品数据生成图标');
console.log('-'.repeat(60));
console.log('正在生成...');

const round2Result: ItemIconBatchResult = await generateItemIcons(newItems, { maxRetries: 2 });

console.log(`\n第二轮结果:`);
console.log(`  缓存命中: ${round2Result.cacheHits}`);
console.log(`  新生成:   ${round2Result.cacheMisses}`);
console.log(`  跳过:     ${round2Result.skipped}`);
console.log(`  总耗时:   ${formatMs(round2Result.totalDurationMs)}`);

const round2GenResults = round2Result.results.filter((r) => !r.cached);
if (round2GenResults.length > 0) {
  const perIconMs = round2GenResults.map((r) => r.durationMs);
  const avgMs = perIconMs.reduce((a, b) => a + b, 0) / perIconMs.length;
  console.log(`  单张生成耗时: ${perIconMs.map(formatMs).join(', ')}`);
  console.log(`  单张平均耗时: ${formatMs(Math.round(avgMs))}`);
}

// ---- Step 5: Summary ----

console.log('\n' + '='.repeat(60));
console.log('对比报告');
console.log('='.repeat(60));

console.log(`\n                    第一轮          第二轮`);
console.log(`  物品数(非special)  ${String(round1Items.length).padStart(5)}           ${String(round2Items.length).padStart(5)}`);
console.log(`  不同 iconTag 数    ${String(round1Tags.length).padStart(5)}           ${String(round2Tags.length).padStart(5)}`);
console.log(`  缓存命中           ${String(round1Result.cacheHits).padStart(5)}           ${String(round2Result.cacheHits).padStart(5)}`);
console.log(`  新生成             ${String(round1Result.cacheMisses).padStart(5)}           ${String(round2Result.cacheMisses).padStart(5)}`);
console.log(`  图标生成总耗时     ${formatMs(round1Result.totalDurationMs).padStart(8)}        ${formatMs(round2Result.totalDurationMs).padStart(8)}`);

const savedMs = round1Result.totalDurationMs - round2Result.totalDurationMs;
const savedPct = round1Result.totalDurationMs > 0
  ? ((savedMs / round1Result.totalDurationMs) * 100).toFixed(1)
  : '0';

console.log(`\n  第二轮相比第一轮:`);
console.log(`    重叠 iconTag 数: ${overlappingTags.length} / ${round2Tags.length}`);
console.log(`    省去的生成次数:  ${round2Result.cacheHits} 次`);
console.log(`    耗时节省:        ${formatMs(Math.abs(savedMs))} (${savedPct}%)`);

if (round2Result.cacheHits > 0) {
  const avgGenMs = round1GenResults.length > 0
    ? round1GenResults.reduce((a, b) => a + b.durationMs, 0) / round1GenResults.length
    : 0;
  console.log(`    按单张平均 ${formatMs(Math.round(avgGenMs))} 估算，${round2Result.cacheHits} 次命中约省 ${formatMs(Math.round(avgGenMs * round2Result.cacheHits))}`);
}

console.log('\n测试完成。');
process.exit(0);
