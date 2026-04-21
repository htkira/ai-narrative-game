import { type ReactNode } from 'react';
import { UI } from '@/utils/assets';
import styles from './ProgressSlot.module.css';

interface ProgressSlotProps {
  children?: ReactNode;
  className?: string;
}

export function ProgressSlot({ children, className }: ProgressSlotProps) {
  return (
    <div
      className={`${styles.root} ${className ?? ''}`}
      style={{ backgroundImage: `url(${UI.progressBar})` }}
    >
      {children}
    </div>
  );
}
