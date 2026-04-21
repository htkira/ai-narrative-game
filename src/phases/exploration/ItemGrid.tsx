import { TextPanel, StreamText } from '@/components/shared';
import { ReturnButton } from './ReturnButton';
import type { Zone, Item } from '@/types/game';
import styles from './ItemGrid.module.css';

interface ItemGridProps {
  zone: Zone;
  items: Item[];
  onItemClick: (itemId: string) => void;
  onReturn: () => void;
  skipStream?: boolean;
  beadFound?: boolean;
}

export function ItemGrid({ zone, items, onItemClick, onReturn, skipStream, beadFound }: ItemGridProps) {
  return (
    <TextPanel
      className={styles.panel}
      embedded
      topContent={
        <div className={styles.header}>
          <div className={styles.zoneName}>{zone.name}</div>
          <div className={styles.zoneSummary}>
            {skipStream ? (
              zone.summary
            ) : (
              <StreamText text={zone.summary} speed={25} />
            )}
          </div>
        </div>
      }
      bottomContent={
        <div className={styles.bottom}>
          <div className={styles.grid}>
            {items.map((item) => (
              <div
                key={item.itemId}
                className={`${styles.card} ${item.isExamined ? styles.examined : ''} ${beadFound && item.beadReactive && !item.isBeadUnlocked ? styles.beadSensitive : ''}`}
                onClick={() => onItemClick(item.itemId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    onItemClick(item.itemId);
                }}
              >
                <div className={styles.iconWrap}>
                  {item.iconUrl && (
                    <img
                      src={item.iconUrl}
                      alt={item.name}
                      className={styles.icon}
                    />
                  )}
                  <span className={styles.name}>{item.name}</span>
                </div>
              </div>
            ))}
          </div>
          <ReturnButton onClick={onReturn} text="返回调查其他地方" />
        </div>
      }
      showDivider
    />
  );
}
