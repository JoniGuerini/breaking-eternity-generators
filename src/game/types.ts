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
}

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
}
