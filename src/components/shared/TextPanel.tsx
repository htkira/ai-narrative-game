import { type ReactNode } from 'react';
import { UI } from '@/utils/assets';
import styles from './TextPanel.module.css';

interface TextPanelProps {
  topContent: ReactNode;
  bottomContent?: ReactNode;
  showDivider?: boolean;
  /** When true, skip background image/color (parent slot provides it) */
  embedded?: boolean;
  className?: string;
}

export function TextPanel({
  topContent,
  bottomContent,
  showDivider = true,
  embedded,
  className,
}: TextPanelProps) {
  return (
    <div
      className={`${styles.root} ${embedded ? styles.embedded : ''} ${className ?? ''}`}
      style={embedded ? undefined : { backgroundImage: `url(${UI.textBackground})` }}
    >
      <div className={styles.top}>{topContent}</div>
      {showDivider && bottomContent && <div className={styles.divider} />}
      {bottomContent && (
        <div className={styles.bottom}>{bottomContent}</div>
      )}
    </div>
  );
}
