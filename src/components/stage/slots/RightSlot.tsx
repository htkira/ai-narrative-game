import { type ReactNode } from 'react';
import { UI } from '@/utils/assets';
import styles from './RightSlot.module.css';

interface RightSlotProps {
  children?: ReactNode;
  variant?: 'inventory' | 'pre-inventory';
  className?: string;
}

export function RightSlot({
  children,
  variant = 'inventory',
  className,
}: RightSlotProps) {
  const skinSrc = variant === 'pre-inventory' ? UI.preInventory : UI.itemBar;

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <img
        src={skinSrc}
        alt=""
        className={styles.skin}
        draggable={false}
      />
      {children && <div className={styles.content}>{children}</div>}
    </div>
  );
}
