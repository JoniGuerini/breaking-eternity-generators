import { memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../game/store';
import { getDirectedUpgradeCost } from '../game/upgrades';
import { useHoldToRepeat } from '../hooks/useHoldToRepeat';
import { formatNum } from '../utils/format';

interface UpgradesModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal "quase tela cheia" que lista as melhorias disponíveis.
 *
 * Decisões de design:
 *  - Apenas a classe DIRECTED existe hoje — uma melhoria por gerador
 *    desbloqueado, custo cresce ×3 a cada nível e cada nível DOBRA o
 *    rate. A simplicidade é proposital: prefere expandir depois.
 *  - Fora da hierarquia natural da página (que vive em `<main>`) — é
 *    uma overlay com seu próprio backdrop. Mesmo padrão do ResetModal/
 *    ThemeSelectorModal pra que ESC e clique no backdrop fechem.
 *  - A grade é generosa: cards mais largos e com mais respiro vertical
 *    do que os antigos do painel embutido. Como o dialog ocupa quase
 *    toda a viewport (10px de padding no backdrop), há espaço.
 */
export function UpgradesModal({ open, onClose }: UpgradesModalProps) {
  const { t, i18n } = useTranslation();

  // Subscreve tick pra refletir custos/affordabilidade em tempo real
  // enquanto o modal está aberto. Quando fechado, retornamos cedo
  // antes de qualquer trabalho.
  useGameStore((s) => s.tick);
  const state = useGameStore.getState();
  const { generators, resource, upgrades } = state;
  const unlockedGens = generators.filter((g) => g.unlocked);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="modal-backdrop modal-backdrop--upgrades"
      onClick={handleBackdropClick}
    >
      <div
        className="modal modal--upgrades"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrades-modal-title"
      >
        <header className="upgrades-modal__head">
          <div>
            <h2 className="modal-title" id="upgrades-modal-title">
              {t('upgrades.modalTitle')}
            </h2>
            <p className="upgrades-modal__subtitle">
              {t('upgrades.modalBody')}
            </p>
          </div>
          <button
            type="button"
            className="upgrades-modal__close"
            onClick={onClose}
            aria-label={t('upgrades.closeAriaLabel')}
          >
            ×
          </button>
        </header>

        <div className="upgrades-modal__content">
          {unlockedGens.length === 0 ? (
            <p className="upgrades-modal__empty">{t('upgrades.empty')}</p>
          ) : (
            <div className="upgrades-grid">
              {unlockedGens.map((gen) => {
                const level = upgrades.directedLevels[gen.id] ?? 0;
                const cost = getDirectedUpgradeCost(gen.id, level);
                const affordable = resource.gte(cost);
                return (
                  <DirectedUpgradeCard
                    key={gen.id}
                    generatorId={gen.id}
                    level={level}
                    costLabel={formatNum(cost, i18n.language)}
                    affordable={affordable}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DirectedUpgradeCardProps {
  generatorId: number;
  level: number;
  costLabel: string;
  affordable: boolean;
}

/**
 * Card individual de boost direcionado.
 *
 * Memoizado por props primitivas (mesma estratégia do GeneratorCard) pra
 * que mover o slider de tempo/scroll/qualquer mudança no estado raiz não
 * re-renderize cards inalterados. Em telas com muitos Gens isso importa.
 */
const DirectedUpgradeCard = memo(function DirectedUpgradeCard({
  generatorId,
  level,
  costLabel,
  affordable,
}: DirectedUpgradeCardProps) {
  const { t } = useTranslation();
  const buy = useGameStore((s) => s.buyDirectedUpgrade);
  const genName = t('generator.name', { id: generatorId });

  // Mesma estratégia do GeneratorCard: hold = compra em série.
  // Como cada nível triplica o custo, segurar dispara só os níveis que
  // o jogador consegue pagar — depois fica em "no-op silencioso" até
  // soltar.
  const onAction = useCallback(() => buy(generatorId), [buy, generatorId]);
  const { handlers } = useHoldToRepeat({ onAction });

  return (
    <div className="upgrade-card">
      <div className="upgrade-card__head">
        <span className="upgrade-card__title">
          {t('upgrades.directed.title', { gen: genName })}
        </span>
        <span className="upgrade-card__level">
          {t('upgrades.directed.level', { level })}
        </span>
      </div>
      <p className="upgrade-card__effect">
        {t('upgrades.directed.effect')}
      </p>
      <button
        type="button"
        className="btn btn--primary upgrade-card__action"
        disabled={!affordable}
        {...handlers}
      >
        <span>
          {affordable ? t('actions.buy') : t('actions.insufficientResource')}
        </span>
        <span className="upgrade-card__cost">{costLabel}</span>
      </button>
    </div>
  );
});
