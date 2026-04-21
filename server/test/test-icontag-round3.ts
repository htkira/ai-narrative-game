/**
 * iconTag 复用收益对比 — 第三轮追加测试
 *
 * 不清缓存，在第一轮（9 tag）+ 第二轮（+3 tag）= 12 个已缓存 iconTag 的基础上，
 * 再跑一遍文本工作流生成全新物品，看命中率。
 *
 * 运行: cd server && npx tsx test/test-icontag-round3.ts
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

console.log('='.repeat(60));
console.log('iconTag 复用收益 — 第三轮追加测试');
console.log('='.repeat(60));

const cacheDir = getIconCacheDir();
const cachedFiles = readdirSync(cacheDir).filter((f) => f.endsWith('.png'));
const cachedTags = cachedFiles.map((f) => f.replace('.png', ''));
console.log(`\n当前缓存中已有 ${cachedTags.length} 个 iconTag:`);
console.log(`  ${cachedTags.join(', ')}`);

// ---- Run exploration workflow ----

console.log('\n' + '-'.repeat(60));
console.log('运行探索文本工作流，生成第三轮物品数据...');
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

const round3Items = newItems.filter((i) => i.category !== 'special');
const round3Tags = [...new Set(round3Items.map((i) => i.iconTag))];
const overlappingTags = round3Tags.filter((t) => cachedTags.includes(t));
const brandNewTags = round3Tags.filter((t) => !cachedTags.includes(t));

console.log(`\n第三轮物品总数: ${newItems.length} (其中 special 跳过: ${newItems.length - round3Items.length})`);
console.log(`不同 iconTag 数: ${round3Tags.length}`);
console.log(`iconTag 列表: ${round3Tags.join(', ')}`);
console.log(`命中已有缓存的 iconTag: ${overlappingTags.length > 0 ? overlappingTags.join(', ') : '(无)'}`);
console.log(`全新的 iconTag: ${brandNewTags.length > 0 ? brandNewTags.join(', ') : '(无)'}`);

// ---- Generate icons ----

console.log('\n' + '-'.repeat(60));
console.log('第三轮：使用第三轮物品数据生成图标');
console.log('-'.repeat(60));
console.log('正在生成...');

const round3Result: ItemIconBatchResult = await generateItemIcons(newItems, { maxRetries: 2 });

console.log(`\n第三轮结果:`);
console.log(`  缓存命中: ${round3Result.cacheHits}`);
console.log(`  新生成:   ${round3Result.cacheMisses}`);
console.log(`  跳过:     ${round3Result.skipped}`);
console.log(`  总耗时:   ${formatMs(round3Result.totalDurationMs)}`);

const round3GenResults = round3Result.results.filter((r) => !r.cached);
if (round3GenResults.length > 0) {
  const perIconMs = round3GenResults.map((r) => r.durationMs);
  const avgMs = perIconMs.reduce((a, b) => a + b, 0) / perIconMs.length;
  console.log(`  单张生成耗时: ${perIconMs.map(formatMs).join(', ')}`);
  console.log(`  单张平均耗时: ${formatMs(Math.round(avgMs))}`);
}

// ---- Summary with all 3 rounds ----

console.log('\n' + '='.repeat(60));
console.log('三轮对比报告（含历史数据）');
console.log('='.repeat(60));

console.log(`\n                    第一轮          第二轮          第三轮`);
console.log(`  物品数(非special)      9               8           ${String(round3Items.length).padStart(5)}`);
console.log(`  不同 iconTag 数        9               7           ${String(round3Tags.length).padStart(5)}`);
console.log(`  缓存命中               0               5           ${String(round3Result.cacheHits).padStart(5)}`);
console.log(`  新生成                 9               3           ${String(round3Result.cacheMisses).padStart(5)}`);
console.log(`  图标生成总耗时       191.5s           62.5s        ${formatMs(round3Result.totalDurationMs).padStart(8)}`);

console.log(`\n  第三轮详情:`);
console.log(`    已缓存 iconTag 总数: ${cachedTags.length} (第一轮 9 + 第二轮 3)`);
console.log(`    第三轮命中缓存: ${overlappingTags.length} / ${round3Tags.length} 个不同 iconTag`);
console.log(`    实际缓存命中次数: ${round3Result.cacheHits} 次（含批内复用）`);
console.log(`    需要新生成: ${round3Result.cacheMisses} 张`);

const avgGenMs = 20800;
if (round3Result.cacheHits > 0) {
  console.log(`    按单张平均 20.8s 估算，${round3Result.cacheHits} 次命中约省 ${formatMs(Math.round(avgGenMs * round3Result.cacheHits))}`);
}

const noCache9 = 9 * avgGenMs;
const pctSaved = ((1 - round3Result.totalDurationMs / noCache9) * 100).toFixed(1);
console.log(`    若无缓存（按 ${round3Items.length} 个非 special 物品全部生成）约需 ${formatMs(round3Items.length * avgGenMs)}`);
console.log(`    实际耗时 ${formatMs(round3Result.totalDurationMs)}，节省约 ${pctSaved}%`);

// Updated cache
const updatedFiles = readdirSync(cacheDir).filter((f) => f.endsWith('.png'));
console.log(`\n  三轮累计缓存 iconTag 数: ${updatedFiles.length}`);
console.log(`  标签列表: ${updatedFiles.map((f) => f.replace('.png', '')).join(', ')}`);

console.log('\n测试完成。');
process.exit(0);
