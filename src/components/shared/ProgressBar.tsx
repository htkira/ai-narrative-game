import { UI } from '@/utils/assets';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
  className?: string;
}

export function ProgressBar({
  label,
  current,
  total,
  className,
}: ProgressBarProps) {
  return (
    <div
      className={`${styles.root} ${className ?? ''}`}
      style={{ backgroundImage: `url(${UI.progressBar})` }}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {current}/{total}
      </span>
    </div>
  );
}
