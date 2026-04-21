import { generateSceneLayout, validateSceneLayout } from './sceneLayout.js';
import { generateItemSkeleton, validateItemSkeleton } from './itemSkeleton.js';
import { generateItemDetails, validateItemDetails } from './itemDetails.js';
import { generateClueMapping, validateClueMapping } from './clueMapping.js';
import { validateCrossStep } from './validator.js';
import type {
  SceneLayoutOutput,
  ItemSkeletonOutput,
  SceneSkeletonOutput,
  ItemDetailsOutput,
  ClueMappingOutput,
  ExplorationResult,
  ValidationResult,
  StepResult,
} from './types.js';
import type { TokenUsage } from '../../llm/index.js';

export interface ExplorationStepLog {
  step: string;
  durationMs: number;
  usage: TokenUsage;
  validation: ValidationResult;
}

export interface ExplorationWorkflowResult {
  result: ExplorationResult;
  steps: ExplorationStepLog[];
  totalDurationMs: number;
  totalUsage: TokenUsage;
  intermediates: {
    layout: SceneLayoutOutput;
    itemSkeleton: ItemSkeletonOutput;
    skeleton: SceneSkeletonOutput;
    details: ItemDetailsOutput;
    clues: ClueMappingOutput;
  };
}

function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

function mergeLayoutAndItems(
  layout: SceneLayoutOutput,
  itemSkeleton: ItemSkeletonOutput,
): SceneSkeletonOutput {
  return {
    scene: layout.scene,
    zones: layout.zones,
    items: itemSkeleton.items,
  };
}

function assembleResult(
  skeleton: SceneSkeletonOutput,
  details: ItemDetailsOutput,
  clues: ClueMappingOutput,
): ExplorationResult {
  const descMap = new Map(details.descriptions.map((d) => [d.itemId, d.description]));

  const beadItem = skeleton.items.find((i) => i.category === 'special');
  const beadItemId = beadItem?.itemId ?? 'item_bead';

  const cluesByItem = new Map<string, string>();
  for (const clue of clues.clues) {
    if (clue.type !== 'bead_memory' && !cluesByItem.has(clue.sourceItemId)) {
      cluesByItem.set(clue.sourceItemId, clue.clueId);
    }
  }

  const items = skeleton.items.map((item) => ({
    itemId: item.itemId,
    name: item.name,
    iconUrl: '',
    iconTag: item.iconTag,
    category: item.category,
    zoneId: item.zoneId,
    description: descMap.get(item.itemId) ?? '',
    isDiscovered: false,
    isExamined: false,
    hasClue: item.hasClue,
    clueId: cluesByItem.get(item.itemId) ?? null,
    beadReactive: item.beadReactive,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: item.hasClue || item.beadReactive,
  }));

  const itemIdsByZone = new Map<string, string[]>();
  for (const item of skeleton.items) {
    const list = itemIdsByZone.get(item.zoneId) ?? [];
    list.push(item.itemId);
    itemIdsByZone.set(item.zoneId, list);
  }

  const zones = skeleton.zones.map((z) => ({
    zoneId: z.zoneId,
    name: z.name,
    summary: z.summary,
    itemIds: itemIdsByZone.get(z.zoneId) ?? [],
    unlocked: true,
  }));

  return {
    scene: {
      sceneId: skeleton.scene.sceneId,
      title: skeleton.scene.title,
      description: skeleton.scene.description,
      imageUrl: '',
      imageAlt: skeleton.scene.imageAlt,
    },
    zones,
    items,
    beadData: {
      itemId: beadItemId,
      name: beadItem?.name ?? '残缺念珠',
      description: descMap.get(beadItemId) ?? '',
      iconUrl: '',
      hintText: '念珠微微发热，似乎感应到了什么……',
    },
    clueDefinitions: clues.clues,
    itemDescriptions: Object.fromEntries(details.descriptions.map((d) => [d.itemId, d.description])),
    beadRemnants: Object.fromEntries(details.beadRemnants.map((r) => [r.itemId, r.text])),
  };
}

export interface RunExplorationOptions {
  stopAfterStep?: number;
  onStepComplete?: (log: ExplorationStepLog) => void;
}

/**
 * Run the exploration content generation workflow.
 *
 * Steps:
 *   1. Generate scene layout (scene + zones)
 *   2. Generate item skeleton (items with evidenceLines)
 *   3. Generate item descriptions and bead remnant texts
 *   4. Generate clue mapping
 *   5. Cross-step validation
 *
 * Each step validates its output; the workflow throws on critical validation failures.
 */
