import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type Decimal from 'break_eternity.js';
import { getEffectiveProductionRate, useGameStore } from '../game/store';
import { useHoldToRepeat } from '../hooks/useHoldToRepeat';
import { formatInt, formatNum } from '../utils/format';
import { toRoman } from '../utils/roman';
import { ProgressBar } from './ProgressBar';

/*
 * Estratégia de re-render:
 *
 * O store muta Decimals in-place a 60Hz e dispara `notify()` (~15Hz). Sem
 * memoização, todos os cards re-renderizam 15Hz independentemente, o que
 * fica caro com muitos geradores na lista.
 *
 * Pra otimizar, separamos em dois componentes envoltos em React.memo:
 *   - UnlockedCard: re-renderiza só quando count, purchases, ou affordable
 *     mudam. Em estado estável (lista cheia, comprando ocasionalmente)
 *     o card praticamente não atualiza.
 *   - LockedCard: re-renderiza quando o ratio quantizado muda (1% steps)
 *     ou quando o gerador finalmente desbloqueia.
 *
 * As props são primitivos (number, string, boolean) — comparação default
 * do React.memo (Object.is) é suficiente, sem precisar de comparador custom.
 *
 * O componente externo `GeneratorCard` faz a derivação dessas props a partir
 * do store. Ele segue dependendo de `tick` pra ser invocado, mas só os
 * inner components passam pra DOM/diff quando algo realmente mudou.
 */

interface GeneratorCardProps {
  generatorId: number;
}

export function GeneratorCard({ generatorId }: GeneratorCardProps) {
  const { i18n } = useTranslation();
  // Subscreve tick. O gerador em si é mutado in-place no store — buscamos
  // a referência atual a cada render, garantindo dado fresco.
  useGameStore((s) => s.tick);
  const state = useGameStore.getState();
  const gen = state.generators[generatorId - 1];
  if (!gen) return null;

  if (!gen.unlocked) {
    // Quantiza o ratio em 100 passos (steps de 1%): repaints da barra
    // ficam visualmente suaves sem disparar re-render todo tick.
    const ratio = state.resource.div(gen.unlockThreshold).toNumber();
    const ratioStep = Math.min(100, Math.floor(ratio * 100));
    return (
      <LockedCard
        generatorId={gen.id}
        unlockThresholdLabel={formatNum(gen.unlockThreshold, i18n.language)}
        ratioStep={ratioStep}
      />
    );
  }

  const cost = computeCost(gen.baseCost, gen.costMultiplier, gen.purchases);
  const affordable = state.resource.gte(cost);
  // Taxa total considerando upgrades — sem isso, comprar uma melhoria
  // dobra a produção REAL no loop, mas a UI continua mostrando o rate
  // base, dando a impressão de que a melhoria não fez nada.
  const effectiveRate = getEffectiveProductionRate(gen, state.upgrades);
  const totalRate = gen.count.mul(effectiveRate);

  return (
    <UnlockedCard
      generatorId={gen.id}
      countLabel={formatInt(gen.count, i18n.language)}
      hasCount={gen.count.gt(0)}
      totalRateLabel={formatNum(totalRate, i18n.language)}
      costLabel={formatNum(cost, i18n.language)}
      affordable={affordable}
    />
  );
}

/** Helper local pra evitar importar getBuyCost (cada call alocaria Decimals). */
function computeCost(baseCost: Decimal, multiplier: Decimal, purchases: number): Decimal {
  return baseCost.mul(multiplier.pow(purchases));
}

/* ---------- UnlockedCard ---------- */

interface UnlockedCardProps {
  generatorId: number;
  countLabel: string;
  hasCount: boolean;
  totalRateLabel: string;
  costLabel: string;
  affordable: boolean;
}

const UnlockedCard = memo(function UnlockedCard({
  generatorId,
  countLabel,
  hasCount,
  totalRateLabel,
  costLabel,
  affordable,
}: UnlockedCardProps) {
  const { t } = useTranslation();
  const buy = useGameStore((s) => s.buy);
  const target =
    generatorId === 1
      ? t('resource.label')
      : t('generator.name', { id: generatorId - 1 });

  // Press-and-hold = compra em série. A própria store falha silenciosamente
  // se o jogador ficar sem recurso no meio do hold — o loop continua e
  // retoma quando voltar a poder pagar.
  const onAction = useCallback(() => buy(generatorId), [buy, generatorId]);
  const { handlers } = useHoldToRepeat({ onAction });

  return (
    <div className={`generator${hasCount ? ' has-count' : ''}`}>
      <div className="gen-card">
        <div className="gen-card__head">
          <div className="gen-name">{t('generator.name', { id: generatorId })}</div>
          {/* Bloco da quantidade: VALOR em cima, label embaixo.
              `--reversed` usa column-reverse, então o ÚLTIMO filho do DOM
              fica no topo visualmente. Por isso a label vem antes no JSX. */}
          <div className="gen-card__stack gen-card__stack--reversed gen-card__stack--right">
            <span className="label">{t('generator.owned')}</span>
            <span className="value">{countLabel}</span>
          </div>
        </div>

        <hr className="gen-card__sep" />

        <div className="gen-card__metrics">
          {/* Esquerda: PRODUZ em cima, taxa total · target embaixo */}
          <div className="gen-card__stack">
            <span className="label">{t('generator.produces')}</span>
            <span className="value">
              {totalRateLabel}
              {t('resource.rateSuffix')}{' '}
              <span className="target">· {target}</span>
            </span>
          </div>
          {/* Direita: TIER em cima, numeral romano embaixo */}
          <div className="gen-card__stack gen-card__stack--right">
            <span className="label">{t('generator.tier')}</span>
            <span className="value">{toRoman(generatorId)}</span>
          </div>
        </div>

        <hr className="gen-card__sep" />

        {/*
         * Botão sem `onClick` — `useHoldToRepeat` cobre o caso do clique
         * curto via mousedown→mouseup. Adicionar onClick também causaria
         * compra dupla (touch dispara click sintético no fim).
         */}
        <button
          type="button"
          className="btn btn--primary gen-card__action"
          disabled={!affordable}
          {...handlers}
        >
          <span>{affordable ? t('actions.buy') : t('actions.insufficientResource')}</span>
          <span className={`gen-cost${affordable ? ' affordable' : ''}`}>{costLabel}</span>
        </button>
      </div>
    </div>
  );
});

/* ---------- LockedCard ---------- */

interface LockedCardProps {
  generatorId: number;
  unlockThresholdLabel: string;
  /** Ratio quantizado em [0, 100] — steps de 1%. */
  ratioStep: number;
}

const LockedCard = memo(function LockedCard({
  generatorId,
  unlockThresholdLabel,
  ratioStep,
}: LockedCardProps) {
  const { t } = useTranslation();
  return (
    <div className="generator locked">
      <div className="gen-info">
        <div className="gen-name">{t('generator.name', { id: generatorId })}</div>
      </div>
      <div className="gen-action">
        <div className="gen-pending">
          <span className="gen-pending-label">{t('generator.unlocksWith')}</span>
          <span className="gen-pending-value">{unlockThresholdLabel}</span>
          <ProgressBar ratio={ratioStep / 100} />
        </div>
      </div>
    </div>
  );
});
