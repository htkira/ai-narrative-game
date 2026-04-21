import { TextPanel } from './TextPanel';
import { StreamText } from './StreamText';
import styles from './DialogBox.module.css';

export interface DialogOption {
  id: string;
  text: string;
}

interface DialogBoxProps {
  /** NPC / narrator text — displayed with typewriter effect in top area */
  topText: string;
  /** Player-clickable text options shown instantly below the divider */
  options: DialogOption[];
  /** Fires when the player clicks an option */
  onOptionClick: (optionId: string) => void;
  /** Typewriter speed in ms per character (default 25) */
  speed?: number;
  /** When true, show top text instantly without typewriter */
  skipStream?: boolean;
  /** Fires when the typewriter finishes */
  onStreamComplete?: () => void;
  /** When true, skip background (parent slot provides it) */
  embedded?: boolean;
  className?: string;
}

/**
 * Fixed dual-zone dialog box — visual-novel style.
 *
 * Top area: NPC / narrator text with typewriter effect.
 * Divider: floats right after the full top-text height (fixed per turn).
 * Bottom area: player options displayed instantly, clickable to advance.
 */
export function DialogBox({
  topText,
  options,
  onOptionClick,
  speed = 25,
  skipStream,
  onStreamComplete,
  embedded,
  className,
}: DialogBoxProps) {
  return (
    <TextPanel
      className={`${styles.panel} ${className ?? ''}`}
      embedded={embedded}
      topContent={
        <div className={styles.topWrapper}>
          <span className={styles.topSpacer} aria-hidden>
            {topText}
          </span>
          {skipStream ? (
            <span className={styles.topStream}>{topText}</span>
          ) : (
            <StreamText
              text={topText}
              speed={speed}
              onComplete={onStreamComplete}
              className={styles.topStream}
            />
          )}
        </div>
      }
      bottomContent={
        <div className={styles.options}>
          {options.map((opt) => (
            <div
              key={opt.id}
              className={styles.option}
              onClick={() => onOptionClick(opt.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onOptionClick(opt.id);
              }}
            >
              {opt.text}
            </div>
          ))}
        </div>
      }
      showDivider
    />
  );
}
