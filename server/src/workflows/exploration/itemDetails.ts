import { executePrompt, itemGenPrompt } from '../../prompts/index.js';
import type {
  SceneSkeletonOutput,
  ItemDetailsOutput,
  StepResult,
  ValidationResult,
  ValidationError,
} from './types.js';

export async function generateItemDetails(
  skeleton: SceneSkeletonOutput,
): Promise<StepResult<ItemDetailsOutput>> {
  const result = await executePrompt<SceneSkeletonOutput, ItemDetailsOutput>(
    itemGenPrompt,
    skeleton,
  );

  return {
    data: result.data,
    usage: result.usage,
    durationMs: result.durationMs,
  };
}

export function validateItemDetails(
  data: ItemDetailsOutput,
  skeleton: SceneSkeletonOutput,
): ValidationResult {
  const errors: ValidationError[] = [];
  const step = 'itemDetails';

  const describedIds = new Set(data.descriptions.map((d) => d.itemId));
  for (const item of skeleton.items) {
    if (!describedIds.has(item.itemId)) {
      errors.push({
        step,
        rule: 'all_items_described',
        message: `物品 ${item.itemId}(${item.name}) 缺少描述`,
      });
    }
  }

  for (const desc of data.descriptions) {
    if (!skeleton.items.some((i) => i.itemId === desc.itemId)) {
      errors.push({
        step,
        rule: 'no_extra_descriptions',
        message: `描述中引用了不存在的物品 ${desc.itemId}`,
      });
    }
    if (!desc.description || desc.description.trim().length < 10) {
      errors.push({
        step,
        rule: 'description_quality',
        message: `物品 ${desc.itemId} 的描述过短`,
      });
    }
  }

  const beadReactiveIds = new Set(
    skeleton.items.filter((i) => i.beadReactive).map((i) => i.itemId),
  );
  const remnantIds = new Set(data.beadRemnants.map((r) => r.itemId));
  for (const id of beadReactiveIds) {
    if (!remnantIds.has(id)) {
      errors.push({
        step,
        rule: 'all_reactive_have_remnant',
        message: `beadReactive物品 ${id} 缺少残念文本`,
      });
    }
  }

  for (const remnant of data.beadRemnants) {
    if (!beadReactiveIds.has(remnant.itemId)) {
      errors.push({
        step,
        rule: 'remnant_source_valid',
        message: `残念文本引用了非beadReactive物品 ${remnant.itemId}`,
      });
    }
    if (!remnant.text || remnant.text.trim().length < 10) {
      errors.push({
        step,
        rule: 'remnant_quality',
        message: `物品 ${remnant.itemId} 的残念文本过短`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
