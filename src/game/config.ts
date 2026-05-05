import Decimal, { type DecimalSource } from 'break_eternity.js';
import type { Generator, GeneratorConfig } from './types';

export const D = (x: DecimalSource): Decimal => new Decimal(x);

/**
 * Configuração do gerador N.
 *
 * Curvas de balanceamento — todas centralizadas aqui pra permitir tuning
 * sem invalidar saves (config é reconstruída no load via `createGenerator`).
 *
 * 1. **Taxa de produção** — decaimento exponencial:
 *      rate(N) = 0.10 × 0.85^(N-1)
 *    Gen 1 = 0.10/s, Gen 2 = 0.085/s, Gen 5 ≈ 0.052/s, Gen 10 ≈ 0.023/s.
 *    Sem piso: cada gerador produz menos que o anterior, mas o valor nunca
 *    chega em zero. Tiers altos compensam a taxa baixa via cascata.
 *
 * 2. **Custo base por tier** — gap progressivo:
 *      baseCost(N) = 10^(N × (1 + (N-1) × 0.15) - 1)
 *    Gen 1 = 1, Gen 2 ≈ 20, Gen 3 ≈ 794, Gen 4 ≈ 63K, Gen 5 = 10M, ...
 *    Mesma forma da curva original, mas deslocada uma ordem de magnitude
 *    pra baixo pra que Gen 1 custe 1 recurso (comprado no boot com o
 *    recurso inicial = 1). O gap entre tiers cresce gradualmente conforme
 *    avançamos.
 *
 * 3. **Multiplicador por compra** — escala com tier:
 *      costMultiplier(N) = 1.5 + N × 0.05
 *    Gen 1 = ×1.55, Gen 5 = ×1.75, Gen 10 = ×2.00, Gen 20 = ×2.50.
 *    Empilhar muitas unidades do mesmo gerador encarece mais rápido em
 *    tiers altos, incentivando avançar pro próximo gerador.
 *
 * 4. **Threshold de desbloqueio** — igual ao custo base (passivo, não consome).
 */
export function getGenConfig(n: number): GeneratorConfig {
  const rate = 0.1 * Math.pow(0.85, n - 1);
  // Subtraímos 1 do expoente pra deslocar a curva uma ordem de magnitude
  // pra baixo (Gen 1 custa 10^0 = 1 em vez de 10^1 = 10).
  const exponent = n * (1 + (n - 1) * 0.15) - 1;
  const baseCost = Decimal.pow(10, exponent);
  const multiplier = 1.5 + n * 0.05;

  return {
    productionRate: D(rate),
    baseCost,
    costMultiplier: D(multiplier),
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
