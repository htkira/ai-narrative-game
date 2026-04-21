import { useCallback } from 'react';
import { DialogBox } from '@/components/shared';
import type { Zone } from '@/types/game';

interface ZoneSelectorProps {
  description: string;
  zones: Zone[];
  onZoneSelect: (zoneId: string) => void;
  canTriggerDebate: boolean;
  onTriggerDebate: () => void;
  skipStream?: boolean;
}

const DEBATE_OPTION_ID = '__trigger_debate__';

export function ZoneSelector({
  description,
  zones,
  onZoneSelect,
  canTriggerDebate,
  onTriggerDebate,
  skipStream,
}: ZoneSelectorProps) {
  const options = [
    ...zones
      .filter((z) => z.unlocked)
      .map((z) => ({ id: z.zoneId, text: z.name })),
    ...(canTriggerDebate
      ? [{ id: DEBATE_OPTION_ID, text: '门口突然有人闯了进来' }]
      : []),
  ];

  const handleOptionClick = useCallback(
    (optionId: string) => {
      if (optionId === DEBATE_OPTION_ID) {
        onTriggerDebate();
      } else {
        onZoneSelect(optionId);
      }
    },
    [onZoneSelect, onTriggerDebate],
  );

  return (
    <DialogBox
      key="zone-selector"
      topText={description}
      options={options}
      onOptionClick={handleOptionClick}
      skipStream={skipStream}
      embedded
    />
  );
}
