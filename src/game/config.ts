import Decimal, { type DecimalSource } from 'break_eternity.js';
import type { Generator, GeneratorConfig } from './types';

export const D = (x: DecimalSource): Decimal => new Decimal(x);

/**
 * Configuração do gerador N.
 *  - Taxa de produção por unidade: 0.20, 0.19, 0.18, ... com piso em 0.10/s
 *  - Custo base do Gerador N: 10^N (Gen1=10, Gen2=100, ...)
 *  - Multiplicador de custo por compra: 1.5
 *  - Threshold de desbloqueio: igual ao custo base (10^N) — passivo, não consome
 *
 * Centralizado aqui pra permitir balanceamento sem invalidar saves.
 */
export function getGenConfig(n: number): GeneratorConfig {
  const rate = Math.max(0.1, 0.21 - 0.01 * n);
  const baseCost = Decimal.pow(10, n);
  return {
    productionRate: D(rate),
    baseCost,
    costMultiplier: D(1.5),
    unlockThreshold: baseCost,
  };
}

export function createGenerator(n: number, unlocked: boolean): Generator {
  const cfg = getGenConfig(n);
  return {
    id: n,
    count: D(0),
    purchases: 0,
    unlocked,
    ...cfg,
  };
}

/**
 * Custo da próxima compra do gerador, dado o número de compras já feitas.
 * `qty` reservado pro futuro Buy ×10 / Buy max.
 */
export function getBuyCost(gen: Generator, _qty: number = 1): Decimal {
  return gen.baseCost.mul(gen.costMultiplier.pow(gen.purchases));
}

export const SAVE_KEY = 'breaking_eternity_save_v1';

/** dt máximo aceito num tick — protege contra spike após troca de aba. */
export const DT_CAP = 0.5;
