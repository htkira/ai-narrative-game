import type {
  SceneSkeletonOutput,
  ItemDetailsOutput,
  ClueMappingOutput,
  EvidenceLine,
  ValidationResult,
  ValidationError,
} from './types.js';

/**
 * Cross-step validation: checks consistency across all generated data.
 * Run after all 4 steps complete.
 */
export function validateCrossStep(
  skeleton: SceneSkeletonOutput,
  details: ItemDetailsOutput,
  clues: ClueMappingOutput,
): ValidationResult {
  const errors: ValidationError[] = [];
  const step = 'crossStep';

  const evidenceItems = skeleton.items.filter((i) => i.hasClue || i.beadReactive);
  for (const item of evidenceItems) {
    const matchingClues = clues.clues.filter(
      (c) => c.sourceItemId === item.itemId && c.usableAsEvidence,
    );
    if (matchingClues.length === 0) {
      errors.push({
        step,
        rule: 'evidence_item_has_clue',
        message: `物证物品 ${item.itemId}(${item.name}) 没有对应的usableAsEvidence线索`,
      });
    }
  }

  for (const clue of clues.clues) {
    if (clue.type === 'bead_memory') {
      const hasRemnant = details.beadRemnants.some(
        (r) => r.itemId === clue.sourceItemId,
      );
      if (!hasRemnant) {
        errors.push({
          step,
          rule: 'bead_memory_has_remnant',
          message: `bead_memory线索 ${clue.clueId} 的来源物品 ${clue.sourceItemId} 缺少残念文本`,
        });
      }
    }
  }

  const trueClues = skeleton.items.filter((i) => i.category === 'true_clue');
  if (trueClues.length < 3) {
    errors.push({
      step,
      rule: 'min_true_clues',
      message: `至少需要3个true_clue物品，实际有${trueClues.length}个`,
    });
  }

  const falseClues = skeleton.items.filter((i) => i.category === 'false_clue');
  if (falseClues.length < 1) {
    errors.push({
      step,
      rule: 'min_false_clues',
      message: `至少需要1个false_clue物品，实际有${falseClues.length}个`,
    });
  }

  const atmosphereItems = skeleton.items.filter((i) => i.category === 'atmosphere');
  if (atmosphereItems.length < 1) {
    errors.push({
      step,
      rule: 'min_atmosphere',
      message: `至少需要1个atmosphere物品，实际有${atmosphereItems.length}个`,
    });
  }

  const totalClues = clues.clues.length;
  if (totalClues < 6) {
    errors.push({
      step,
      rule: 'min_total_clues',
      message: `总线索数至少6条，实际有${totalClues}条`,
    });
  }

  // Cross-check: evidenceLines coverage is consistent end-to-end
  const allLines: EvidenceLine[] = ['A', 'B', 'C', 'D', 'E'];
  const coveredLines = new Set<EvidenceLine>();
  for (const item of skeleton.items) {
    if (item.evidenceLines) {
      for (const line of item.evidenceLines) {
        coveredLines.add(line);
      }
    }
  }
  for (const line of allLines) {
    if (!coveredLines.has(line)) {
      errors.push({
        step,
        rule: 'evidence_line_coverage_cross',
        message: `推理线 ${line} 在最终合并数据中未被任何物品的 evidenceLines 覆盖`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
