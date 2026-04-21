import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import styles from './StreamText.module.css';

export interface TextSegment {
  text: string;
  className?: string;
}

interface StreamTextProps {
  text: string;
  segments?: TextSegment[];
  /** Milliseconds per character */
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function StreamText({
  text,
  segments,
  speed = 40,
  onComplete,
  className,
}: StreamTextProps) {
  const totalLength = useMemo(
    () => segments ? segments.reduce((sum, s) => sum + s.text.length, 0) : text.length,
    [segments, text],
  );

  const [displayCount, setDisplayCount] = useState(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setDisplayCount(0);
    completedRef.current = false;
  }, [text, segments]);

  useEffect(() => {
    if (displayCount >= totalLength) {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
      return;
    }

    const timer = setTimeout(() => {
      setDisplayCount((prev) => prev + 1);
    }, speed);

    return () => clearTimeout(timer);
  }, [displayCount, totalLength, speed]);

  const skipToEnd = useCallback(() => {
    if (displayCount < totalLength) {
      setDisplayCount(totalLength);
    }
  }, [displayCount, totalLength]);

  const isComplete = displayCount >= totalLength;

  const rendered: ReactNode = useMemo(() => {
    if (!segments) return text.slice(0, displayCount);
    const nodes: ReactNode[] = [];
    let remaining = displayCount;
    for (let i = 0; i < segments.length && remaining > 0; i++) {
      const seg = segments[i]!;
      const slice = seg.text.slice(0, remaining);
      remaining -= slice.length;
      nodes.push(
        seg.className
          ? <span key={i} className={seg.className}>{slice}</span>
          : <span key={i}>{slice}</span>,
      );
    }
    return nodes;
  }, [segments, text, displayCount]);

  return (
    <span
      className={`${styles.root} ${className ?? ''}`}
      onClick={skipToEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') skipToEnd();
      }}
    >
      {rendered}
      {!isComplete && <span className={styles.cursor}>|</span>}
    </span>
  );
}
