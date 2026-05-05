import { useTranslation } from 'react-i18next';
import { useGameStore } from '../game/store';
import { formatNum } from '../utils/format';

/**
 * Chip compacto de Pontos de Melhoria.
 *
 * Renderizado dentro do `.resource-block` ao lado do Recurso Base, mas com
 * peso visual menor (cor + tamanho) — PM é um recurso secundário, gasto
 * exclusivamente em melhorias. O chip é só LEITURA; o jogador interage
 * com PM no modal de Melhorias.
 *
 * Subscreve `tick` pra re-renderizar na cadência do game loop, igual ao
 * `ResourceDisplay`. PM raramente muda fora de cliques, mas a leitura
 * direta `useGameStore.getState()` evita criar uma `subscribe` separada.
 */
export function UpgradePointsDisplay() {
  const { t, i18n } = useTranslation();
  useGameStore((s) => s.tick);
  const points = useGameStore.getState().upgradePoints;

  return (
    <div
      className="upgrade-points-chip"
      role="status"
      aria-label={t('upgradePoints.ariaLabel')}
    >
      <span className="upgrade-points-chip__label">{t('upgradePoints.label')}</span>
      <span className="upgrade-points-chip__value">{formatNum(points, i18n.language)}</span>
    </div>
  );
}
