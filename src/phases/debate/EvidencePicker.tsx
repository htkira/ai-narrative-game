import type { Item } from '@/types/game';
import styles from './EvidencePicker.module.css';

interface EvidencePickerProps {
  items: Item[];
  isSelecting: boolean;
  onSelect: (itemId: string) => void;
  onItemHover?: (itemId: string) => void;
  onItemLeave?: () => void;
}

export function EvidencePicker({
  items,
  isSelecting,
  onSelect,
  onItemHover,
  onItemLeave,
}: EvidencePickerProps) {
  return (
    <div className={styles.root}>
      {items.map((item) => {
        const isClickable = isSelecting && item.isEvidence;

        return (
          <div
            key={item.itemId}
            className={`${styles.item} ${isClickable ? styles.clickable : ''} ${isSelecting && !item.isEvidence ? styles.dimmed : ''}`}
            onClick={() => isClickable && onSelect(item.itemId)}
            onMouseEnter={() => onItemHover?.(item.itemId)}
            onMouseLeave={() => onItemLeave?.()}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelect(item.itemId);
                  }
                : undefined
            }
            title={item.name}
          >
            {item.iconUrl && (
              <img src={item.iconUrl} alt={item.name} className={styles.icon} />
            )}
          </div>
        );
      })}
    </div>
  );
}
