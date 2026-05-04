import { useEffect, useState } from 'react';
import { useGameStore } from '../game/store';
import { formatPlaytime, getPlaytimeSeconds } from '../utils/playtime';

/**
 * Painel fixo no canto superior direito da viewport, espelhando a sidebar.
 * Mostra o tempo total de jogo (wall clock — inclui offline) atualizado a 1Hz.
 *
 * Não depende do `tick` do store: como o tempo passa em wall clock e não
 * só em frames simulados, mantemos um setInterval próprio de 1s — assim a UI
 * continua atualizando mesmo se a aba estiver em background throttling.
 *
 * O `startedAt` é lido por subscription no store pra que um reset (que troca
 * o timestamp pra `Date.now()`) reflita imediatamente.
 */
export function PlaytimePanel() {
  const startedAt = useGameStore((s) => s.startedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const seconds = getPlaytimeSeconds(startedAt, now);
  const label = formatPlaytime(seconds);

  return (
    <aside className="playtime-panel" aria-label="Tempo de jogo">
      <div className="playtime-panel__top">
        <div className="playtime-panel__label">Tempo de jogo</div>
        <div className="playtime-panel__value">{label}</div>
      </div>
    </aside>
  );
}
