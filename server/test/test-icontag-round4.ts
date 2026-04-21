/**
 * iconTag 复用收益对比 — 第四轮追加测试
 *
 * 不清缓存，在前三轮累计 15 个已缓存 iconTag 的基础上，
 * 再跑一遍文本工作流生成全新物品，看命中率。
 * 最终输出四轮完整对比报告。
 *
 * 运行: cd server && npx tsx test/test-icontag-round4.ts
 */

import { readdirSync } from 'node:fs';
import {
  generateItemIcons,
  getIconCacheDir,
  type ItemIconInput,
  type ItemIconBatchResult,
} from '../src/workflows/itemIconGen.js';
import {
  runExplorationWorkflow,
} from '../src/workflows/exploration/index.js';

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function pad(s: string, w: number): string {
  return s.padStart(w);
}

// ---- Historical data from rounds 1-3 ----

const history = [
  { round: '第一轮', items: 9, tags: 9, hits: 0, misses: 9, timeMs: 191500, cachedBefore: 0 },
  { round: '第二轮', items: 8, tags: 7, hits: 5, misses: 3, timeMs: 62500, cachedBefore: 9 },
  { round: '第三轮', items: 8, tags: 7, hits: 5, misses: 3, timeMs: 71600, cachedBefore: 12 },
];

console.log('='.repeat(60));
console.log('iconTag 复用收益 — 第四轮追加测试');
console.log('='.repeat(60));

const cacheDir = getIconCacheDir();
const cachedFiles = readdirSync(cacheDir).filter((f) => f.endsWith('.png'));
const cachedTags = cachedFiles.map((f) => f.replace('.png', ''));
console.log(`\n当前缓存中已有 ${cachedTags.length} 个 iconTag:`);
console.log(`  ${cachedTags.join(', ')}`);

// ---- Run exploration workflow ----

console.log('\n' + '-'.repeat(60));
console.log('运行探索文本工作流，生成第四轮物品数据...');
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

const round4Items = newItems.filter((i) => i.category !== 'special');
const round4Tags = [...new Set(round4Items.map((i) => i.iconTag))];
const overlappingTags = round4Tags.filter((t) => cachedTags.includes(t));
const brandNewTags = round4Tags.filter((t) => !cachedTags.includes(t));

console.log(`\n第四轮物品总数: ${newItems.length} (其中 special 跳过: ${newItems.length - round4Items.length})`);
console.log(`不同 iconTag 数: ${round4Tags.length}`);
console.log(`iconTag 列表: ${round4Tags.join(', ')}`);
console.log(`命中已有缓存的 iconTag: ${overlappingTags.length > 0 ? overlappingTags.join(', ') : '(无)'}`);
console.log(`全新的 iconTag: ${brandNewTags.length > 0 ? brandNewTags.join(', ') : '(无)'}`);

// ---- Generate icons ----

console.log('\n' + '-'.repeat(60));
console.log('第四轮：使用第四轮物品数据生成图标');
console.log('-'.repeat(60));
console.log('正在生成...');

const round4Result: ItemIconBatchResult = await generateItemIcons(newItems, { maxRetries: 2 });

console.log(`\n第四轮结果:`);
console.log(`  缓存命中: ${round4Result.cacheHits}`);
console.log(`  新生成:   ${round4Result.cacheMisses}`);
console.log(`  跳过:     ${round4Result.skipped}`);
console.log(`  总耗时:   ${formatMs(round4Result.totalDurationMs)}`);

const round4GenResults = round4Result.results.filter((r) => !r.cached);
if (round4GenResults.length > 0) {
  const perIconMs = round4GenResults.map((r) => r.durationMs);
  const avgMs = perIconMs.reduce((a, b) => a + b, 0) / perIconMs.length;
  console.log(`  单张生成耗时: ${perIconMs.map(formatMs).join(', ')}`);
  console.log(`  单张平均耗时: ${formatMs(Math.round(avgMs))}`);
}

// ---- 4-round comparison ----

const round4Data = {
  round: '第四轮',
  items: round4Items.length,
  tags: round4Tags.length,
  hits: round4Result.cacheHits,
  misses: round4Result.cacheMisses,
  timeMs: round4Result.totalDurationMs,
  cachedBefore: cachedTags.length,
};

const allRounds = [...history, round4Data];

console.log('\n' + '='.repeat(70));
console.log('四轮完整对比报告');
console.log('='.repeat(70));

const W = 12;
const header = '                    ' + allRounds.map((r) => pad(r.round, W)).join('');
console.log(`\n${header}`);
console.log('  已缓存 iconTag 数' + allRounds.map((r) => pad(String(r.cachedBefore), W)).join(''));
console.log('  物品数(非special) ' + allRounds.map((r) => pad(String(r.items), W)).join(''));
console.log('  不同 iconTag 数   ' + allRounds.map((r) => pad(String(r.tags), W)).join(''));
console.log('  缓存命中          ' + allRounds.map((r) => pad(String(r.hits), W)).join(''));
console.log('  新生成            ' + allRounds.map((r) => pad(String(r.misses), W)).join(''));
console.log('  图标生成总耗时    ' + allRounds.map((r) => pad(formatMs(r.timeMs), W)).join(''));

const avgGenMs = 20800;
console.log('\n  各轮节省情况（按单张平均 20.8s 估算）:');
for (const r of allRounds) {
  const noCache = r.items * avgGenMs;
  const savedPct = ((1 - r.timeMs / noCache) * 100).toFixed(1);
  console.log(`    ${r.round}: 若无缓存需 ${formatMs(noCache)}，实际 ${formatMs(r.timeMs)}，节省 ${savedPct}%`);
}

const updatedFiles = readdirSync(cacheDir).filter((f) => f.endsWith('.png'));
console.log(`\n  四轮累计缓存 iconTag 数: ${updatedFiles.length}`);
console.log(`  标签列表: ${updatedFiles.map((f) => f.replace('.png', '')).join(', ')}`);

console.log('\n测试完成。');
process.exit(0);
