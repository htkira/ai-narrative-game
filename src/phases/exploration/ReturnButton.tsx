import styles from './ReturnButton.module.css';

interface ReturnButtonProps {
  onClick: () => void;
  text?: string;
}

export function ReturnButton({
  onClick,
  text = '返回调查其他地方',
}: ReturnButtonProps) {
  return (
    <div
      className={styles.root}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      {text}
    </div>
  );
}
