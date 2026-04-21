export {
  type PromptTemplate,
  executePrompt,
  system,
  user,
  assistant,
} from './types.js';

export { STORY_SKELETON, GENERATION_CONSTRAINTS } from './story-skeleton.js';

export { sceneLayoutPrompt } from './scene-layout.js';
export { itemSkeletonPrompt } from './item-skeleton.js';
export { itemGenPrompt } from './item-gen.js';
export { clueGenPrompt, type ClueGenInput } from './clue-gen.js';

export {
  debateInitPrompt,
  type DebateInitPromptInput,
} from './debate-init.js';

export {
  questionResponsePrompt,
  evidenceHitPrompt,
  evidenceMissPrompt,
  confessionPrompt,
  type QuestionPromptInput,
  type EvidenceHitPromptInput,
  type EvidenceMissPromptInput,
  type ConfessionPromptInput,
} from './debate-interact.js';
