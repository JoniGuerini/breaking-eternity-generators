import Decimal from 'break_eternity.js';
import { create } from 'zustand';
import { D, DT_CAP, createGenerator, getBuyCost } from './config';
import { clearSave, load, makeFreshState, persist } from './persistence';
import type { GameState, Generator } from './types';

/**
 * Estratégia de estado:
 *  - `resource` e `generators` são tratados como dados mutáveis (Decimals
 *    são objetos imutáveis, mas reatribuímos as referências no tick).
 *  - O React não re-renderiza pela mudança desses campos; ele subscreve a
 *    `tick`, um contador incrementado em cadência reduzida (~15Hz) pelo
 *    game loop. Isso desacopla simulação (60Hz) de render.
 *
 * Por consequência, NUNCA leia `resource`/`generators` num componente React
 * sem também subscrever `tick` — use o hook `useGameTick()` ou selectors
 * que dependam de `tick` pra reatividade.
 */
interface GameStore extends GameState {
  /** Contador incrementado em cadência reduzida pra disparar re-render. */
  tick: number;

  applyTick(dt: number): void;
  buy(generatorId: number): void;
  reset(): void;

  /** Dispara re-render no React. Chamado pelo game loop. */
  notify(): void;
}

const initial = load() ?? makeFreshState();

export const useGameStore = create<GameStore>((set, get) => ({
  resource: initial.resource,
  generators: initial.generators,
  startedAt: initial.startedAt,
  tick: 0,

  applyTick(dt: number) {
    const state = get();
    const clampedDt = Math.min(DT_CAP, Math.max(0, dt));
    if (clampedDt <= 0) return;

    const gens = state.generators;

    // Gen 1 → Recurso Base
    const gen1 = gens[0];
    if (gen1) {
      state.resource = state.resource.add(
        gen1.count.mul(gen1.productionRate).mul(clampedDt)
      );
    }

    // Gen N (N>=2) → Gen N-1.
    // Iteração de baixo (índice 1) pra cima usa o `count` do nível superior
    // ANTES da produção daquele nível neste mesmo frame, evitando compostagem.
    for (let i = 1; i < gens.length; i++) {
      const gen = gens[i];
      if (!gen.unlocked) continue;
      const prod = gen.count.mul(gen.productionRate).mul(clampedDt);
      gens[i - 1].count = gens[i - 1].count.add(prod);
    }

    checkUnlocksMutating(state);
  },

  buy(generatorId: number) {
    const state = get();
    const gen = state.generators[generatorId - 1];
    if (!gen || !gen.unlocked) return;
    const cost = getBuyCost(gen);
    if (!state.resource.gte(cost)) return;

    state.resource = state.resource.sub(cost);
    gen.count = gen.count.add(1);
    gen.purchases += 1;

    checkUnlocksMutating(state);
    get().notify();
  },

  reset() {
    clearSave();
    const fresh = makeFreshState();
    set({
      resource: fresh.resource,
      generators: fresh.generators,
      startedAt: fresh.startedAt,
      tick: get().tick + 1,
    });
  },

  notify() {
    set({ tick: get().tick + 1 });
  },
}));

/**
 * Desbloqueio passivo: muta o array de geradores. Chamado dentro do tick
 * e da compra. Não chama `notify` — quem chama é responsável.
 */
function checkUnlocksMutating(state: { resource: Decimal; generators: Generator[] }) {
  for (const gen of state.generators) {
    if (!gen.unlocked && state.resource.gte(gen.unlockThreshold)) {
      gen.unlocked = true;
    }
  }
  // Garante que sempre haja um único próximo gerador bloqueado visível.
  const last = state.generators[state.generators.length - 1];
  if (last && last.unlocked) {
    state.generators.push(createGenerator(last.id + 1, false));
  }
}

/**
 * Taxa total de produção do Recurso Base (apenas Gen1 contribui diretamente
 * pro Recurso; outros geradores produzem geradores).
 */
export function getResourceRate(): Decimal {
  const gens = useGameStore.getState().generators;
  if (gens.length === 0) return D(0);
  return gens[0].count.mul(gens[0].productionRate);
}

/**
 * Snapshot do estado pra persistência. Não envolve React.
 */
export function getStateSnapshot(): GameState {
  const s = useGameStore.getState();
  return { resource: s.resource, generators: s.generators, startedAt: s.startedAt };
}

export function persistNow(): void {
  persist(getStateSnapshot());
}
