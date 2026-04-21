import { executePrompt, clueGenPrompt, type ClueGenInput } from '../../prompts/index.js';
import type {
  SceneSkeletonOutput,
  ItemDetailsOutput,
  ClueMappingOutput,
  StepResult,
  ValidationResult,
  ValidationError,
} from './types.js';

export async function generateClueMapping(
  skeleton: SceneSkeletonOutput,
  details: ItemDetailsOutput,
): Promise<StepResult<ClueMappingOutput>> {
  const input: ClueGenInput = { skeleton, details };
  const result = await executePrompt<ClueGenInput, ClueMappingOutput>(
    clueGenPrompt,
    input,
  );

  return {
    data: result.data,
    usage: result.usage,
    durationMs: result.durationMs,
  };
}

export function validateClueMapping(
  data: ClueMappingOutput,
  skeleton: SceneSkeletonOutput,
): ValidationResult {
  const errors: ValidationError[] = [];
  const step = 'clueMapping';

  const itemIdSet = new Set(skeleton.items.map((i) => i.itemId));
  for (const clue of data.clues) {
    if (!itemIdSet.has(clue.sourceItemId)) {
      errors.push({
        step,
        rule: 'valid_source_item',
        message: `线索 ${clue.clueId} 引用了不存在的物品 ${clue.sourceItemId}`,
      });
    }
  }

  const clueIds = data.clues.map((c) => c.clueId);
  const uniqueClueIds = new Set(clueIds);
  if (uniqueClueIds.size !== clueIds.length) {
    errors.push({ step, rule: 'unique_clue_ids', message: '存在重复的clueId' });
  }

  const hasClueItems = skeleton.items.filter((i) => i.hasClue);
  for (const item of hasClueItems) {
    const directClues = data.clues.filter(
      (c) => c.sourceItemId === item.itemId && c.type !== 'bead_memory',
    );
    if (directClues.length !== 1) {
      errors.push({
        step,
        rule: 'true_clue_exactly_one',
        message: `hasClue物品 ${item.itemId}(${item.name}) 应恰好有1条直接线索，实际有${directClues.length}条`,
      });
    }
  }

  const beadReactiveItems = skeleton.items.filter((i) => i.beadReactive);
  for (const item of beadReactiveItems) {
    const beadClues = data.clues.filter(
      (c) => c.sourceItemId === item.itemId && c.type === 'bead_memory',
    );
    if (beadClues.length !== 1) {
      errors.push({
        step,
        rule: 'bead_reactive_exactly_one',
        message: `beadReactive物品 ${item.itemId}(${item.name}) 应恰好有1条bead_memory线索，实际有${beadClues.length}条`,
      });
    }
  }

  const beadMemoryClues = data.clues.filter((c) => c.type === 'bead_memory');
  if (beadMemoryClues.length < 2) {
    errors.push({
      step,
      rule: 'min_bead_memory',
      message: `至少需要2条bead_memory线索，实际有${beadMemoryClues.length}条`,
    });
  }

  const evidenceClues = data.clues.filter((c) => c.usableAsEvidence);
  if (evidenceClues.length < 3) {
    errors.push({
      step,
      rule: 'min_evidence',
      message: `至少需要3条usableAsEvidence线索，实际有${evidenceClues.length}条`,
    });
  }

  for (const clue of data.clues) {
    if (clue.type === 'bead_memory') {
      const sourceItem = skeleton.items.find((i) => i.itemId === clue.sourceItemId);
      if (sourceItem && !sourceItem.beadReactive) {
        errors.push({
          step,
          rule: 'bead_memory_source_reactive',
          message: `bead_memory线索 ${clue.clueId} 的来源物品 ${clue.sourceItemId} 不是beadReactive`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
