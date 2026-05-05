import type Decimal from 'break_eternity.js';

/**
 * Configuração derivada de um gerador (fórmulas, não estado).
 * Sempre reconstruída via `getGenConfig(n)` — não vai pro save.
 */
export interface GeneratorConfig {
  productionRate: Decimal;
  baseCost: Decimal;
  costMultiplier: Decimal;
  unlockThreshold: Decimal;
}

/**
 * Estado de um gerador na lista. Mistura config (reconstruída) com
 * estado do jogador (count, purchases, unlocked).
 */
export interface Generator extends GeneratorConfig {
  id: number;
  count: Decimal;
  purchases: number;
  unlocked: boolean;
}

export interface GameState {
  resource: Decimal;
  generators: Generator[];
  /** Timestamp (Date.now()) do primeiro boot deste save. Usado pra calcular
   *  o tempo total de jogo (wall clock, inclui offline). */
  startedAt: number;
  /** Estado de upgrades do jogador. Ver UpgradeState. */
  upgrades: UpgradeState;
}

/* ─────────── Upgrades ─────────── */

/**
 * Estado de upgrades persistido.
 *
 *  - `directedLevels[N]` (number): quantas vezes o boost direcionado do
 *    Gen N foi comprado. Ausência == 0.
 *
 * O tipo é deliberadamente um objeto (em vez de só `Record<number, number>`)
 * pra deixar espaço pra novas classes no futuro sem migração de save.
 */
export interface UpgradeState {
  directedLevels: Record<number, number>;
}

export function makeEmptyUpgradeState(): UpgradeState {
  return {
    directedLevels: {},
  };
}

/* ─────────── Save ─────────── */

/**
 * Forma serializada do save.
 * Decimals viram strings; config (rate, costs) é reconstruída no load.
 */
export interface SaveData {
  version: 1;
  ts: number;
  /** Opcional pra retro-compat com saves antigos sem esse campo —
   *  se ausente no load, atribuímos `Date.now()` como fallback. */
  startedAt?: number;
  resource: string;
  generators: Array<{
    id: number;
    count: string;
    purchases: number;
    unlocked: boolean;
  }>;
  /** Opcional pra retro-compat com saves anteriores ao sistema de upgrades. */
  upgrades?: UpgradeState;
  /**
   * Opcional pra retro-compat com saves anteriores ao sistema de histórico.
   * Tipado como `unknown[]` pra evitar import cíclico de history.ts em
   * types.ts; o módulo history valida a forma item-a-item ao carregar.
   */
  history?: unknown[];
}
