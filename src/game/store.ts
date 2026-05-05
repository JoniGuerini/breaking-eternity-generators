import Decimal from 'break_eternity.js';
import { create } from 'zustand';
import { D, DT_CAP, createGenerator, getBuyCost } from './config';
import {
  clearHistory,
  recordGeneratorBought,
  recordGeneratorUnlocked,
  recordMilestoneClaimed,
  recordOfflineGain,
  recordSaveStart,
  recordUpgradeBought,
} from './history';
import { collectAndClaimMilestones } from './milestones';
import { clearSave, loadWithMeta, makeFreshState, persist } from './persistence';
import type { GameState, Generator, UpgradeState } from './types';
import { getDirectedUpgradeCost, getEffectiveRateMultiplier } from './upgrades';

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

  /** Compra/upgrade de um boost direcionado (Gen N). Idempotente — falha
   *  silenciosamente se o jogador não puder pagar. */
  buyDirectedUpgrade(generatorId: number): void;

  reset(): void;

  /** Dispara re-render no React. Chamado pelo game loop. */
  notify(): void;
}

function checkUnlocksMutating(state: { resource: Decimal; generators: Generator[] }) {
  for (const gen of state.generators) {
    if (!gen.unlocked && state.resource.gte(gen.unlockThreshold)) {
      gen.unlocked = true;
      recordGeneratorUnlocked(gen.id);
    }
  }
  // Garante que sempre haja um único próximo gerador bloqueado visível.
  const last = state.generators[state.generators.length - 1];
  if (last && last.unlocked) {
    state.generators.push(createGenerator(last.id + 1, false));
  }
}

/**
 * Calcula a taxa efetiva (Decimal) do Gen N, já considerando todos os
 * multiplicadores de upgrades aplicáveis. Centraliza a lógica pra que
 * o tick de produção, a UI e o offline progress usem o MESMO valor.
 */
export function getEffectiveProductionRate(gen: Generator, upgrades: UpgradeState): Decimal {
  const mult = getEffectiveRateMultiplier(gen.id, gen.count, upgrades);
  return gen.productionRate.mul(mult);
}

function applyProductionTickMutating(
  state: GameState,
  dt: number,
) {
  const clampedDt = Math.min(DT_CAP, Math.max(0, dt));
  if (clampedDt <= 0) return;

  const gens = state.generators;
  const upgrades = state.upgrades;

  // Gen 1 -> Recurso Base
  const gen1 = gens[0];
  if (gen1) {
    const rate = getEffectiveProductionRate(gen1, upgrades);
    state.resource = state.resource.add(gen1.count.mul(rate).mul(clampedDt));
  }

  // Gen N (N>=2) -> Gen N-1.
  for (let i = 1; i < gens.length; i++) {
    const gen = gens[i];
    if (!gen.unlocked) continue;
    const rate = getEffectiveProductionRate(gen, upgrades);
    const prod = gen.count.mul(rate).mul(clampedDt);
    gens[i - 1].count = gens[i - 1].count.add(prod);
  }

  checkUnlocksMutating(state);
  claimMilestonesMutating(state);
}

/**
 * Concede PMs por marcos cruzados desde a última verificação. Chamada após
 * cada tick de produção e após cada compra manual (count também sobe na
 * compra, então um marco pode ser fechado fora do tick natural).
 *
 * Cada novo tier vira:
 *   - +1 PM em `state.upgradePoints`
 *   - 1 evento `milestone_claimed` no histórico
 *
 * Idempotente: se nenhum tier novo cruzou, retorna em silêncio.
 */
