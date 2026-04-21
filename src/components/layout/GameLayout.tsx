import { type ReactNode } from 'react';
import styles from './GameLayout.module.css';

interface GameLayoutProps {
  left?: ReactNode;
  center: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function GameLayout({ left, center, right, className }: GameLayoutProps) {
  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <div className={styles.left}>{left}</div>
      <div className={styles.center}>{center}</div>
      <div className={styles.right}>{right}</div>
    </div>
  );
}
