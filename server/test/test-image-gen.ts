/**
 * B5 + B5.5 图片生成验证测试
 *
 * 运行方式:
 *   cd server && npx tsx test/test-image-gen.ts --scene      # 场景图
 *   cd server && npx tsx test/test-image-gen.ts --icons      # 物品图标 + 缓存
 *   cd server && npx tsx test/test-image-gen.ts --portrait   # NPC 立绘
 *   cd server && npx tsx test/test-image-gen.ts --all        # 全部
 *   cd server && npx tsx test/test-image-gen.ts              # 默认 = --all
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSceneImage, type ImageGenResult } from '../src/workflows/imageGen.js';
import {
  generateItemIcons,
  getIconCacheDir,
  type ItemIconInput,
  type ItemIconBatchResult,
} from '../src/workflows/itemIconGen.js';
import {
  generateNpcPortrait,
  type NpcPortraitResult,
} from '../src/workflows/npcPortraitGen.js';
import { removeBackground } from '../src/workflows/removeBackground.js';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

// ---- Arg parsing ----

const args = process.argv.slice(2);
const runScene = args.includes('--scene') || args.includes('--all') || args.length === 0;
const runIcons = args.includes('--icons') || args.includes('--all') || args.length === 0;
const runPortrait = args.includes('--portrait') || args.includes('--all') || args.length === 0;

// ---- Test runner ----

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`\n▶ ${name}...\n`);
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.push({ name, passed: true, durationMs: ms });
    console.log(`  ✅ PASS (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: msg, durationMs: ms });
    console.log(`  ❌ FAIL (${ms}ms)`);
    console.log(`  Error: ${msg}`);
  }
}

function assert(condition: boolean, message?: string): void {
  if (!condition) throw new Error(message ?? 'Assertion failed');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ---- Load fixtures ----

console.log('='.repeat(60));
console.log('B5 + B5.5 图片生成验证');
console.log(`  场景图: ${runScene ? 'YES' : 'skip'}`);
console.log(`  物品图标: ${runIcons ? 'YES' : 'skip'}`);
console.log(`  NPC立绘: ${runPortrait ? 'YES' : 'skip'}`);
console.log('='.repeat(60));

const fixturesPath = join(FIXTURES_DIR, 'exploration-result.json');
let fixtureData: Record<string, unknown> | null = null;

try {
  const raw = await readFile(fixturesPath, 'utf-8');
  fixtureData = JSON.parse(raw) as Record<string, unknown>;
  console.log('\n已加载 exploration-result.json');
} catch (err) {
  console.warn(`\n⚠️ 无法读取 fixtures: ${fixturesPath}`);
  console.warn('   部分测试可能使用 mock 数据');
}

// ---- Helper: extract scene from fixtures ----

function getScene(): { title: string; description: string; imageAlt: string } | null {
  if (!fixtureData) return null;
  const result = fixtureData.result as Record<string, unknown> | undefined;
  const scene = (result?.scene ?? fixtureData.scene) as Record<string, string> | undefined;
  if (!scene) return null;
  return {
    title: scene.title,
    description: scene.description,
    imageAlt: scene.imageAlt,
  };
}

function getItems(): ItemIconInput[] {
  if (!fixtureData) return [];
  const result = fixtureData.result as Record<string, unknown> | undefined;
  const items = (result?.items ?? fixtureData.items) as Array<Record<string, unknown>> | undefined;
  if (!items) return [];
  return items.map((item) => ({
    itemId: item.itemId as string,
    name: item.name as string,
    description: (item.description as string) ?? '',
    iconTag: item.iconTag as string,
    category: item.category as string,
  }));
}

// ============================================================
// SCENE IMAGE TESTS (B5)
// ============================================================

if (runScene) {
  console.log('\n' + '-'.repeat(60));
  console.log('🖼️  场景图片生成 (B5)');
  console.log('-'.repeat(60));

  const scene = getScene();
  if (!scene) {
    console.error('❌ 无法从 fixtures 读取场景数据，跳过场景图测试');
    console.error('   请先运行 test-exploration.ts --full 生成 fixtures');
  } else {
    console.log(`场景标题: ${scene.title}`);
    console.log(`场景描述: ${scene.description.slice(0, 80)}...`);

    let imageResult: ImageGenResult | null = null;

    await runTest('[场景] 图片生成', async () => {
      imageResult = await generateSceneImage(
        { sceneTitle: scene.title, sceneDescription: scene.description, imageAlt: scene.imageAlt },
        { aspectRatio: '1:1', imageSize: '1K', maxRetries: 2 },
      );
      assert(imageResult.imageDataUrl.length > 0, 'Image data URL should not be empty');
      assert(imageResult.imageDataUrl.startsWith('data:image/'), 'Should be a valid data URL');
      assert(imageResult.sizeBytes > 1000, `Image too small: ${imageResult.sizeBytes} bytes`);

      console.log(`  模型: ${imageResult.model}`);
      console.log(`  MIME: ${imageResult.mimeType}`);
      console.log(`  大小: ${formatBytes(imageResult.sizeBytes)}`);
      console.log(`  背景色: ${imageResult.backgroundColor}`);
      console.log(`  耗时: ${imageResult.durationMs}ms`);
      console.log(`  Tokens: ${imageResult.usage.promptTokens}+${imageResult.usage.completionTokens}=${imageResult.usage.totalTokens}`);
    });

    await runTest('[场景] Base64 解码验证', async () => {
      assert(imageResult != null, 'No image result from previous test');
      const base64Data = imageResult!.imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      assert(buffer.length > 1000, `Decoded image too small: ${buffer.length} bytes`);

      const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
      const WEBP_MAGIC = Buffer.from('RIFF');
      const isPng = buffer.subarray(0, 4).equals(PNG_MAGIC);
      const isJpeg = buffer.subarray(0, 3).equals(JPEG_MAGIC);
      const isWebp = buffer.subarray(0, 4).equals(WEBP_MAGIC);
      assert(isPng || isJpeg || isWebp, `Unrecognized image format (first bytes: ${buffer.subarray(0, 4).toString('hex')})`);
      console.log(`  格式: ${isPng ? 'PNG' : isJpeg ? 'JPEG' : 'WebP'}`);
      console.log(`  解码大小: ${formatBytes(buffer.length)}`);
    });

    await runTest('[场景] 背景色提取验证', async () => {
      assert(imageResult != null, 'No image result');
      const bg = imageResult!.backgroundColor;
      assert(/^#[0-9a-f]{6}$/i.test(bg), `Invalid hex format: ${bg}`);
      assert(bg !== '#000000', 'Background should not be pure black');
      assert(bg !== '#ffffff', 'Background should not be pure white');
      console.log(`  背景色: ${bg}`);
    });

    await runTest('[场景] 保存图片到文件', async () => {
      assert(imageResult != null, 'No image result');
      await mkdir(FIXTURES_DIR, { recursive: true });
      const base64Data = imageResult!.imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = imageResult!.mimeType.replace('image/', '').replace('+xml', '');
      const filename = `scene-image.${ext}`;
      await writeFile(join(FIXTURES_DIR, filename), buffer);
      console.log(`  已保存: test/fixtures/${filename} (${formatBytes(buffer.length)})`);
    });
  }
}

// ============================================================
// ITEM ICON TESTS (B5.5)
// ============================================================

if (runIcons) {
  console.log('\n' + '-'.repeat(60));
  console.log('🎨  物品图标生成 (B5.5)');
  console.log('-'.repeat(60));

  const items = getItems();
  if (items.length === 0) {
    console.error('❌ 无法从 fixtures 读取物品数据，跳过图标测试');
    console.error('   请先运行 test-exploration.ts --full 生成 fixtures');
  } else {
    const uniqueTags = new Set(items.filter((i) => i.category !== 'special').map((i) => i.iconTag));
    const specialCount = items.filter((i) => i.category === 'special').length;
    console.log(`物品数: ${items.length} (${uniqueTags.size} 个不同 iconTag, ${specialCount} 个 special 跳过)`);

    // Clean icon cache for this test so we can verify fresh generation + caching
    const cacheDir = getIconCacheDir();
    const testTags = [...uniqueTags];
    const cleanedFiles: string[] = [];
    for (const tag of testTags) {
      const cachePath = join(cacheDir, `${tag}.png`);
      if (existsSync(cachePath)) {
        await rm(cachePath);
        cleanedFiles.push(tag);
      }
    }
    if (cleanedFiles.length > 0) {
      console.log(`已清理 ${cleanedFiles.length} 个缓存文件以便测试`);
    }

    let batchResult: ItemIconBatchResult | null = null;

    await runTest('[图标] 首次批量生成（应全部 miss）', async () => {
      batchResult = await generateItemIcons(items, { maxRetries: 2 });

      assert(batchResult.skipped === specialCount, `应跳过 ${specialCount} 个 special，实际 ${batchResult.skipped}`);
      assert(batchResult.cacheMisses > 0, 'First run should have cache misses');
      // cacheHits may be > 0 if multiple items share the same iconTag
      const expectedMisses = uniqueTags.size;
      assert(
        batchResult.cacheMisses === expectedMisses,
        `Expected ${expectedMisses} cache misses (unique tags), got ${batchResult.cacheMisses}`,
      );

      console.log(`  跳过: ${batchResult.skipped}`);
      console.log(`  缓存命中: ${batchResult.cacheHits}`);
      console.log(`  缓存未命中: ${batchResult.cacheMisses}`);
      console.log(`  总耗时: ${batchResult.totalDurationMs}ms`);
      console.log(`  总Token: ${batchResult.totalUsage.totalTokens}`);
    });

    await runTest('[图标] 生成结果验证', async () => {
      assert(batchResult != null, 'No batch result');

      for (const r of batchResult!.results) {
        assert(r.imageDataUrl.length > 0, `${r.itemId} (${r.iconTag}) has empty data URL`);
        assert(
          r.imageDataUrl.startsWith('data:image/'),
          `${r.itemId} (${r.iconTag}) invalid data URL prefix`,
        );
      }

      // Verify all non-special items have icons
      for (const item of items) {
        const url = batchResult!.icons.get(item.itemId);
        if (item.category === 'special') {
          assert(url === '', `Special item ${item.itemId} should have empty URL`);
        } else {
          assert(url != null && url.length > 0, `${item.itemId} should have icon URL`);
        }
      }

      console.log(`  所有 ${batchResult!.results.length} 个图标验证通过`);
    });

    await runTest('[图标] 缓存文件写入验证', async () => {
      for (const tag of testTags) {
        const cachePath = join(cacheDir, `${tag}.png`);
        assert(existsSync(cachePath), `Cache file not found: ${tag}.png`);
      }
      console.log(`  ${testTags.length} 个缓存文件均已写入 cache/icons/`);
    });

    await runTest('[图标] 二次调用缓存命中', async () => {
      const secondResult = await generateItemIcons(items, { maxRetries: 2 });

      const expectedHits = items.filter((i) => i.category !== 'special').length;
      assert(
        secondResult.cacheHits === expectedHits,
        `Second run should have ${expectedHits} cache hits, got ${secondResult.cacheHits}`,
      );
      assert(secondResult.cacheMisses === 0, `Second run should have 0 cache misses, got ${secondResult.cacheMisses}`);
      assert(secondResult.totalDurationMs < 1000, `Cache-only run should be fast, took ${secondResult.totalDurationMs}ms`);

      console.log(`  缓存命中: ${secondResult.cacheHits}/${expectedHits}`);
      console.log(`  缓存未命中: ${secondResult.cacheMisses}`);
      console.log(`  耗时: ${secondResult.totalDurationMs}ms (无 API 调用)`);
    });

    await runTest('[图标] 保存样本图标到 fixtures', async () => {
      assert(batchResult != null, 'No batch result');
      await mkdir(FIXTURES_DIR, { recursive: true });

      const firstNonSpecial = batchResult!.results.find((r) => r.imageDataUrl.length > 0);
      assert(firstNonSpecial != null, 'No non-special icon result');

      const base64Data = firstNonSpecial!.imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `item-icon-sample-${firstNonSpecial!.iconTag}.png`;
      await writeFile(join(FIXTURES_DIR, filename), buffer);

      console.log(`  已保存样本: test/fixtures/${filename} (${formatBytes(buffer.length)})`);
    });
  }
}

// ============================================================
// NPC PORTRAIT TESTS (B5.5)
// ============================================================

if (runPortrait) {
  console.log('\n' + '-'.repeat(60));
  console.log('👤  NPC 立绘生成 (B5.5)');
  console.log('-'.repeat(60));

  const mockNpc = {
    name: '白大伯',
    role: '白家村村长，豆腐坊主人',
    appearance: '五十余岁，面色黧黑，皱纹深如刀刻，额头宽阔。穿一件打了补丁的灰布短褂，腰间系着沾满豆渣的围裙。手指粗壮有力，指节处磨出老茧。左手拄一根打结的木拐棍，腰带上挂着一串钥匙和一个干瘪的布囊。神情阴沉中带着几分焦虑，目光闪烁不定。',
    tone: '防备、强硬、偶尔露出心虚',
  };

  console.log(`NPC: ${mockNpc.name} (${mockNpc.role})`);
  console.log(`外貌: ${mockNpc.appearance.slice(0, 60)}...`);

  let portraitResult: NpcPortraitResult | null = null;

  await runTest('[立绘] NPC 全身立绘生成（含背景透明化）', async () => {
    portraitResult = await generateNpcPortrait(mockNpc, {
      aspectRatio: '3:4',
      imageSize: '1K',
      maxRetries: 2,
      transparentBg: true,
      bgTolerance: 30,
    });

    assert(portraitResult.imageDataUrl.length > 0, 'Portrait data URL should not be empty');
    assert(portraitResult.imageDataUrl.startsWith('data:image/'), 'Should be a valid data URL');
    assert(portraitResult.sizeBytes > 1000, `Portrait too small: ${portraitResult.sizeBytes} bytes`);

    console.log(`  模型: ${portraitResult.model}`);
    console.log(`  MIME: ${portraitResult.mimeType}`);
    console.log(`  大小: ${formatBytes(portraitResult.sizeBytes)}`);
    console.log(`  耗时: ${portraitResult.durationMs}ms`);
    console.log(`  Tokens: ${portraitResult.usage.promptTokens}+${portraitResult.usage.completionTokens}=${portraitResult.usage.totalTokens}`);
  });

  await runTest('[立绘] 输出为 PNG 格式', async () => {
    assert(portraitResult != null, 'No portrait result');

    const base64Data = portraitResult!.imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    assert(buffer.length > 1000, `Portrait decoded too small: ${buffer.length} bytes`);

    const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    assert(buffer.subarray(0, 4).equals(PNG_MAGIC), 'Output should be PNG (for transparency support)');
    assert(portraitResult!.mimeType === 'image/png', `MIME should be image/png, got ${portraitResult!.mimeType}`);

    console.log(`  格式: PNG`);
    console.log(`  解码大小: ${formatBytes(buffer.length)}`);
  });

  await runTest('[立绘] 透明背景验证', async () => {
    assert(portraitResult != null, 'No portrait result');

    const base64Data = portraitResult!.imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const png = PNG.sync.read(buffer);

    let transparentCount = 0;
    let opaqueCount = 0;
    for (let i = 0; i < png.width * png.height; i++) {
      if (png.data[i * 4 + 3]! === 0) {
        transparentCount++;
      } else {
        opaqueCount++;
      }
    }

    const totalPixels = png.width * png.height;
    const transparentPct = ((transparentCount / totalPixels) * 100).toFixed(1);
    const opaquePct = ((opaqueCount / totalPixels) * 100).toFixed(1);

    assert(transparentCount > 0, 'Image should have transparent pixels after background removal');
    assert(opaqueCount > 0, 'Image should have opaque pixels (the character)');
    // Background should be at least 10% of the image (character doesn't fill entire frame)
    assert(
      transparentCount > totalPixels * 0.1,
      `Too few transparent pixels (${transparentPct}%) — background removal may have failed`,
    );

    // Check specific corner — should be transparent
    const topLeftAlpha = png.data[3]!;
    assert(topLeftAlpha === 0, `Top-left pixel should be transparent (alpha=${topLeftAlpha})`);

    console.log(`  图片尺寸: ${png.width}×${png.height}`);
    console.log(`  透明像素: ${transparentCount} (${transparentPct}%)`);
    console.log(`  不透明像素: ${opaqueCount} (${opaquePct}%)`);
  });

  await runTest('[立绘] 保存到文件', async () => {
    assert(portraitResult != null, 'No portrait result');
    await mkdir(FIXTURES_DIR, { recursive: true });

    const base64Data = portraitResult!.imageDataUrl.replace(/^data:image\/[\w+]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    await writeFile(join(FIXTURES_DIR, 'npc-portrait.png'), buffer);

    console.log(`  已保存: test/fixtures/npc-portrait.png (${formatBytes(buffer.length)})`);
    console.log(`  提示: 打开此文件确认背景是否透明、人物比例是否正确`);
  });
}

// ============================================================
// SUMMARY
// ============================================================

console.log('\n' + '='.repeat(60));
console.log('图片生成测试结果汇总');
console.log('='.repeat(60));

const groups = new Map<string, TestResult[]>();
for (const r of results) {
  const match = r.name.match(/^\[(.+?)\]/);
  const group = match?.[1] ?? '其他';
  const list = groups.get(group) ?? [];
  list.push(r);
  groups.set(group, list);
}

for (const [group, tests] of groups) {
  console.log(`\n  ${group}:`);
  for (const r of tests) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`    ${icon} ${r.name} (${r.durationMs}ms)`);
    if (r.error) console.log(`       ${r.error}`);
  }
}

const passed = results.filter((r) => r.passed).length;
const total = results.length;
console.log(`\n${passed}/${total} 项通过`);

if (passed < total) {
  console.log('\n⚠️  部分测试未通过。');
  process.exit(1);
}

console.log('\n🎉 全部通过！图片生成工作正常。');
process.exit(0);
