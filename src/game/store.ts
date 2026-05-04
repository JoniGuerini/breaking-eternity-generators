import Decimal from 'break_eternity.js';
import { create } from 'zustand';
import { D, DT_CAP, createGenerator, getBuyCost } from './config';
import { clearSave, loadWithMeta, makeFreshState, persist } from './persistence';
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
const OFFLINE_MIN_SECONDS = 1;

interface GameStore extends GameState {
  /** Contador incrementado em cadência reduzida pra disparar re-render. */
  tick: number;

  applyTick(dt: number): void;
  buy(generatorId: number): void;
  reset(): void;

  /** Dispara re-render no React. Chamado pelo game loop. */
  notify(): void;
}

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

function applyProductionTickMutating(state: { resource: Decimal; generators: Generator[] }, dt: number) {
  const clampedDt = Math.min(DT_CAP, Math.max(0, dt));
  if (clampedDt <= 0) return;

  const gens = state.generators;

  // Gen 1 -> Recurso Base
  const gen1 = gens[0];
  if (gen1) {
    state.resource = state.resource.add(gen1.count.mul(gen1.productionRate).mul(clampedDt));
  }

  // Gen N (N>=2) -> Gen N-1.
  for (let i = 1; i < gens.length; i++) {
    const gen = gens[i];
    if (!gen.unlocked) continue;
    const prod = gen.count.mul(gen.productionRate).mul(clampedDt);
    gens[i - 1].count = gens[i - 1].count.add(prod);
  }

  checkUnlocksMutating(state);
}

function applyOfflineProgressMutating(state: GameState, elapsedSeconds: number) {
  const offlineSeconds = Math.max(0, elapsedSeconds);
  if (offlineSeconds < OFFLINE_MIN_SECONDS) return;

  let remaining = offlineSeconds;
  while (remaining > 0) {
    const step = Math.min(DT_CAP, remaining);
    applyProductionTickMutating(state, step);
    remaining -= step;
  }
}

function makeInitialState(): GameState {
  const loaded = loadWithMeta();
  if (!loaded) return makeFreshState();

  const now = Date.now();
  const elapsed = (now - loaded.lastSavedAt) / 1000;
  applyOfflineProgressMutating(loaded.state, elapsed);
  return loaded.state;
}

const initial = makeInitialState();

export const useGameStore = create<GameStore>((set, get) => ({
  resource: initial.resource,
  generators: initial.generators,
  startedAt: initial.startedAt,
  tick: 0,

  applyTick(dt: number) {
    const state = get();
    applyProductionTickMutating(state, dt);
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

/**
 * Aplica progresso "offline" ao estado vivo — usado pelo loop ao detectar
 * que a aba ficou em background e está voltando.
 *
 * Diferente do offline progress do boot, aqui o store já existe e está sendo
 * observado pelo React, então emitimos `notify()` pra forçar um re-render
 * imediato com o novo total (sem esperar o próximo tick "natural" do rAF).
 */
export function applyCatchUpProgress(elapsedSeconds: number): void {
  const state = useGameStore.getState();
  applyOfflineProgressMutating(state, elapsedSeconds);
  state.notify();
}
