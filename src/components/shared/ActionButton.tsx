import { type ReactNode } from 'react';
import { UI } from '@/utils/assets';
import styles from './ActionButton.module.css';

interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** When true, render a plain CSS button without the debate-button.png skin */
  plain?: boolean;
}

export function ActionButton({
  children,
  onClick,
  disabled,
  className,
  plain,
}: ActionButtonProps) {
  return (
    <button
      className={`${styles.root} ${plain ? styles.plain : ''} ${disabled ? styles.disabled : ''} ${className ?? ''}`}
      style={plain ? undefined : { backgroundImage: `url(${UI.actionButton})` }}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={styles.label}>{children}</span>
    </button>
  );
}
