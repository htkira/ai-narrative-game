import { type ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import styles from './GameStage.module.css';

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;
const STAGE_SHRINK = 0.92;

interface GameStageProps {
  children: ReactNode;
  className?: string;
  backgroundColor?: string;
}

export function GameStage({ children, className, backgroundColor }: GameStageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    if (!viewportRef.current) return;
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    setScale(Math.min(vw / DESIGN_WIDTH, vh / DESIGN_HEIGHT) * STAGE_SHRINK);
  }, []);

  useEffect(() => {
    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [updateScale]);

  return (
    <div ref={viewportRef} className={`${styles.viewport} ${className ?? ''}`}>
      <div
        className={styles.scaler}
        style={{
          width: DESIGN_WIDTH * scale,
          height: DESIGN_HEIGHT * scale,
        }}
      >
        <div
          className={styles.canvas}
          style={{
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            transform: `scale(${scale})`,
            ...(backgroundColor ? { backgroundColor } : {}),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
