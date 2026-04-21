import { useMemo, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getContentProvider } from '@/content/contentFactory';
import { GameStage } from '@/components/stage';
import { LeftSlot, CenterSlot, RightSlot } from '@/components/stage/slots';
import { DialogBox } from '@/components/shared';
import { Images } from '@/utils/assets';
import styles from './EndingScreen.module.css';

export function EndingScreen() {
  const resetGame = useGameStore((s) => s.resetGame);
  const scene = useGameStore((s) => s.scene);

  const provider = useMemo(() => getContentProvider(), []);
  const endingText = useMemo(() => provider.getEndingText(), [provider]);

  const handleOptionClick = useCallback(() => {
    resetGame();
  }, [resetGame]);

  const sceneImageSrc = scene?.imageUrl || Images.scene;

  return (
    <GameStage backgroundColor={scene?.backgroundColor}>
      <LeftSlot>
        <div className={styles.leftContainer}>
          <img src={sceneImageSrc} alt={scene?.imageAlt ?? '场景'} className={styles.sceneImage} />
        </div>
      </LeftSlot>

      <CenterSlot>
        <DialogBox
          topText={endingText}
          options={[{ id: 'restart', text: '前往后山泉' }]}
          onOptionClick={handleOptionClick}
          speed={30}
          embedded
        />
      </CenterSlot>

      <RightSlot />
    </GameStage>
  );
}
