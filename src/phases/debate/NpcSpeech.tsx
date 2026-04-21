import { StreamText } from '@/components/shared';
import type { NPC, AttitudeStage } from '@/types/game';
import styles from './NpcSpeech.module.css';

const ATTITUDE_LABELS: Record<AttitudeStage, string> = {
  assertive: '强硬',
  defensive: '防御',
  shaken: '动摇',
  retreating: '退缩',
  confessing: '坦白',
};

function attitudeClass(stage: AttitudeStage): string {
  switch (stage) {
    case 'assertive': return styles.assertive ?? '';
    case 'defensive': return styles.defensive ?? '';
    case 'shaken': return styles.shaken ?? '';
    case 'retreating': return styles.retreating ?? '';
    case 'confessing': return styles.confessing ?? '';
    default: return '';
  }
}

interface NpcSpeechProps {
  npc: NPC;
  onStreamComplete?: () => void;
}

export function NpcSpeech({ npc, onStreamComplete }: NpcSpeechProps) {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.name}>{npc.name}</span>
        <span className={`${styles.attitude} ${attitudeClass(npc.attitudeStage)}`}>
          {ATTITUDE_LABELS[npc.attitudeStage] ?? npc.attitudeStage}
        </span>
      </div>
      <StreamText
        text={npc.currentSpeech}
        speed={25}
        onComplete={onStreamComplete}
      />
    </div>
  );
}
