import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const startedAt = useGameStore((s) => s.startedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const seconds = getPlaytimeSeconds(startedAt, now);
  // Mapeia as chaves de unidade do JSON pros sufixos visíveis.
  const unitLabels = {
    s: t('playtime.units.seconds'),
    m: t('playtime.units.minutes'),
    h: t('playtime.units.hours'),
    d: t('playtime.units.days'),
    w: t('playtime.units.weeks'),
    mo: t('playtime.units.months'),
    y: t('playtime.units.years'),
    dec: t('playtime.units.decades'),
    c: t('playtime.units.centuries'),
    mil: t('playtime.units.millennia'),
  } as const;
  const label = formatPlaytime(seconds, { unitLabels, zero: t('playtime.zero') });

  return (
    <aside className="playtime-panel" aria-label={t('playtime.ariaLabel')}>
      <div className="playtime-panel__top">
        <div className="playtime-panel__label">{t('playtime.label')}</div>
        <div className="playtime-panel__value">{label}</div>
      </div>
    </aside>
  );
}