export async function runExplorationWorkflow(
  options: RunExplorationOptions = {},
): Promise<ExplorationWorkflowResult> {
  const { stopAfterStep, onStepComplete } = options;
  const steps: ExplorationStepLog[] = [];
  const startTime = Date.now();
  let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  function logStep(
    name: string,
    stepResult: StepResult<unknown>,
    validation: ValidationResult,
  ): void {
    const log: ExplorationStepLog = {
      step: name,
      durationMs: stepResult.durationMs,
      usage: stepResult.usage,
      validation,
    };
    steps.push(log);
    totalUsage = mergeUsage(totalUsage, stepResult.usage);
    onStepComplete?.(log);
  }

  const emptyItemSkeleton: ItemSkeletonOutput = { items: [] };
  const emptyDetails: ItemDetailsOutput = { descriptions: [], beadRemnants: [] };
  const emptyClues: ClueMappingOutput = { clues: [] };

  // Step 1: Scene Layout
  console.log('[exploration] Step 1: Generating scene layout...');
  const step1 = await generateSceneLayout();
  const v1 = validateSceneLayout(step1.data);
  logStep('sceneLayout', step1, v1);

  if (!v1.valid) {
    console.warn('[exploration] Step 1 validation warnings:', v1.errors);
  }

  if (stopAfterStep === 1) {
    const merged = mergeLayoutAndItems(step1.data, emptyItemSkeleton);
    return buildResult(step1.data, emptyItemSkeleton, merged, emptyDetails, emptyClues, steps, totalUsage, startTime);
  }

  // Step 2: Item Skeleton
  console.log('[exploration] Step 2: Generating item skeleton...');
  const step2 = await generateItemSkeleton(step1.data);
  const v2 = validateItemSkeleton(step2.data, step1.data);
  logStep('itemSkeleton', step2, v2);

  if (!v2.valid) {
    console.warn('[exploration] Step 2 validation warnings:', v2.errors);
  }

  const merged = mergeLayoutAndItems(step1.data, step2.data);

  if (stopAfterStep === 2) {
    return buildResult(step1.data, step2.data, merged, emptyDetails, emptyClues, steps, totalUsage, startTime);
  }

  // Step 3: Item Details
  console.log('[exploration] Step 3: Generating item details...');
  const step3 = await generateItemDetails(merged);
  const v3 = validateItemDetails(step3.data, merged);
  logStep('itemDetails', step3, v3);

  if (!v3.valid) {
    console.warn('[exploration] Step 3 validation warnings:', v3.errors);
  }

  if (stopAfterStep === 3) {
    return buildResult(step1.data, step2.data, merged, step3.data, emptyClues, steps, totalUsage, startTime);
  }

  // Step 4: Clue Mapping
  console.log('[exploration] Step 4: Generating clue mapping...');
  const step4 = await generateClueMapping(merged, step3.data);
  const v4 = validateClueMapping(step4.data, merged);
  logStep('clueMapping', step4, v4);

  if (!v4.valid) {
    console.warn('[exploration] Step 4 validation warnings:', v4.errors);
  }

  if (stopAfterStep === 4) {
    return buildResult(step1.data, step2.data, merged, step3.data, step4.data, steps, totalUsage, startTime);
  }

  // Step 5: Cross-step validation
  console.log('[exploration] Step 5: Cross-step validation...');
  const crossValidation = validateCrossStep(merged, step3.data, step4.data);
  steps.push({
    step: 'crossStepValidation',
    durationMs: 0,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    validation: crossValidation,
  });

  if (!crossValidation.valid) {
    console.warn('[exploration] Cross-step validation warnings:', crossValidation.errors);
  }

  return buildResult(step1.data, step2.data, merged, step3.data, step4.data, steps, totalUsage, startTime);
}

function buildResult(
  layout: SceneLayoutOutput,
  itemSkeleton: ItemSkeletonOutput,
  skeleton: SceneSkeletonOutput,
  details: ItemDetailsOutput,
  clues: ClueMappingOutput,
  steps: ExplorationStepLog[],
  totalUsage: TokenUsage,
  startTime: number,
): ExplorationWorkflowResult {
  return {
    result: assembleResult(skeleton, details, clues),
    steps,
    totalDurationMs: Date.now() - startTime,
    totalUsage,
    intermediates: {
      layout,
      itemSkeleton,
      skeleton,
      details,
      clues,
    },
  };
}

export type {
  ExplorationResult,
  SceneLayoutOutput,
  ItemSkeletonOutput,
  SceneSkeletonOutput,
  ItemDetailsOutput,
  ClueMappingOutput,
  ValidationResult,
  ValidationError,
} from './types.js';
