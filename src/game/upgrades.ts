import Decimal from 'break_eternity.js';
import { D, getGenConfig } from './config';
import type { UpgradeState } from './types';

/**
 * Sistema de upgrades — catálogo canônico, fórmulas de custo/efeito,
 * e cálculo de multiplicadores efetivos por gerador.
 *
 * Atualmente o jogo expõe APENAS uma classe de melhorias:
 *   DIRECTED — boost infinito do rate de um Gen específico.
 *
 * Tudo aqui é PURO — nenhuma referência ao store. Funções recebem o
 * estado relevante e devolvem números/Decimals. Isso facilita testar
 * isoladamente e usar tanto na simulação quanto na UI (custos previstos,
 * efeitos previstos, etc.).
 */

/* ─────────── DIRECTED ─────────── */

/**
 * Multiplicador de rate aplicado por nível de boost direcionado.
 * Cada nível DOBRA a produção do Gen — escolha forte de design pra que
 * cada nível "sinta-se" como um upgrade, mesmo nos primeiros.
 */
export const DIRECTED_RATE_MULT_PER_LEVEL = D(2);

/**
 * Fator de crescimento do custo a cada nível comprado.
 *
 * Triplica a cada compra — cresce mais rápido que o custo de comprar
 * geradores (que cresce em 1.55-2.10×). Isso garante que ficar
 * spammando o boost vira custo proibitivo, e o jogador volta a comprar
 * geradores em algum momento.
 */
export const DIRECTED_COST_GROWTH = D(3);

/**
 * Custo do PRÓXIMO nível do boost direcionado do Gen `n`, dado quantos
 * níveis já foram comprados.
 *
 * Fórmula:
 *   cost(n, L) = baseCost(n) * 5 * 3^L
 *
 * - Multiplicado por 5 do baseCost: o primeiro nível custa "5 unidades
 *   daquele Gen" — caro o suficiente pra ser uma decisão (não compra
 *   automaticamente), barato o suficiente pra ser tentador.
 */
export function getDirectedUpgradeCost(genId: number, currentLevel: number): Decimal {
  const cfg = getGenConfig(genId);
  return cfg.baseCost.mul(5).mul(DIRECTED_COST_GROWTH.pow(currentLevel));
}

/**
 * Multiplicador EFETIVO de rate do boost direcionado do Gen `n`, dado o
 * nível atual. `2^L` (acumulativo).
 */
export function getDirectedRateMultiplier(currentLevel: number): Decimal {
  if (currentLevel <= 0) return D(1);
  return DIRECTED_RATE_MULT_PER_LEVEL.pow(currentLevel);
}

/* ─────────── COMBINADO ─────────── */

/**
 * Multiplicador TOTAL de rate efetivo do Gen `n`, considerando todos os
 * upgrades aplicáveis. Hoje, isso é apenas o boost direcionado, mas a
 * função existe pra que o tick de produção e a UI consumam um único
 * ponto de entrada — adicionar novas classes no futuro só requer
 * compor mais multiplicadores aqui.
 */
export function getEffectiveRateMultiplier(
  genId: number,
  _count: Decimal,
  upgrades: UpgradeState,
): Decimal {
  const directedLevel = upgrades.directedLevels[genId] ?? 0;
  return getDirectedRateMultiplier(directedLevel);
}
