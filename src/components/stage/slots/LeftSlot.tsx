import { type ReactNode } from 'react';
import styles from './LeftSlot.module.css';

interface LeftSlotProps {
  children?: ReactNode;
  className?: string;
}

export function LeftSlot({ children, className }: LeftSlotProps) {
  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {children}
    </div>
  );
}
