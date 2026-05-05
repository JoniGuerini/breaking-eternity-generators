import Decimal from 'break_eternity.js';
import { D } from './config';
import type { UpgradeState } from './types';

/**
 * Sistema de upgrades — catálogo canônico, fórmulas de custo/efeito,
 * e cálculo de multiplicadores efetivos por gerador.
 *
 * Atualmente o jogo expõe APENAS uma classe de melhorias:
 *   DIRECTED — boost infinito do rate de um Gen específico.
 *
 * Custo é pago em PONTOS DE MELHORIA (PM), recurso ganho via marcos
 * (ver `milestones.ts`). Recurso Base não entra mais na compra de
 * melhorias — é exclusivamente pra geradores.
 *
 * Tudo aqui é PURO — nenhuma referência ao store. Funções recebem o
 * estado relevante e devolvem números/Decimals. Isso facilita testar
 * isoladamente e usar tanto na simulação quanto na UI.
 */

/* ─────────── DIRECTED ─────────── */

/**
 * Multiplicador de rate aplicado por nível de boost direcionado.
 * Cada nível DOBRA a produção do Gen — escolha forte de design pra que
 * cada nível "sinta-se" como um upgrade, mesmo nos primeiros.
 */
export const DIRECTED_RATE_MULT_PER_LEVEL = D(2);

/**
 * Custo (em PM) do PRÓXIMO nível do boost direcionado do Gen `n`, dado
 * quantos níveis já foram comprados.
 *
 * Fórmula: `cost(L) = (L+1)!`
 *
 * Tabela:
 *   L=0 → nível 1: 1 PM
 *   L=1 → nível 2: 2 PM
 *   L=2 → nível 3: 6 PM
 *   L=3 → nível 4: 24 PM
 *   L=4 → nível 5: 120 PM
 *   L=5 → nível 6: 720 PM
 *   L=6 → nível 7: 5.040 PM
 *   ...
 *
 * O custo NÃO depende do gerador — cada gerador tem sua própria trilha
 * de níveis, e a fórmula é aplicada por trilha. Comprar a melhoria 3 do
 * Gen 1 não barateia nem encarece a do Gen 2.
 *
 * Crescimento factorial é mais agressivo que potência (×3 a cada nível
 * antes era 1, 5, 15, 45...) — aqui o "preço de oportunidade" cresce
 * rapidamente, forçando o jogador a balancear entre upgrades cedo e
 * acumular PMs pra um upgrade mais alto depois.
 */
export function getDirectedUpgradeCost(_genId: number, currentLevel: number): Decimal {
  return factorial(currentLevel + 1);
}

/**
 * Factorial via produto iterativo, retornado como Decimal pra que tiers
 * altos (ex.: 170+) não estourem float64.
 *
 * Memo simples (cap 200): factorials são acessados muito (uma chamada
 * por render no UpgradesModal × N geradores). Acima de 200 calculamos
 * direto sem cache — é raro e o produto é cheap.
 */
const FACTORIAL_CACHE_CAP = 200;
const factorialCache: Decimal[] = [D(1)]; // 0! = 1

function factorial(n: number): Decimal {
  if (n <= 0) return D(1);
  if (n <= FACTORIAL_CACHE_CAP && factorialCache[n]) return factorialCache[n];

  let i = factorialCache.length;
  let acc = factorialCache[i - 1];
  while (i <= n) {
    acc = acc.mul(i);
    if (i <= FACTORIAL_CACHE_CAP) factorialCache[i] = acc;
    i++;
  }
  return acc;
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
