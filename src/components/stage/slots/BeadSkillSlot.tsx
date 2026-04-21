import { type ReactNode } from 'react';
import styles from './BeadSkillSlot.module.css';

interface BeadSkillSlotProps {
  children?: ReactNode;
  className?: string;
}

export function BeadSkillSlot({ children, className }: BeadSkillSlotProps) {
  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {children}
    </div>
  );
}
