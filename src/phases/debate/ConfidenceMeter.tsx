interface ConfidenceMeterProps {
  total: number;
  refuted: number;
}

export function ConfidenceMeter({ total, refuted }: ConfidenceMeterProps) {
  const remaining = total - refuted;
  return (
    <span>信心&emsp;{remaining}/{total}</span>
  );
}
