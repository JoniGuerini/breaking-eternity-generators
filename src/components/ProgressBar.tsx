interface ProgressBarProps {
  /** Razão entre 0 e 1 (clampado). */
  ratio: number;
}

export function ProgressBar({ ratio }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div className="gen-pending-bar">
      <div className="gen-pending-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
