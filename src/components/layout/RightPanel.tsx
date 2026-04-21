import { type ReactNode } from 'react';
import styles from './RightPanel.module.css';

interface RightPanelProps {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function RightPanel({ children, footer, className }: RightPanelProps) {
  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <div className={styles.content}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
