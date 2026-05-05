import Decimal from 'break_eternity.js';
import { D, SAVE_KEY, createGenerator } from './config';
import type { GameState, SaveData } from './types';

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
  };
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

    return {
      state: {
        resource: new Decimal(data.resource ?? '0'),
        generators: data.generators.map((g) => {
          const gen = createGenerator(g.id, g.unlocked);
          gen.count = new Decimal(g.count);
          gen.purchases = g.purchases;
          return gen;
        }),
        // Retro-compat: saves antigos sem `startedAt` ganham `now` como fallback.
        // Tempo de jogo passa a contar a partir do primeiro carregamento pós-update.
        startedAt: typeof data.startedAt === 'number' ? data.startedAt : Date.now(),
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
