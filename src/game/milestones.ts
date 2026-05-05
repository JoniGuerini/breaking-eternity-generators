/**
 * Marcos por gerador → Pontos de Melhoria (PM).
 *
 * Cada gerador tem uma escada infinita de marcos em potências de 10:
 *   tier 1: count ≥ 10
 *   tier 2: count ≥ 100
 *   tier 3: count ≥ 1.000
 *   tier 4: count ≥ 10K
 *   ...
 *   tier k: count ≥ 10^k
 *
 * Atingir um marco pela primeira vez no save concede +1 PM. O save guarda
 * `claimedMilestoneTiers[genId]` — o maior tier já reivindicado por aquele
 * gerador. PMs são one-shot: se o `count` cair (ex.: feature futura de
 * "soft reset"), o jogador NÃO reganha PMs já reivindicados.
 *
 * `count` aqui é o `Generator.count` (sobe na compra E na produção do tier
 * acima), não `purchases` — a especificação fala da quantidade exibida no
 * card "Possuídos".
 */

import Decimal from 'break_eternity.js';
import type { Generator } from './types';

/**
 * Maior tier de marco já cruzado pelo `count` informado.
 *
 *  - `count < 10` → 0 (nenhum marco)
 *  - `count = 10` → 1
 *  - `count = 99.9` → 1
 *  - `count = 100` → 2
 *  - `count = 1e9` → 9
 *
 * Usa `log10` do `Decimal` pra suportar contagens muito grandes. Caso
 * extremo (`count` < 1 ou Decimal não-finito): retorna 0.
 */
export function tierFor(count: Decimal): number {
  // `count.lt(10)` curtocircuitа antes de chamar log10 (evita log10 de
  // valores muito pequenos e o overhead do Decimal nessa fase quente).
  if (!count || count.lt(10)) return 0;
  const log10 = count.log10().toNumber();
  if (!isFinite(log10) || log10 < 1) return 0;
  return Math.floor(log10);
}

/**
 * Calcula quantos novos marcos o gerador tem direito a reivindicar agora,
 * dado o `claimed` atual. Sempre `>= 0`. Não muta nada — chamadores que
 * queiram efetivar a concessão usam `claimMilestonesForGenerator`.
 */
export function pendingMilestonesFor(gen: Generator, claimedTier: number): number {
  const current = tierFor(gen.count);
  return Math.max(0, current - claimedTier);
}

/**
 * Mapa serializável de "maior tier reivindicado por gerador". Persistido
 * com o save. A ausência da chave equivale a `0` (nenhum marco reivindicado).
 *
 * O formato é `Record<number, number>` (não `Record<string, number>`) pra
 * espelhar `UpgradeState.directedLevels` — o JSON re-stringifica as chaves
 * mas TypeScript enxerga como número, o que ajuda o uso ergonômico no código.
 */
export type ClaimedMilestoneTiers = Record<number, number>;

/**
 * Concede PM retroativos pra cada gerador, baseado no `count` atual e no
 * `claimedTier` registrado. Muta `claimed` in-place; retorna o total de
 * PMs concedidos (soma de novos tiers em todos os geradores).
 *
 * Ideal pra:
 *   - Boot pós-update (saves antigos sem `claimedMilestoneTiers` viram com
 *     um Record vazio e ganham TODOS os PMs retroativamente).
 *   - Tick natural: se um gerador cresceu e cruzou um marco, este chama
 *     contabiliza imediatamente.
 *
 * Não emite eventos de histórico aqui (mantém função pura). Chamadores que
 * queiram registrar evento `milestone_claimed` devem capturar o array
 * retornado por `collectClaimableEvents` antes ou inspecionar a diferença.
 */
export function claimMilestones(
  generators: Generator[],
  claimed: ClaimedMilestoneTiers,
): number {
  let totalGained = 0;
  for (const gen of generators) {
    const claimedTier = claimed[gen.id] ?? 0;
    const currentTier = tierFor(gen.count);
    if (currentTier > claimedTier) {
      totalGained += currentTier - claimedTier;
      claimed[gen.id] = currentTier;
    }
  }
  return totalGained;
}

/**
 * Variante que retorna metadados pra registrar no histórico (1 entrada por
 * tier individual reivindicado, não por gerador). Útil quando o caller
 * quer logar "Gen 2 atingiu 100" em vez de "Gen 2 ganhou 2 PM".
 *
 * Muta `claimed` in-place. Retorna lista de eventos a serem emitidos.
 */
export interface MilestoneClaimEvent {
  genId: number;
  tier: number;
  /** Threshold cruzado (10^tier). Útil pra exibir "atingiu 100 unidades". */
  thresholdLog10: number;
}

export function collectAndClaimMilestones(
  generators: Generator[],
  claimed: ClaimedMilestoneTiers,
): MilestoneClaimEvent[] {
  const events: MilestoneClaimEvent[] = [];
  for (const gen of generators) {
    const claimedTier = claimed[gen.id] ?? 0;
    const currentTier = tierFor(gen.count);
    if (currentTier > claimedTier) {
      for (let t = claimedTier + 1; t <= currentTier; t++) {
        events.push({ genId: gen.id, tier: t, thresholdLog10: t });
      }
      claimed[gen.id] = currentTier;
    }
  }
  return events;
}

/**
 * Threshold (em Decimal) pro próximo marco a partir do tier reivindicado.
 *  - claimedTier 0 → 10
 *  - claimedTier 1 → 100
 *  - claimedTier k → 10^(k+1)
 *
 * Útil pra UI mostrar "Próximo marco: 100" / barra de progresso.
 */
export function nextThreshold(claimedTier: number): Decimal {
  // Decimal.pow10(k) é mais barato e robusto que `new Decimal(10).pow(k)`
  // pra valores grandes (suporta tiers astronômicos sem overhead).
  return new Decimal(10).pow(claimedTier + 1);
}

/**
 * Threshold do tier ATUAL (o último já cruzado) — usado como ponto de
 * partida da barra de progresso pro próximo. Tier 0 (sem marco) → 1, pra
 * que `progressRatio(count, 0)` cresça do começo da escala.
 */
export function currentThreshold(claimedTier: number): Decimal {
  if (claimedTier <= 0) return new Decimal(1);
  return new Decimal(10).pow(claimedTier);
}

/**
 * Progresso LINEAR do `count` atual rumo ao próximo marco — `count / next`.
 * Retorna número entre 0 e 1.
 *
 * Exemplos:
 *   count = 2,  next = 10   → 0.20
 *   count = 50, next = 100  → 0.50
 *   count = 999, next = 1000 → 0.999
 *
 * Diferente da interpolação logarítmica que considerei antes, escala linear
 * reflete a expectativa direta do jogador: "tenho 2 de 10, então estou
 * 20%". A "lentidão aparente" no início de cada marco é INTENCIONAL — bate
 * com a realidade da produção exponencial em jogos idle (90% do range
 * cresce rápido, sensação de "quase lá" nos últimos 10%).
 */
export function progressRatio(count: Decimal, claimedTier: number): number {
  if (!count || count.lte(0)) return 0;
  const next = nextThreshold(claimedTier);
  // Math.min/max em number-space é OK aqui: count nunca passa MUITO de
  // next na prática (no pior caso 1.0..ish quando o tier estoura), e o
  // toNumber() lida bem com Decimals dessa magnitude.
  const ratio = count.div(next).toNumber();
  if (!isFinite(ratio) || ratio < 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}
