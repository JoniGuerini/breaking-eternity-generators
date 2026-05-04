import { getBuyCost } from '../game/config';
import { useGameStore } from '../game/store';
import { formatInt, formatNum } from '../utils/format';
import { toRoman } from '../utils/roman';
import { ProgressBar } from './ProgressBar';

interface GeneratorCardProps {
  generatorId: number;
}

export function GeneratorCard({ generatorId }: GeneratorCardProps) {
  // Subscreve tick. O gerador em si é mutado in-place no store — buscamos
  // a referência atual a cada render, garantindo dado fresco.
  useGameStore((s) => s.tick);
  const state = useGameStore.getState();
  const gen = state.generators[generatorId - 1];
  if (!gen) return null;

  if (!gen.unlocked) {
    return (
      <div className="generator locked">
        <div className="gen-info">
          <div className="gen-name">Gerador {gen.id}</div>
        </div>
        <div className="gen-action">
          <LockedIndicator
            unlockThreshold={formatNum(gen.unlockThreshold)}
            ratio={state.resource.div(gen.unlockThreshold).toNumber()}
          />
        </div>
      </div>
    );
  }

  return <UnlockedCard generatorId={gen.id} />;
}

function UnlockedCard({ generatorId }: { generatorId: number }) {
  const state = useGameStore.getState();
  const gen = state.generators[generatorId - 1];
  if (!gen) return null;

  const cost = getBuyCost(gen);
  const affordable = state.resource.gte(cost);
  const buy = useGameStore((s) => s.buy);
  const target = gen.id === 1 ? 'Recurso Base' : `Gerador ${gen.id - 1}`;
  const totalRate = gen.count.mul(gen.productionRate);
  const hasCount = gen.count.gt(0);

  return (
    <div className={`generator${hasCount ? ' has-count' : ''}`}>
      <div className="gen-card">
        <div className="gen-card__head">
          <div className="gen-name">Gerador {gen.id}</div>
          {/* Bloco da quantidade: VALOR em cima, label embaixo.
              `--reversed` usa column-reverse, então o ÚLTIMO filho do DOM
              fica no topo visualmente. Por isso a label vem antes no JSX. */}
          <div className="gen-card__stack gen-card__stack--reversed gen-card__stack--right">
            <span className="label">Possuídos</span>
            <span className="value">{formatInt(gen.count)}</span>
          </div>
        </div>

        <hr className="gen-card__sep" />

        <div className="gen-card__metrics">
          {/* Esquerda: PRODUZ em cima, taxa total · target embaixo */}
          <div className="gen-card__stack">
            <span className="label">Produz</span>
            <span className="value">
              {formatNum(totalRate)}/s <span className="target">· {target}</span>
            </span>
          </div>
          {/* Direita: TIER em cima, numeral romano embaixo */}
          <div className="gen-card__stack gen-card__stack--right">
            <span className="label">Tier</span>
            <span className="value">{toRoman(gen.id)}</span>
          </div>
        </div>

        <hr className="gen-card__sep" />

        <button
          type="button"
          className="btn btn--primary gen-card__action"
          disabled={!affordable}
          onClick={() => buy(generatorId)}
        >
          <span>{affordable ? 'Comprar' : 'Recurso insuficiente'}</span>
          <span className={`gen-cost${affordable ? ' affordable' : ''}`}>
            {formatNum(cost)}
          </span>
        </button>
      </div>
    </div>
  );
}

interface LockedIndicatorProps {
  unlockThreshold: string;
  ratio: number;
}

function LockedIndicator({ unlockThreshold, ratio }: LockedIndicatorProps) {
  return (
    <div className="gen-pending">
      <span className="gen-pending-label">Desbloqueia com</span>
      <span className="gen-pending-value">{unlockThreshold}</span>
      <ProgressBar ratio={ratio} />
    </div>
  );
}
