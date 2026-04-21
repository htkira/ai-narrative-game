/**
 * iconTag 复用收益对比 — 第五轮追加测试
 *
 * 不清缓存，在前四轮累计的缓存基础上再跑一遍文本工作流。
 * 最终输出五轮完整对比报告。
 *
 * 运行: cd server && npx tsx test/test-icontag-round5.ts
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

const COL = 10;

// ---- Historical data from rounds 1–4 ----

const history = [
  { round: '第一轮', items: 9, tags: 9, hits: 0, misses: 9, timeMs: 191500, cachedBefore: 0 },
  { round: '第二轮', items: 8, tags: 7, hits: 5, misses: 3, timeMs: 62500,  cachedBefore: 9 },
  { round: '第三轮', items: 8, tags: 7, hits: 5, misses: 3, timeMs: 71600,  cachedBefore: 12 },
  { round: '第四轮', items: 8, tags: 7, hits: 5, misses: 3, timeMs: 62100,  cachedBefore: 15 },
];

console.log('='.repeat(60));
console.log('iconTag 复用收益 — 第五轮追加测试');
console.log('='.repeat(60));

const cacheDir = getIconCacheDir();
const cachedFiles = readdirSync(cacheDir).filter((f) => f.endsWith('.png'));
const cachedTags = cachedFiles.map((f) => f.replace('.png', ''));
console.log(`\n当前缓存中已有 ${cachedTags.length} 个 iconTag:`);
console.log(`  ${cachedTags.join(', ')}`);

// ---- Run exploration workflow ----

console.log('\n' + '-'.repeat(60));
console.log('运行探索文本工作流，生成第五轮物品数据...');
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

const round5Items = newItems.filter((i) => i.category !== 'special');
const round5Tags = [...new Set(round5Items.map((i) => i.iconTag))];
const overlappingTags = round5Tags.filter((t) => cachedTags.includes(t));
const brandNewTags = round5Tags.filter((t) => !cachedTags.includes(t));

console.log(`\n第五轮物品总数: ${newItems.length} (其中 special 跳过: ${newItems.length - round5Items.length})`);
console.log(`不同 iconTag 数: ${round5Tags.length}`);
console.log(`iconTag 列表: ${round5Tags.join(', ')}`);
console.log(`命中已有缓存的 iconTag: ${overlappingTags.length > 0 ? overlappingTags.join(', ') : '(无)'}`);
console.log(`全新的 iconTag: ${brandNewTags.length > 0 ? brandNewTags.join(', ') : '(无)'}`);

// ---- Generate icons ----

console.log('\n' + '-'.repeat(60));
console.log('第五轮：使用第五轮物品数据生成图标');
console.log('-'.repeat(60));
console.log('正在生成...');

const round5Result: ItemIconBatchResult = await generateItemIcons(newItems, { maxRetries: 2 });

console.log(`\n第五轮结果:`);
console.log(`  命中数:   ${round5Result.cacheHits}`);
console.log(`  新生成:   ${round5Result.cacheMisses}`);
console.log(`  跳过:     ${round5Result.skipped}`);
console.log(`  总耗时:   ${formatMs(round5Result.totalDurationMs)}`);

const round5GenResults = round5Result.results.filter((r) => !r.cached);
if (round5GenResults.length > 0) {
  const perIconMs = round5GenResults.map((r) => r.durationMs);
  const avgMs = perIconMs.reduce((a, b) => a + b, 0) / perIconMs.length;
  console.log(`  单张生成耗时: ${perIconMs.map(formatMs).join(', ')}`);
  console.log(`  单张平均耗时: ${formatMs(Math.round(avgMs))}`);
}

// ---- Build round 5 data ----

const round5Data = {
  round: '第五轮',
  items: round5Items.length,
  tags: round5Tags.length,
  hits: round5Result.cacheHits,
  misses: round5Result.cacheMisses,
  timeMs: round5Result.totalDurationMs,
  cachedBefore: cachedTags.length,
};

const allRounds = [...history, round5Data];

// ---- Print comparison ----

console.log('\n' + '='.repeat(70));
console.log('对比报告');
console.log('='.repeat(70));

const row = (label: string, getter: (r: typeof allRounds[0]) => string) => {
  const cells = allRounds.map((r) => pad(getter(r), COL));
  console.log(`  ${label}${cells.join('')}`);
};

console.log('');
row('                ', (r) => r.round);
row('已缓存 iconTag  ', (r) => String(r.cachedBefore));
row('物品数(非special)', (r) => String(r.items));
row('不同 iconTag 数  ', (r) => String(r.tags));
row('命中数           ', (r) => String(r.hits));
row('新生成           ', (r) => String(r.misses));
row('图标生成总耗时   ', (r) => formatMs(r.timeMs));

// ---- Round 5 details ----

console.log(`\n  第五轮详情:`);
console.log(`    进入第五轮时已缓存: ${cachedTags.length} 个 iconTag`);
console.log(`    第五轮不同 iconTag: ${round5Tags.length} 个`);
console.log(`    命中已有缓存: ${overlappingTags.length} 个 (${overlappingTags.length > 0 ? overlappingTags.join(', ') : '无'})`);
console.log(`    全新 iconTag: ${brandNewTags.length} 个 (${brandNewTags.length > 0 ? brandNewTags.join(', ') : '无'})`);
console.log(`    实际命中次数: ${round5Result.cacheHits} 次（含批内复用）`);
console.log(`    需要新生成: ${round5Result.cacheMisses} 张`);
console.log(`    图标生成总耗时: ${formatMs(round5Result.totalDurationMs)}`);

const updatedFiles = readdirSync(cacheDir).filter((f) => f.endsWith('.png'));
console.log(`\n  五轮累计缓存 iconTag 数: ${updatedFiles.length}`);
console.log(`  标签列表: ${updatedFiles.map((f) => f.replace('.png', '')).join(', ')}`);

console.log('\n测试完成。');
process.exit(0);
