import { useEffect } from 'react';
import { StreamText } from '@/components/shared';
import styles from './RemnantText.module.css';

interface RemnantTextProps {
  text: string;
  skipStream?: boolean;
  onComplete?: () => void;
}

export function RemnantText({ text, skipStream, onComplete }: RemnantTextProps) {
  useEffect(() => {
    if (skipStream && onComplete) {
      onComplete();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.root}>
      <div className={styles.body}>
        {skipStream ? (
          <span className={styles.text}>{text}</span>
        ) : (
          <StreamText
            text={text}
            speed={25}
            onComplete={onComplete}
            className={styles.text}
          />
        )}
      </div>
    </div>
  );
}
