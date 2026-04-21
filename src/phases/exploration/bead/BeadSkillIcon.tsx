import { useCallback, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getContentProvider } from '@/content/contentFactory';
import { UI } from '@/utils/assets';
import styles from './BeadSkillIcon.module.css';

export function BeadSkillIcon() {
  const bead = useGameStore((s) => s.bead);
  const selectedItemId = useGameStore((s) => s.selectedItemId);
  const useBead = useGameStore((s) => s.useBead);
  const provider = useMemo(() => getContentProvider(), []);

  const handleClick = useCallback(() => {
    if (!bead.active || !selectedItemId) return;
    const remnantText = provider.getBeadRemnant(selectedItemId);
    if (remnantText) {
      useBead(selectedItemId, remnantText);
    } else {
      console.warn(
        `[BeadSkillIcon] No remnant text for item "${selectedItemId}". ` +
        `Provider type: ${provider.constructor.name}`,
      );
    }
  }, [bead.active, selectedItemId, useBead, provider]);

  return (
    <div className={styles.wrapper}>
      <img
        src={UI.beadSkillIcon}
        alt="念珠技能"
        className={`${styles.icon} ${bead.active ? styles.active : ''}`}
        onClick={bead.active ? handleClick : undefined}
      />
    </div>
  );
}
