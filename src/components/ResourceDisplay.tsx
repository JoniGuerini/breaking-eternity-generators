import { useGameStore, getResourceRate } from '../game/store';
import { formatNum } from '../utils/format';

export function ResourceDisplay() {
  // Subscreve a `tick` pra re-renderizar na cadência do game loop.
  useGameStore((s) => s.tick);
  const resource = useGameStore.getState().resource;
  const rate = getResourceRate();

  return (
    <div className="resource-block">
      <span className="resource-label">Recurso Base</span>
      <span className="resource-value">{formatNum(resource)}</span>
      <span className="resource-rate">+{formatNum(rate)} /s</span>
    </div>
  );
}
