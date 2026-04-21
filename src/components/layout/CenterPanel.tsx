import { type ReactNode } from 'react';
import styles from './CenterPanel.module.css';

interface CenterPanelProps {
  children: ReactNode;
  className?: string;
}

export function CenterPanel({ children, className }: CenterPanelProps) {
  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {children}
    </div>
  );
}
