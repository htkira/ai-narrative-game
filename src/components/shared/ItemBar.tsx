import { UI } from '@/utils/assets';
import styles from './ItemBar.module.css';

export interface ItemBarItem {
  itemId: string;
  iconUrl: string;
  name: string;
}

interface ItemBarProps {
  items: ItemBarItem[];
  selectedItemId?: string | null;
  onItemClick?: (itemId: string) => void;
  className?: string;
}

export function ItemBar({
  items,
  selectedItemId,
  onItemClick,
  className,
}: ItemBarProps) {
  return (
    <div
      className={`${styles.root} ${className ?? ''}`}
      style={{ backgroundImage: `url(${UI.itemBar})` }}
    >
      <div className={styles.title}>物品栏</div>
      <div className={styles.list}>
        {items.map((item) => (
          <button
            key={item.itemId}
            className={`${styles.item} ${selectedItemId === item.itemId ? styles.selected : ''}`}
            onClick={() => onItemClick?.(item.itemId)}
            title={item.name}
          >
            {item.iconUrl && (
              <img
                src={item.iconUrl}
                alt={item.name}
                className={styles.icon}
              />
            )}
          </button>
        ))}
      </div>
      {items.length === 0 && (
        <div className={styles.empty}>暂无物品</div>
      )}
    </div>
  );
}
