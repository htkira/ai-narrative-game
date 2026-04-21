import { useMemo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getContentProvider } from '@/content/contentFactory';
import { GameStage } from '@/components/stage';
import {
  LeftSlot,
  CenterSlot,
  RightSlot,
  ProgressSlot,
  BeadSkillSlot,
} from '@/components/stage/slots';
import { ZoneSelector } from './ZoneSelector';
import { ItemGrid } from './ItemGrid';
import { ItemDetail } from './ItemDetail';
import { BeadDiscovery, BeadSkillIcon } from './bead';
import styles from './ExplorationScreen.module.css';

// Debate unlocks only after ALL clues are collected

export function ExplorationScreen() {
  const scene = useGameStore((s) => s.scene);
  const zones = useGameStore((s) => s.zones);
  const items = useGameStore((s) => s.items);
  const selectedZoneId = useGameStore((s) => s.selectedZoneId);
  const selectedItemId = useGameStore((s) => s.selectedItemId);
  const clues = useGameStore((s) => s.clues);
  const bead = useGameStore((s) => s.bead);
  const selectZone = useGameStore((s) => s.selectZone);
  const selectItem = useGameStore((s) => s.selectItem);
  const returnToZoneList = useGameStore((s) => s.returnToZoneList);
  const triggerDebate = useGameStore((s) => s.triggerDebate);

  const provider = useMemo(() => getContentProvider(), []);

  const inventoryItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.isDiscovered &&
          i.isEvidence &&
          (i.hasClue || i.beadReactive) &&
          (!i.beadReactive || i.isBeadUnlocked),
      ),
    [items],
  );

  const selectedItem = useMemo(
    () =>
      selectedItemId
        ? items.find((i) => i.itemId === selectedItemId) ?? null
        : null,
    [items, selectedItemId],
  );

  const selectedZone = useMemo(
    () =>
      selectedZoneId
        ? zones.find((z) => z.zoneId === selectedZoneId) ?? null
        : null,
    [zones, selectedZoneId],
  );

  const zoneItems = useMemo(
    () =>
      selectedZoneId
        ? items.filter((i) => i.zoneId === selectedZoneId)
        : [],
    [items, selectedZoneId],
  );

  const canTriggerDebate = clues.total > 0 && clues.foundCount >= clues.total;

  const handleTriggerDebate = useCallback(() => {
    triggerDebate(provider.getDebateInitData());
  }, [provider, triggerDebate]);

  const handleReturnFromDetail = useCallback(() => {
    const { items: cur, selectedZoneId: zId, bead: b } = useGameStore.getState();
    const hasUnexamined = zId != null && cur.some(
      (i) => i.zoneId === zId && !i.isExamined,
    );

    if (hasUnexamined) {
      useGameStore.setState({
        selectedItemId: null,
        bead: b.found ? { ...b, active: false } : b,
      });
    } else {
      returnToZoneList();
    }
  }, [returnToZoneList]);

  const [hoveredInvItemId, setHoveredInvItemId] = useState<string | null>(null);
  const [tooltipY, setTooltipY] = useState(0);

  const hoveredInvClues = useMemo(() => {
    if (!hoveredInvItemId) return [];
    return clues.records.filter((c) => c.sourceItemId === hoveredInvItemId);
  }, [hoveredInvItemId, clues.records]);

  const hoveredInvItem = useMemo(() => {
    if (!hoveredInvItemId) return null;
    return inventoryItems.find((i) => i.itemId === hoveredInvItemId) ?? null;
  }, [hoveredInvItemId, inventoryItems]);

  const handleInvHover = useCallback((itemId: string, e: React.MouseEvent) => {
    setHoveredInvItemId(itemId);
    const el = e.currentTarget as HTMLElement;
    const canvas = el.closest('[data-canvas]') as HTMLElement | null;
    if (canvas) {
      const canvasRect = canvas.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scale = canvasRect.width / 1920;
      setTooltipY((elRect.top - canvasRect.top) / scale);
    }
  }, []);

  const [showBeadDiscovery, setShowBeadDiscovery] = useState(false);
  const prevBeadFoundRef = useRef(bead.found);

  if (bead.found && !prevBeadFoundRef.current) {
    prevBeadFoundRef.current = true;
    setShowBeadDiscovery(true);
  }

  const seenSceneDescRef = useRef(false);
  const seenZoneIdsRef = useRef(new Set<string>());
  const seenItemIdsRef = useRef(new Set<string>());

  const skipSceneStream = seenSceneDescRef.current;
  const skipZoneStream = selectedZoneId != null && seenZoneIdsRef.current.has(selectedZoneId);
  const skipItemStream = selectedItemId != null && seenItemIdsRef.current.has(selectedItemId);

  useEffect(() => {
    if (!selectedZoneId && !selectedItemId) {
      seenSceneDescRef.current = true;
    }
  }, [selectedZoneId, selectedItemId]);

  useEffect(() => {
    if (selectedZoneId && !selectedItemId) {
      seenZoneIdsRef.current.add(selectedZoneId);
    }
  }, [selectedZoneId, selectedItemId]);

  useEffect(() => {
    if (selectedItemId) {
      seenItemIdsRef.current.add(selectedItemId);
    }
  }, [selectedItemId]);

  const discoveredCluesForItem = useMemo(
    () =>
      selectedItem
        ? clues.records.filter((c) => c.sourceItemId === selectedItem.itemId)
        : [],
    [clues.records, selectedItem],
  );

  let centerContent: ReactNode;

  const hasUnexaminedInZone = selectedZoneId != null && items.some(
    (i) => i.zoneId === selectedZoneId && !i.isExamined,
  );

  if (showBeadDiscovery && selectedItem?.itemId === bead.itemId) {
    centerContent = (
      <BeadDiscovery
        onAccept={() => {
          setShowBeadDiscovery(false);
          handleReturnFromDetail();
        }}
      />
    );
  } else if (selectedItem) {
    centerContent = (
      <ItemDetail
        key={selectedItem.itemId}
        item={selectedItem}
        discoveredClues={discoveredCluesForItem}
        onReturn={handleReturnFromDetail}
        returnText={hasUnexaminedInZone ? '继续调查此处' : '返回调查其他地方'}
        skipStream={skipItemStream}
      />
    );
  } else if (selectedZone) {
    centerContent = (
      <ItemGrid
        zone={selectedZone}
        items={zoneItems}
        onItemClick={selectItem}
        onReturn={returnToZoneList}
        skipStream={skipZoneStream}
        beadFound={bead.found}
      />
    );
  } else {
    centerContent = (
      <ZoneSelector
        description={scene?.description ?? ''}
        zones={zones}
        onZoneSelect={selectZone}
        canTriggerDebate={canTriggerDebate}
        onTriggerDebate={handleTriggerDebate}
        skipStream={skipSceneStream}
      />
    );
  }

  return (
    <GameStage backgroundColor={scene?.backgroundColor}>
      <LeftSlot>
        {scene && (
          <img
            src={scene.imageUrl}
            alt={scene.imageAlt}
            className={styles.sceneImage}
          />
        )}
      </LeftSlot>

      <CenterSlot>{centerContent}</CenterSlot>

      <RightSlot>
        <div className={styles.inventory}>
          {inventoryItems.map((item) => (
            <div
              key={item.itemId}
              className={styles.invItem}
              onMouseEnter={(e) => handleInvHover(item.itemId, e)}
              onMouseLeave={() => setHoveredInvItemId(null)}
            >
              {item.iconUrl && (
                <img
                  src={item.iconUrl}
                  alt={item.name}
                  className={styles.invIcon}
                />
              )}
            </div>
          ))}
        </div>
      </RightSlot>

      {hoveredInvItemId && hoveredInvClues.length > 0 && hoveredInvItem && (() => {
        const availableBelow = 1060 - tooltipY;
        const flipUp = availableBelow < 160;
        const pos: React.CSSProperties = flipUp
          ? { bottom: 1080 - tooltipY, maxHeight: Math.min(400, tooltipY) }
          : { top: tooltipY, maxHeight: Math.min(400, availableBelow) };
        return (
          <div className={styles.invTooltip} style={pos}>
            <div className={styles.tooltipName}>{hoveredInvItem.name}</div>
            {hoveredInvClues.map((clue) => (
              <div key={clue.clueId} className={styles.tooltipClue}>
                {clue.title}：{clue.summary}
              </div>
            ))}
          </div>
        );
      })()}

      <ProgressSlot>
        <span>已收集线索&emsp;{clues.foundCount}/{clues.total}</span>
      </ProgressSlot>

      {bead.visible && (
        <BeadSkillSlot>
          <BeadSkillIcon />
        </BeadSkillSlot>
      )}
    </GameStage>
  );
}
