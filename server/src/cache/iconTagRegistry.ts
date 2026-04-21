/**
 * Icon Tag Registry — 管理物品图标标签的动态列表。
 *
 * 种子标签（SEED_TAGS）作为初始候选列表，LLM 可从中选取。
 * 当 LLM 自创新标签时，自动写入 dynamic-icon-tags.json 持久化，
 * 后续生成的 prompt 会包含所有已知标签（种子 + 动态），
 * 使标签列表在多次游戏中自然增长。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DYNAMIC_TAGS_PATH = join(__dirname, '..', '..', 'cache', 'dynamic-icon-tags.json');

const SEED_TAGS: ReadonlySet<string> = new Set([
  'medicine_bowl',
  'medicine_box',
  'herb_bundle',
  'prescription',
  'cloth_torn',
  'bloodstain',
  'bone_fragment',
  'knife',
  'rope',
  'oil_lamp',
  'bowl',
  'pot',
  'scroll',
  'wooden_plank',
  'stone',
  'iron_tool',
  'fur_hide',
  'dried_meat',
  'grain_sack',
  'arrow',
  'bow',
  'axe',
  'spinning_wheel',
  'dye_vat',
  'thread_spool',
  'millstone',
  'charcoal',
  'iron_mold',
  'tofu_cloth',
  'brine_jar',
  'firewood',
  'pine_resin_lamp',
  'straw_mat',
  'pillow',
  'blanket',
  'door_bolt',
  'window_paper',
  'incense',
  'talisman',
  'copper_coin',
  'hairpin',
  'comb',
  'mirror',
  'white_powder',
  'footprint',
  'scratch_mark',
  'broken_pottery',
  'dust_pile',
  'bead_string',
]);

const _dynamicTags = new Set<string>();
let _loaded = false;

function ensureLoaded(): void {
  if (_loaded) return;
  _loaded = true;
  try {
    const raw = readFileSync(DYNAMIC_TAGS_PATH, 'utf-8');
    const arr: unknown = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const tag of arr) {
        if (typeof tag === 'string') _dynamicTags.add(tag);
      }
    }
  } catch {
    // File doesn't exist yet — first run
  }
}

function persist(): void {
  mkdirSync(dirname(DYNAMIC_TAGS_PATH), { recursive: true });
  writeFileSync(
    DYNAMIC_TAGS_PATH,
    JSON.stringify([..._dynamicTags].sort(), null, 2),
    'utf-8',
  );
}

/**
 * Get all known icon tags (seed + dynamically registered).
 * Synchronous — safe to call from prompt buildMessages().
 */
export function getAllIconTags(): string[] {
  ensureLoaded();
  return [...SEED_TAGS, ..._dynamicTags];
}

/** Check if a tag is already known (seed or dynamic). */
export function isKnownTag(tag: string): boolean {
  ensureLoaded();
  return SEED_TAGS.has(tag) || _dynamicTags.has(tag);
}

/** Check if a tag is part of the original seed list. */
export function isSeedTag(tag: string): boolean {
  return SEED_TAGS.has(tag);
}

/**
 * Validate iconTag format: lowercase letters, digits, underscores.
 * 2–30 characters, must start with a letter.
 */
export function isValidTagFormat(tag: string): boolean {
  return /^[a-z][a-z0-9_]{1,29}$/.test(tag);
}

/**
 * Register new tags into the dynamic list and persist to disk.
 * Tags already known (seed or previously registered) are skipped.
 * Returns the list of newly added tags.
 */
export function registerNewTags(tags: string[]): string[] {
  ensureLoaded();
  const added: string[] = [];
  for (const tag of tags) {
    if (!SEED_TAGS.has(tag) && !_dynamicTags.has(tag) && isValidTagFormat(tag)) {
      _dynamicTags.add(tag);
      added.push(tag);
    }
  }
  if (added.length > 0) {
    persist();
  }
  return added;
}
