import { type ReactNode } from 'react';
import { LeftSlot } from './slots/LeftSlot';
import { CenterSlot } from './slots/CenterSlot';
import { RightSlot } from './slots/RightSlot';
import { ProgressSlot } from './slots/ProgressSlot';
import { BeadSkillSlot } from './slots/BeadSkillSlot';

interface StageLayoutProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  rightVariant?: 'inventory' | 'pre-inventory';
  progress?: ReactNode;
  beadSkill?: ReactNode;
}

export function StageLayout({
  left,
  center,
  right,
  rightVariant = 'inventory',
  progress,
  beadSkill,
}: StageLayoutProps) {
  return (
    <>
      <LeftSlot>{left}</LeftSlot>
      <CenterSlot>{center}</CenterSlot>
      <RightSlot variant={rightVariant}>{right}</RightSlot>
      {progress !== undefined && <ProgressSlot>{progress}</ProgressSlot>}
      {beadSkill !== undefined && <BeadSkillSlot>{beadSkill}</BeadSkillSlot>}
    </>
  );
}
