import { useRef, useState, useMemo, type ReactNode } from 'react';
import { TextPanel, StreamText, type TextSegment } from '@/components/shared';
import { RemnantText } from './bead';
import type { Item, Clue } from '@/types/game';
import styles from './ItemDetail.module.css';

const BEAD_EPILOGUE_BEFORE = '心念微动间，你似有所悟——像是本就藏在心底，只是此刻才被唤醒：';
const BEAD_EPILOGUE_RED = '每当这念珠微微发热，便是某件器物上还缠着一缕未散的\u201C业\u201D。';
const BEAD_EPILOGUE_AFTER = '那并非完整的过往，只是一瞬的情绪、一句话、一个眼神的余温，穿过生死后落进你心里。这样的知觉来得突兀，却有如旧梦回身。你不由得攥紧佛珠，目光重新落回这间屋子。';

interface ItemDetailProps {
  item: Item;
  discoveredClues?: Clue[];
  onReturn: () => void;
  returnText?: string;
  skipStream?: boolean;
}

export function ItemDetail({
  item,
  discoveredClues = [],
  onReturn,
  returnText = '继续调查此处',
  skipStream = false,
}: ItemDetailProps) {
  const wasUnlockedOnMount = useRef(item.isBeadUnlocked);
  const hasRemnant = item.isBeadUnlocked && item.beadText;
  const isNewReveal = hasRemnant && !wasUnlockedOnMount.current;

  const isBead = item.category === 'special';
  const fullDesc = isBead
    ? item.description + '\n\n' + BEAD_EPILOGUE_BEFORE + BEAD_EPILOGUE_RED + BEAD_EPILOGUE_AFTER
    : item.description;

  const beadSegments: TextSegment[] | undefined = useMemo(() => {
    if (!isBead) return undefined;
    return [
      { text: item.description + '\n\n' + BEAD_EPILOGUE_BEFORE },
      { text: BEAD_EPILOGUE_RED, className: styles.beadHighlight },
      { text: BEAD_EPILOGUE_AFTER },
    ];
  }, [isBead, item.description]);

  const beadStaticContent: ReactNode = isBead ? (
    <>
      <div>{item.description}</div>
      <div className={styles.beadEpilogue}>
        {BEAD_EPILOGUE_BEFORE}
        <span className={styles.beadHighlight}>{BEAD_EPILOGUE_RED}</span>
        {BEAD_EPILOGUE_AFTER}
      </div>
    </>
  ) : null;

  const [descDone, setDescDone] = useState(skipStream);
  const [remnantDone, setRemnantDone] = useState(false);

  const directClues = useMemo(
    () => discoveredClues.filter((c) => c.type !== 'bead_memory'),
    [discoveredClues],
  );
  const beadClues = useMemo(
    () => discoveredClues.filter((c) => c.type === 'bead_memory'),
    [discoveredClues],
  );

  return (
    <TextPanel
      className={styles.panel}
      embedded
      topContent={
        <div>
          {skipStream ? (
            isBead ? beadStaticContent : item.description
          ) : (
            <StreamText
              text={isBead ? fullDesc : item.description}
              segments={beadSegments}
              speed={25}
              onComplete={() => setDescDone(true)}
            />
          )}
          {hasRemnant && (
            <RemnantText
              text={item.beadText!}
              skipStream={!isNewReveal}
              onComplete={() => setRemnantDone(true)}
            />
          )}
        </div>
      }
      bottomContent={
        <div className={styles.bottom}>
          {descDone &&
            directClues.map((clue) => (
              <div key={clue.clueId} className={styles.clueDiscovery}>
                <span className={styles.clueLabel}>发现线索</span>
                <span className={styles.clueSummary}>{clue.summary}</span>
              </div>
            ))}
          {descDone &&
            remnantDone &&
            beadClues.map((clue) => (
              <div key={clue.clueId} className={styles.clueDiscovery}>
                <span className={styles.clueLabel}>发现线索</span>
                <span className={styles.clueSummary}>{clue.summary}</span>
              </div>
            ))}
          <div
            className={styles.option}
            onClick={onReturn}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onReturn();
            }}
          >
            {returnText}
          </div>
        </div>
      }
      showDivider
    />
  );
}
