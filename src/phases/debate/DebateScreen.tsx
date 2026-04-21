import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getContentProvider } from '@/content/contentFactory';
import { GameStage } from '@/components/stage';
import {
  LeftSlot,
  CenterSlot,
  RightSlot,
  ProgressSlot,
} from '@/components/stage/slots';
import { TextPanel } from '@/components/shared';
import { Images } from '@/utils/assets';
import { NpcSpeech } from './NpcSpeech';
import { DebateActions } from './DebateActions';
import { EvidencePicker } from './EvidencePicker';
import { ConfidenceMeter } from './ConfidenceMeter';
import styles from './DebateScreen.module.css';

export type DebateMode =
  | 'idle'
  | 'questioning'
  | 'selecting_evidence'
  | 'processing'
  | 'ended';

export function DebateScreen() {
  const debate = useGameStore((s) => s.debate);
  const scene = useGameStore((s) => s.scene);
  const items = useGameStore((s) => s.items);
  const clues = useGameStore((s) => s.clues);
  const goToEnding = useGameStore((s) => s.goToEnding);
  const applyQuestionResult = useGameStore((s) => s.applyQuestionResult);
  const applyEvidenceResult = useGameStore((s) => s.applyEvidenceResult);
  const setCurrentClaim = useGameStore((s) => s.setCurrentClaim);

  const provider = useMemo(() => getContentProvider(), []);

  const [mode, setMode] = useState<DebateMode>('idle');
  const [speechKey, setSpeechKey] = useState(0);
  const [streamDone, setStreamDone] = useState(false);

  // ---- Inventory (same rules as exploration) ----
  const inventoryItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.category === 'true_clue' &&
          i.isDiscovered &&
          (!i.beadReactive || i.isBeadUnlocked),
      ),
    [items],
  );

  const hasEvidence = useMemo(
    () => inventoryItems.some((i) => i.isEvidence),
    [inventoryItems],
  );

  // ---- Inventory tooltip hover state ----
  const [hoveredInvItemId, setHoveredInvItemId] = useState<string | null>(null);

  const hoveredInvClues = useMemo(() => {
    if (!hoveredInvItemId) return [];
    return clues.records.filter((c) => c.sourceItemId === hoveredInvItemId);
  }, [hoveredInvItemId, clues.records]);

  const hoveredInvIndex = useMemo(() => {
    if (!hoveredInvItemId) return -1;
    return inventoryItems.findIndex((i) => i.itemId === hoveredInvItemId);
  }, [hoveredInvItemId, inventoryItems]);

  // ---- Debate state machine ----
  useEffect(() => {
    if (mode === 'idle' && streamDone && debate.ended) {
      setMode('ended');
    }
  }, [mode, streamDone, debate.ended]);

  const handleStreamComplete = useCallback(() => {
    setStreamDone(true);
  }, []);

  const advanceSpeech = useCallback(() => {
    setSpeechKey((k) => k + 1);
    setStreamDone(false);
  }, []);

  const handleQuestion = useCallback(
    async (text: string) => {
      setMode('processing');
      try {
        const { debate: d } = useGameStore.getState();
        const context = {
          round: d.round,
          currentClaimId: d.currentClaimId,
          refutedClaimIds: d.claims
            .filter((c) => c.status === 'refuted')
            .map((c) => c.claimId),
          attitudeStage: d.npc?.attitudeStage ?? 'assertive',
        };
        const response = await provider.processQuestion(text, context);
        applyQuestionResult(text, response);
        advanceSpeech();
        setMode('idle');
      } catch (err) {
        console.error('[DebateScreen] processQuestion failed:', err);
        setMode('idle');
      }
    },
    [provider, applyQuestionResult, advanceSpeech],
  );

  const handleEvidenceSelect = useCallback(
    async (itemId: string) => {
      if (mode !== 'selecting_evidence') return;
      const { debate: d } = useGameStore.getState();
      if (!d.currentClaimId) return;
      setMode('processing');
      try {
        const result = await provider.processEvidence(itemId, d.currentClaimId);
        applyEvidenceResult(itemId, d.currentClaimId, '', result);
        advanceSpeech();
        setMode('idle');
      } catch (err) {
        console.error('[DebateScreen] processEvidence failed:', err);
        setMode('idle');
      }
    },
    [mode, provider, applyEvidenceResult, advanceSpeech],
  );

  const handleCancelAction = useCallback(() => {
    setMode('idle');
  }, []);

  const sceneImageSrc = scene?.imageUrl || Images.scene;
  const npcPortraitSrc = debate.npc?.portraitUrl || Images.character;

  if (!debate.npc) return null;

  return (
    <GameStage backgroundColor={scene?.backgroundColor}>
      <LeftSlot>
        <div className={styles.leftContainer}>
          <img src={sceneImageSrc} alt={scene?.imageAlt ?? '场景'} className={styles.sceneImage} />
          <img
            src={npcPortraitSrc}
            alt={debate.npc.name}
            className={styles.npcImage}
          />
        </div>
      </LeftSlot>

      <CenterSlot>
        <TextPanel
          embedded
          className={styles.debatePanel}
          topContent={
            <NpcSpeech
              key={speechKey}
              npc={debate.npc}
              onStreamComplete={handleStreamComplete}
            />
          }
          bottomContent={
            <DebateActions
              mode={mode}
              claims={debate.claims}
              currentClaimId={debate.currentClaimId}
              streamDone={streamDone}
              hasEvidence={hasEvidence}
              onSetCurrentClaim={setCurrentClaim}
              onStartQuestion={() => setMode('questioning')}
              onSubmitQuestion={handleQuestion}
              onStartEvidence={() => setMode('selecting_evidence')}
              onCancelAction={handleCancelAction}
              onProceedToEnding={goToEnding}
            />
          }
          showDivider
        />
      </CenterSlot>

      <RightSlot>
        <EvidencePicker
          items={inventoryItems}
          isSelecting={mode === 'selecting_evidence'}
          onSelect={handleEvidenceSelect}
          onItemHover={setHoveredInvItemId}
          onItemLeave={() => setHoveredInvItemId(null)}
        />
      </RightSlot>

      {/* Inventory tooltip — rendered as GameStage direct child to avoid RightSlot overflow clip */}
      {hoveredInvItemId && hoveredInvClues.length > 0 && hoveredInvIndex >= 0 && (
        <div
          className={styles.invTooltip}
          style={{ top: 91 + hoveredInvIndex * 110 }}
        >
          <div className={styles.tooltipName}>
            {inventoryItems[hoveredInvIndex]?.name}
          </div>
          {hoveredInvClues.map((clue) => (
            <div key={clue.clueId} className={styles.tooltipClue}>
              {clue.title}：{clue.summary}
            </div>
          ))}
        </div>
      )}

      <ProgressSlot>
        <ConfidenceMeter
          total={debate.claims.length}
          refuted={debate.refutedCount}
        />
      </ProgressSlot>
    </GameStage>
  );
}
