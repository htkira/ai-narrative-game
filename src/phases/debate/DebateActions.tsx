import { useState } from 'react';
import { ActionButton, InputBox } from '@/components/shared';
import type { Claim, ClaimStatus } from '@/types/game';
import type { DebateMode } from './DebateScreen';
import styles from './DebateActions.module.css';

interface DebateActionsProps {
  mode: DebateMode;
  claims: Claim[];
  currentClaimId: string | null;
  streamDone: boolean;
  hasEvidence: boolean;
  onSetCurrentClaim: (claimId: string) => void;
  onStartQuestion: () => void;
  onSubmitQuestion: (text: string) => void;
  onStartEvidence: () => void;
  onCancelAction: () => void;
  onProceedToEnding: () => void;
}

const STATUS_LABEL: Record<ClaimStatus, string> = {
  active: '待驳',
  weakened: '动摇',
  refuted: '已驳',
};

function statusClass(status: ClaimStatus): string {
  switch (status) {
    case 'active': return styles.statusActive ?? '';
    case 'weakened': return styles.statusWeakened ?? '';
    case 'refuted': return styles.statusRefuted ?? '';
    default: return '';
  }
}

export function DebateActions({
  mode,
  claims,
  currentClaimId,
  streamDone,
  hasEvidence,
  onSetCurrentClaim,
  onStartQuestion,
  onSubmitQuestion,
  onStartEvidence,
  onCancelAction,
  onProceedToEnding,
}: DebateActionsProps) {
  const [questionText, setQuestionText] = useState('');

  const currentClaim = claims.find((c) => c.claimId === currentClaimId);
  const activeClaims = claims.filter((c) => c.status !== 'refuted');
  const noActiveClaims = activeClaims.length === 0;

  const handleSubmitQuestion = () => {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    onSubmitQuestion(trimmed);
    setQuestionText('');
  };

  if (mode === 'processing') {
    return (
      <div className={styles.root}>
        <p className={styles.processingText}>正在思考中……</p>
      </div>
    );
  }

  if (mode === 'ended') {
    return (
      <div className={styles.root}>
        <div
          className={styles.proceedLink}
          onClick={onProceedToEnding}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onProceedToEnding();
          }}
        >
          ……
        </div>
      </div>
    );
  }

  if (!streamDone) return null;

  return (
    <div className={styles.root}>
      {/* Claim status tabs */}
      <div className={styles.claimTabs}>
        {claims.map((claim) => (
          <div
            key={claim.claimId}
            className={`${styles.claimTab} ${statusClass(claim.status)} ${claim.claimId === currentClaimId ? styles.focused : ''}`}
            onClick={() =>
              claim.status !== 'refuted' && onSetCurrentClaim(claim.claimId)
            }
            role={claim.status !== 'refuted' ? 'button' : undefined}
            tabIndex={claim.status !== 'refuted' ? 0 : undefined}
            onKeyDown={
              claim.status !== 'refuted'
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      onSetCurrentClaim(claim.claimId);
                  }
                : undefined
            }
          >
            <span className={styles.tabLabel}>
              {claim.text.length > 7 ? claim.text.slice(0, 7) + '…' : claim.text}
            </span>
            <span className={styles.tabStatus}>{STATUS_LABEL[claim.status]}</span>
          </div>
        ))}
      </div>

      {/* Current claim detail — visible in idle, questioning, and selecting_evidence */}
      {currentClaim && (
        <div className={styles.claimDetail}>
          <p className={styles.claimText}>「{currentClaim.text}」</p>
          <p className={styles.claimBasis}>论据：{currentClaim.basis}</p>
        </div>
      )}

      {/* Idle: action buttons */}
      {mode === 'idle' && (
        <div className={styles.actionRow}>
          <ActionButton plain onClick={onStartQuestion} disabled={noActiveClaims}>
            追问疑点
          </ActionButton>
          <ActionButton
            plain
            onClick={onStartEvidence}
            disabled={noActiveClaims || !hasEvidence}
          >
            出示物证
          </ActionButton>
        </div>
      )}

      {/* Questioning: input + send */}
      {mode === 'questioning' && (
        <div className={styles.questionArea}>
          <InputBox
            value={questionText}
            onChange={setQuestionText}
            onSubmit={handleSubmitQuestion}
            placeholder="输入你的追问…"
          />
          <div className={styles.questionActions}>
            <ActionButton
              plain
              onClick={handleSubmitQuestion}
              disabled={!questionText.trim()}
            >
              完成
            </ActionButton>
            <span
              className={styles.cancelLink}
              onClick={onCancelAction}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onCancelAction();
              }}
            >
              取消
            </span>
          </div>
        </div>
      )}

      {/* Selecting evidence: prompt */}
      {mode === 'selecting_evidence' && (
        <div className={styles.prompt}>
          <p className={styles.promptInstruction}>请从右侧物品栏选择物证</p>
          <span
            className={styles.cancelLink}
            onClick={onCancelAction}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onCancelAction();
            }}
          >
            取消
          </span>
        </div>
      )}
    </div>
  );
}
