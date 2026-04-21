import { executePrompt, itemSkeletonPrompt } from '../../prompts/index.js';
import { isKnownTag, isValidTagFormat, registerNewTags } from '../../cache/iconTagRegistry.js';
import type {
  SceneLayoutOutput,
  ItemSkeletonOutput,
  EvidenceLine,
  StepResult,
  ValidationResult,
  ValidationError,
} from './types.js';

export async function generateItemSkeleton(
  layout: SceneLayoutOutput,
): Promise<StepResult<ItemSkeletonOutput>> {
  const result = await executePrompt<SceneLayoutOutput, ItemSkeletonOutput>(
    itemSkeletonPrompt,
    layout,
  );

  return {
    data: result.data,
    usage: result.usage,
    durationMs: result.durationMs,
  };
}

export function validateItemSkeleton(
  data: ItemSkeletonOutput,
  layout: SceneLayoutOutput,
): ValidationResult {
  const errors: ValidationError[] = [];
  const step = 'itemSkeleton';

  const categories = data.items.map((i) => i.category);
  if (!categories.includes('atmosphere')) {
    errors.push({ step, rule: 'has_atmosphere', message: '缺少 atmosphere 类物品' });
  }
  if (!categories.includes('false_clue')) {
    errors.push({ step, rule: 'has_false_clue', message: '缺少 false_clue 类物品' });
  }
  if (!categories.includes('true_clue')) {
    errors.push({ step, rule: 'has_true_clue', message: '缺少 true_clue 类物品' });
  }

  const specialItems = data.items.filter((i) => i.category === 'special');
  if (specialItems.length !== 1) {
    errors.push({
      step,
      rule: 'exactly_one_special',
      message: `应有恰好1个special物品（残缺念珠），实际有${specialItems.length}个`,
    });
  }
  const bead = specialItems[0];
  if (bead) {
    if (bead.itemId !== 'item_bead') {
      errors.push({ step, rule: 'bead_id', message: `念珠itemId应为item_bead，实际为${bead.itemId}` });
    }
    if (bead.beadReactive) {
      errors.push({ step, rule: 'bead_not_reactive', message: '念珠自身的beadReactive应为false' });
    }
    if (bead.hasClue) {
      errors.push({ step, rule: 'bead_no_clue', message: '念珠的hasClue应为false' });
    }
    if (bead.iconTag !== 'bead_string') {
      errors.push({ step, rule: 'bead_icon_tag', message: `念珠的 iconTag 应为 bead_string，实际为 "${bead.iconTag}"` });
    }
  }

  const beadReactiveItems = data.items.filter((i) => i.beadReactive);
  if (beadReactiveItems.length < 2) {
    errors.push({
      step,
      rule: 'min_bead_reactive',
      message: `至少需要2个beadReactive物品，实际有${beadReactiveItems.length}个`,
    });
  }

  const trueClueItems = data.items.filter((i) => i.category === 'true_clue');
  for (const item of trueClueItems) {
    if (!item.hasClue) {
      errors.push({
        step,
        rule: 'true_clue_has_clue',
        message: `true_clue物品 ${item.itemId} 的hasClue应为true`,
      });
    }
  }

  const zoneIds = new Set(layout.zones.map((z) => z.zoneId));
  for (const item of data.items) {
    if (!zoneIds.has(item.zoneId)) {
      errors.push({
        step,
        rule: 'valid_zone_ref',
        message: `物品 ${item.itemId} 引用了不存在的区域 ${item.zoneId}`,
      });
    }
  }

  const itemIds = data.items.map((i) => i.itemId);
  const uniqueIds = new Set(itemIds);
  if (uniqueIds.size !== itemIds.length) {
    errors.push({ step, rule: 'unique_item_ids', message: '存在重复的itemId' });
  }

  // iconTag validation + registration
  const newTags: string[] = [];
  for (const item of data.items) {
    if (!item.iconTag || item.iconTag.trim() === '') {
      errors.push({ step, rule: 'icon_tag_present', message: `物品 ${item.itemId} 缺少 iconTag` });
    } else if (!isValidTagFormat(item.iconTag)) {
      errors.push({
        step,
        rule: 'icon_tag_format',
        message: `物品 ${item.itemId} 的 iconTag "${item.iconTag}" 格式不合法（需全小写英文+下划线，2-30字符）`,
      });
    } else if (!isKnownTag(item.iconTag)) {
      newTags.push(item.iconTag);
    }
  }

  if (newTags.length > 0) {
    const added = registerNewTags(newTags);
    if (added.length > 0) {
      console.log(`[iconTag] 注册新标签: ${added.join(', ')}`);
    }
  }

  // evidenceLines validation
  const allLines: EvidenceLine[] = ['A', 'B', 'C', 'D', 'E'];
  const coveredLines = new Set<EvidenceLine>();
  for (const item of data.items) {
    if (item.category === 'atmosphere' || item.category === 'special') {
      if (item.evidenceLines && item.evidenceLines.length > 0) {
        errors.push({
          step,
          rule: 'no_evidence_for_atmosphere_special',
          message: `${item.category} 物品 ${item.itemId} 的 evidenceLines 应为空数组`,
        });
      }
    } else {
      if (item.evidenceLines) {
        if (item.evidenceLines.length > 2) {
          errors.push({
            step,
            rule: 'max_evidence_lines',
            message: `物品 ${item.itemId} 最多承载2条推理线，实际有${item.evidenceLines.length}条`,
          });
        }
        for (const line of item.evidenceLines) {
          coveredLines.add(line);
        }
      }
    }
  }

  for (const line of allLines) {
    if (!coveredLines.has(line)) {
      errors.push({
        step,
        rule: 'evidence_line_coverage',
        message: `推理线 ${line} 未被任何物品的 evidenceLines 覆盖`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
