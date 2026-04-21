import { type ReactNode } from 'react';
import styles from './LeftPanel.module.css';

interface LeftPanelProps {
  imageUrl?: string;
  imageAlt?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function LeftPanel({ imageUrl, imageAlt, children, footer }: LeftPanelProps) {
  return (
    <div className={styles.root}>
      <div className={styles.imageArea}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={imageAlt ?? ''}
            className={styles.image}
          />
        )}
        {children}
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
