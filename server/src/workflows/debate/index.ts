export {
  generateDebateInit,
  validateDebateInit,
} from './initClaims.js';

export { processDebateQuestion } from './question.js';

export { processDebateEvidence } from './evidence.js';

export {
  calculateAttitude,
  formatHistory,
  type AttitudeStage,
  type ClaimStatus,
  type ClaimGenOutput,
  type DebateNpc,
  type DebateClaim,
  type DebateInitData,
  type DebateContext,
  type DebateHistoryEntry,
  type DebateResponse,
  type EvidenceResult,
  type DebateValidationResult,
  type DebateValidationError,
  type DebateStepResult,
} from './types.js';
