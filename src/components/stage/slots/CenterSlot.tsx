import { type ReactNode } from 'react';
import { UI } from '@/utils/assets';
import styles from './CenterSlot.module.css';

interface CenterSlotProps {
  children?: ReactNode;
  className?: string;
}

export function CenterSlot({ children, className }: CenterSlotProps) {
  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <img
        src={UI.textBackground}
        alt=""
        className={styles.skin}
        draggable={false}
      />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
