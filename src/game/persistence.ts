import Decimal from 'break_eternity.js';
import { D, SAVE_KEY, createGenerator } from './config';
import { loadHistory, serializeHistory } from './history';
import { claimMilestones } from './milestones';
import type { ClaimedMilestoneTiers } from './milestones';
import { makeEmptyUpgradeState } from './types';
import type { GameState, SaveData, UpgradeState } from './types';

export interface LoadedGameState {
  state: GameState;
  lastSavedAt: number;
}

/**
 * Cria o estado inicial — 1 de Recurso Base (suficiente pra comprar 1× Gen1
 * cujo custo base agora é 1) e a lista com Gerador 1 desbloqueado e
 * Gerador 2 visível mas bloqueado.
 */
export function makeFreshState(): GameState {
  return {
    resource: D(1),
    generators: [createGenerator(1, true), createGenerator(2, false)],
    startedAt: Date.now(),
    upgrades: makeEmptyUpgradeState(),
    upgradePoints: D(0),
    claimedMilestoneTiers: {},
  };
}

/**
 * Serializa o estado pro localStorage. Decimals viram strings.
 * Apenas dados do jogador são persistidos — config (rate/custo) é
 * reconstruída pelo `getGenConfig` ao carregar.
 */
export function serialize(state: GameState): SaveData {
  return {
    version: 1,
    ts: Date.now(),
    startedAt: state.startedAt,
    resource: state.resource.toString(),
    generators: state.generators.map((g) => ({
      id: g.id,
      count: g.count.toString(),
      purchases: g.purchases,
      unlocked: g.unlocked,
    })),
    upgrades: state.upgrades,
    upgradePoints: state.upgradePoints.toString(),
    claimedMilestoneTiers: state.claimedMilestoneTiers,
    // O histórico vive em módulo separado (não na GameState principal),
    // mas é persistido junto com o save pra simplificar a vida do
    // usuário: 1 storage key, 1 reset, 1 export futuro.
    history: serializeHistory(),
  };
}

/**
 * Aceita um valor do JSON e converte num `ClaimedMilestoneTiers` válido.
 * Permissivo: chaves não-numéricas, valores não-inteiros ou negativos são
 * descartados sem barulho.
 */
function coerceClaimedTiers(raw: unknown): ClaimedMilestoneTiers {
  if (!raw || typeof raw !== 'object') return {};
  const out: ClaimedMilestoneTiers = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(k);
    if (Number.isInteger(n) && n > 0 && typeof v === 'number' && v >= 0) {
      out[n] = v | 0;
    }
  }
  return out;
}

/**
 * Aceita um valor do JSON e tenta convertê-lo num UpgradeState válido.
 * Permissivo: qualquer chave/valor inesperado é ignorado, defaults
 * vazios. Mantém o save resiliente a corrupção parcial e a saves
 * anteriores ao sistema de upgrades.
 */
function coerceUpgradeState(raw: unknown): UpgradeState {
  const empty = makeEmptyUpgradeState();
  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as Record<string, unknown>;

  const directedLevels: Record<number, number> = {};
  if (obj.directedLevels && typeof obj.directedLevels === 'object') {
    for (const [k, v] of Object.entries(obj.directedLevels as Record<string, unknown>)) {
      const n = Number(k);
      if (Number.isInteger(n) && n > 0 && typeof v === 'number' && v >= 0) {
        directedLevels[n] = v | 0;
      }
    }
  }

  // `globalsBought` / `milestonesUnlocked` ficaram em saves antigos durante
  // o experimento de classes adicionais. Hoje são ignorados — o save se
  // auto-limpa no próximo persist.
  return { directedLevels };
}

/**
 * Tenta carregar do localStorage. Retorna null se não houver save válido.
 */
export function loadWithMeta(): LoadedGameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (!data || data.version !== 1 || !Array.isArray(data.generators)) return null;

    // Reidrata o histórico ANTES de retornar o GameState — garante que
    // qualquer evento gravado durante boot (ex.: offline gain calculado
    // logo após este load) seja anexado a um log já populado.
    loadHistory(data.history);

    const generators = data.generators.map((g) => {
      const gen = createGenerator(g.id, g.unlocked);
      gen.count = new Decimal(g.count);
      gen.purchases = g.purchases;
      return gen;
    });

    // Pontos de Melhoria + tiers de marco reivindicados.
    // Retro-compat: saves antigos não têm esses campos. Reivindicamos
    // marcos retroativamente baseado no `count` atual de cada gerador,
    // pra que o jogador não perca PMs já merecidos. Não emitimos eventos
    // de histórico nessa migração — o salto de PMs aparece "silenciosamente"
    // pra evitar poluir o log com dezenas de entradas no primeiro boot
    // pós-update. Marcos cruzados a partir de agora são logados normalmente.
    const claimedMilestoneTiers = coerceClaimedTiers(data.claimedMilestoneTiers);
    let upgradePoints =
      typeof data.upgradePoints === 'string' ? new Decimal(data.upgradePoints) : null;
    if (upgradePoints === null) {
      // Save pré-marcos: calcula tudo retroativamente.
      const retro = claimMilestones(generators, claimedMilestoneTiers);
      upgradePoints = D(retro);
    }

    return {
      state: {
        resource: new Decimal(data.resource ?? '0'),
        generators,
        // Retro-compat: saves antigos sem `startedAt` ganham `now` como fallback.
        // Tempo de jogo passa a contar a partir do primeiro carregamento pós-update.
        startedAt: typeof data.startedAt === 'number' ? data.startedAt : Date.now(),
        // Retro-compat: saves anteriores ao sistema de upgrades começam com tudo zerado.
        upgrades: coerceUpgradeState(data.upgrades),
        upgradePoints,
        claimedMilestoneTiers,
      },
      lastSavedAt: typeof data.ts === 'number' ? data.ts : Date.now(),
    };
  } catch {
    return null;
  }
}

export function load(): GameState | null {
  const loaded = loadWithMeta();
  return loaded?.state ?? null;
}

export function persist(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(state)));
  } catch {
    // pode falhar em sandboxes (ex.: artifact preview). silencioso.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // silencioso
  }
}