function claimMilestonesMutating(state: GameState) {
  const events = collectAndClaimMilestones(state.generators, state.claimedMilestoneTiers);
  if (events.length === 0) return;
  state.upgradePoints = state.upgradePoints.add(events.length);
  for (const ev of events) {
    recordMilestoneClaimed(ev.genId, ev.tier);
  }
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

/**
 * Limiar mínimo (segundos) pra registrar um evento `offline_gain` no histórico.
 * Recargas comuns (Cmd+R, troca de aba rápida) ficam abaixo disso e seriam
 * só ruído. Já alguns minutos de aba escondida costumam render algo
 * significativo — vale a entrada.
 */
const OFFLINE_GAIN_LOG_THRESHOLD_S = 30;

function makeInitialState(): GameState {
  const loaded = loadWithMeta();
  if (!loaded) {
    // Primeira vez abrindo o jogo (ou save corrompido/limpo). Registra
    // o "início da partida" como primeiro evento — vai virar a âncora
    // cronológica do log.
    const fresh = makeFreshState();
    recordSaveStart(false);
    return fresh;
  }

  const now = Date.now();
  const elapsed = (now - loaded.lastSavedAt) / 1000;

  // Captura recurso ANTES de aplicar o offline pra calcular o ganho exato.
  // Importante: usar a referência Decimal direto, sem clone (`Decimal` é
  // imutável internamente — `add/sub` retornam novos objetos).
  const resourceBefore = loaded.state.resource;
  applyOfflineProgressMutating(loaded.state, elapsed);
  const resourceAfter = loaded.state.resource;

  if (elapsed >= OFFLINE_GAIN_LOG_THRESHOLD_S) {
    const gained = resourceAfter.sub(resourceBefore);
    if (gained.gt(0)) {
      recordOfflineGain(elapsed, gained);
    }
  }
  return loaded.state;
}

const initial = makeInitialState();

export const useGameStore = create<GameStore>((set, get) => ({
  resource: initial.resource,
  generators: initial.generators,
  startedAt: initial.startedAt,
  upgrades: initial.upgrades,
  upgradePoints: initial.upgradePoints,
  claimedMilestoneTiers: initial.claimedMilestoneTiers,
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

    // Histórico ANTES de checkUnlocks: a ordem cronológica fica natural
    // (compra → eventual desbloqueio do próximo gerador → marco cruzado).
    recordGeneratorBought(generatorId, cost);
    checkUnlocksMutating(state);
    claimMilestonesMutating(state);
    get().notify();
  },

  buyDirectedUpgrade(generatorId: number) {
    const state = get();
    const gen = state.generators[generatorId - 1];
    if (!gen || !gen.unlocked) return;

    const currentLevel = state.upgrades.directedLevels[generatorId] ?? 0;
    const cost = getDirectedUpgradeCost(generatorId, currentLevel);
    // Pago em PONTOS DE MELHORIA, não em Recurso Base.
    if (!state.upgradePoints.gte(cost)) return;

    state.upgradePoints = state.upgradePoints.sub(cost);
    state.upgrades.directedLevels[generatorId] = currentLevel + 1;

    recordUpgradeBought(generatorId, currentLevel, cost);
    get().notify();
  },

  reset() {
    clearSave();
    // Reset = partida nova do zero. Limpa o histórico inteiro e registra
    // um único `save_start(fromReset=true)` como nova âncora cronológica.
    clearHistory();
    recordSaveStart(true);

    const fresh = makeFreshState();
    set({
      resource: fresh.resource,
      generators: fresh.generators,
      startedAt: fresh.startedAt,
      upgrades: fresh.upgrades,
      upgradePoints: fresh.upgradePoints,
      claimedMilestoneTiers: fresh.claimedMilestoneTiers,
      tick: get().tick + 1,
    });
  },

  notify() {
    set({ tick: get().tick + 1 });
  },
}));


/**
 * Taxa total de produção do Recurso Base, considerando upgrades. Apenas
 * Gen1 contribui diretamente pro Recurso; outros geradores produzem
 * geradores.
 */
export function getResourceRate(): Decimal {
  const s = useGameStore.getState();
  const gens = s.generators;
  if (gens.length === 0) return D(0);
  const gen1 = gens[0];
  const rate = getEffectiveProductionRate(gen1, s.upgrades);
  return gen1.count.mul(rate);
}

/**
 * Snapshot do estado pra persistência. Não envolve React.
 */
export function getStateSnapshot(): GameState {
  const s = useGameStore.getState();
  return {
    resource: s.resource,
    generators: s.generators,
    startedAt: s.startedAt,
    upgrades: s.upgrades,
    upgradePoints: s.upgradePoints,
    claimedMilestoneTiers: s.claimedMilestoneTiers,
  };
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
  const resourceBefore = state.resource;
  applyOfflineProgressMutating(state, elapsedSeconds);

  if (elapsedSeconds >= OFFLINE_GAIN_LOG_THRESHOLD_S) {
    const gained = state.resource.sub(resourceBefore);
    if (gained.gt(0)) {
      recordOfflineGain(elapsedSeconds, gained);
    }
  }
  state.notify();
}
