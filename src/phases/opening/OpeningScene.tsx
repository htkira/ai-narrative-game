import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getContentProvider } from '@/content/contentFactory';
import { GameStage } from '@/components/stage';
import { LeftSlot, CenterSlot, RightSlot } from '@/components/stage/slots';
import { DialogBox } from '@/components/shared';
import { Images } from '@/utils/assets';
import type { OpeningDialog } from '@/types/game';
import styles from './OpeningScene.module.css';

interface DialogTurn {
  topText: string;
  bottomText: string | null;
}

function parseDialogsIntoTurns(dialogs: OpeningDialog[]): DialogTurn[] {
  const turns: DialogTurn[] = [];
  let topLines: string[] = [];

  for (const dialog of dialogs) {
    if (dialog.speaker === '主角') {
      turns.push({
        topText: topLines.join('\n\n'),
        bottomText: dialog.text,
      });
      topLines = [];
    } else {
      topLines.push(dialog.text);
    }
  }

  if (topLines.length > 0) {
    turns.push({
      topText: topLines.join('\n\n'),
      bottomText: null,
    });
  }

  return turns;
}

export function OpeningScene() {
  const completeOpening = useGameStore((s) => s.completeOpening);

  const provider = useMemo(() => getContentProvider(), []);
  const dialogs = useMemo(() => provider.getOpeningDialogs(), [provider]);
  const turns = useMemo(() => parseDialogsIntoTurns(dialogs), [dialogs]);

  const [turnIndex, setTurnIndex] = useState(0);
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    initPromiseRef.current = provider.init().catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[OpeningScene] provider.init() failed:', err);
      setInitError(err instanceof Error ? err.message : String(err));
      throw err;
    });
    return () => {
      if ('abortInit' in provider && typeof provider.abortInit === 'function') {
        provider.abortInit();
      }
    };
  }, [provider]);

  const currentTurn = turns[turnIndex]!;
  const isLastTurn = turnIndex >= turns.length - 1;
  const optionText = currentTurn.bottomText ?? '……';

  const handleOptionClick = useCallback(async () => {
    if (isLastTurn) {
      setInitLoading(true);
      setInitError(null);
      try {
        await initPromiseRef.current;
        const sceneData = provider.getInitialScene();
        const clueDefinitions = provider.getClueDefinitions();
        const beadData = provider.getBeadData();
        completeOpening(sceneData, clueDefinitions, beadData);
      } catch (err) {
        console.error('[OpeningScene] Failed to enter exploration:', err);
        setInitError(err instanceof Error ? err.message : String(err));
        setInitLoading(false);
      }
    } else {
      setTurnIndex((prev) => prev + 1);
    }
  }, [isLastTurn, provider, completeOpening]);

  if (initLoading && !initError) {
    return (
      <GameStage>
        <LeftSlot>
          <img
            src={Images.openingScene}
            alt="暗夜水面"
            className={styles.sceneImage}
          />
        </LeftSlot>
        <CenterSlot>
          <div className={styles.loadingContainer}>
            <p className={styles.loadingText}>世界正在生成中……</p>
            <p className={styles.loadingHint}>首次生成需要数分钟，请耐心等待</p>
          </div>
        </CenterSlot>
        <RightSlot variant="pre-inventory" />
      </GameStage>
    );
  }

  if (initError) {
    return (
      <GameStage>
        <LeftSlot>
          <img
            src={Images.openingScene}
            alt="暗夜水面"
            className={styles.sceneImage}
          />
        </LeftSlot>
        <CenterSlot>
          <div className={styles.loadingContainer}>
            <p className={styles.errorText}>初始化失败：{initError}</p>
            <button
              className={styles.retryBtn}
              onClick={() => {
                setInitError(null);
                setInitLoading(false);
                initPromiseRef.current = provider.init().catch((err) => {
                  if (err instanceof DOMException && err.name === 'AbortError') return;
                  setInitError(err instanceof Error ? err.message : String(err));
                  throw err;
                });
              }}
            >
              重试
            </button>
          </div>
        </CenterSlot>
        <RightSlot variant="pre-inventory" />
      </GameStage>
    );
  }

  return (
    <GameStage>
      <LeftSlot>
        <img
          src={Images.openingScene}
          alt="暗夜水面"
          className={styles.sceneImage}
        />
      </LeftSlot>
      <CenterSlot>
        <DialogBox
          key={turnIndex}
          topText={currentTurn.topText}
          options={[{ id: 'next', text: optionText }]}
          onOptionClick={handleOptionClick}
          embedded
        />
      </CenterSlot>
      <RightSlot variant="pre-inventory" />
    </GameStage>
  );
}
