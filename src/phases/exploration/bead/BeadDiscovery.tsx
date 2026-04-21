import { useMemo } from 'react';
import { TextPanel, StreamText } from '@/components/shared';
import { getContentProvider } from '@/content/contentFactory';
import styles from './BeadDiscovery.module.css';

interface BeadDiscoveryProps {
  onAccept: () => void;
}

export function BeadDiscovery({ onAccept }: BeadDiscoveryProps) {
  const provider = useMemo(() => getContentProvider(), []);
  const beadData = useMemo(() => provider.getBeadData(), [provider]);

  return (
    <TextPanel
      className={styles.panel}
      embedded
      topContent={
        <div className={styles.top}>
          <div className={styles.imageWrapper}>
            <img
              src={beadData.iconUrl}
              alt={beadData.name}
              className={styles.beadImage}
            />
          </div>
          <div className={styles.name}>{beadData.name}</div>
          <StreamText
            text={beadData.description}
            speed={25}
            className={styles.description}
          />
        </div>
      }
      bottomContent={
        <div className={styles.bottom}>
          <div
            className={styles.acceptOption}
            onClick={onAccept}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onAccept();
            }}
          >
            收下它
          </div>
        </div>
      }
      showDivider
    />
  );
}
