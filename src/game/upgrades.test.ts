import { describe, expect, it } from 'vitest';
import { D } from './config';
import { makeEmptyUpgradeState } from './types';
import {
  getDirectedRateMultiplier,
  getDirectedUpgradeCost,
  getEffectiveRateMultiplier,
} from './upgrades';

/**
 * Testes do sistema de upgrades. Foco nas fórmulas de custo, efeito e
 * combinação multiplicativa — onde os bugs costumam aparecer.
 *
 * Custo agora é em PONTOS DE MELHORIA (PM) e segue factorial:
 *   cost(L) = (L+1)!  (1, 2, 6, 24, 120, 720, 5040, ...)
 * Independente do gerador (cada gerador tem sua trilha mas a fórmula
 * só depende do nível atual da própria trilha).
 */

describe('upgrades / directed effect', () => {
  it('nível 0 é multiplicador neutro (1.0)', () => {
    expect(getDirectedRateMultiplier(0).toNumber()).toBe(1);
  });

  it('multiplicador escala como 2^L (cada nível dobra)', () => {
    expect(getDirectedRateMultiplier(1).toNumber()).toBeCloseTo(2, 5);
    expect(getDirectedRateMultiplier(3).toNumber()).toBeCloseTo(8, 5);
    expect(getDirectedRateMultiplier(10).toNumber()).toBeCloseTo(1024, 1);
  });
});

describe('upgrades / directed cost (PM, factorial)', () => {
  it('primeiro nível custa 1 PM', () => {
    expect(getDirectedUpgradeCost(1, 0).toNumber()).toBe(1);
  });

  it('escada factorial: 1, 2, 6, 24, 120, 720', () => {
    expect(getDirectedUpgradeCost(1, 0).toNumber()).toBe(1);
    expect(getDirectedUpgradeCost(1, 1).toNumber()).toBe(2);
    expect(getDirectedUpgradeCost(1, 2).toNumber()).toBe(6);
    expect(getDirectedUpgradeCost(1, 3).toNumber()).toBe(24);
    expect(getDirectedUpgradeCost(1, 4).toNumber()).toBe(120);
    expect(getDirectedUpgradeCost(1, 5).toNumber()).toBe(720);
  });

  it('é IDÊNTICO entre geradores diferentes (custo só depende do nível)', () => {
    expect(getDirectedUpgradeCost(1, 3).eq(getDirectedUpgradeCost(2, 3))).toBe(true);
    expect(getDirectedUpgradeCost(5, 7).eq(getDirectedUpgradeCost(99, 7))).toBe(true);
  });

  it('cache funciona: chamadas repetidas retornam mesmo Decimal lógico', () => {
    const a = getDirectedUpgradeCost(1, 10);
    const b = getDirectedUpgradeCost(1, 10);
    // 11! = 39916800
    expect(a.toNumber()).toBe(39916800);
    expect(b.toNumber()).toBe(39916800);
  });
});

describe('upgrades / efetivo combinado', () => {
  it('estado vazio retorna multiplicador 1.0', () => {
    const upgrades = makeEmptyUpgradeState();
    expect(getEffectiveRateMultiplier(1, D(0), upgrades).toNumber()).toBe(1);
  });

  it('aplica APENAS o multiplicador direcionado do gerador alvo', () => {
    const upgrades = makeEmptyUpgradeState();
    upgrades.directedLevels[1] = 3; // ×8 (2³)

    const mult = getEffectiveRateMultiplier(1, D(0), upgrades);
    expect(mult.toNumber()).toBeCloseTo(8, 5);
  });

  it('multiplicador é independente por gerador', () => {
    const upgrades = makeEmptyUpgradeState();
    upgrades.directedLevels[3] = 4; // Gen 3 ×16

    const multGen3 = getEffectiveRateMultiplier(3, D(0), upgrades);
    const multGen5 = getEffectiveRateMultiplier(5, D(0), upgrades);

    expect(multGen3.toNumber()).toBeCloseTo(16, 5);
    expect(multGen5.toNumber()).toBe(1); // Sem upgrades em Gen5.
  });
});

describe('upgrades / Decimal robustness', () => {
  it('custo em níveis muito altos cresce de forma monotônica e sem overflow', () => {
    // 50! ≈ 3e64 — cabe em Decimal (e em double inclusive como Number).
    const cost50 = getDirectedUpgradeCost(1, 49);
    expect(cost50.toNumber()).toBeGreaterThan(3e64);
    expect(cost50.toNumber()).toBeLessThan(4e64);
  });

  it('custo em níveis astronômicos ainda é finito (Decimal não estoura)', () => {
    // 200! ≈ 7.88e374 — estoura double mas o Decimal carrega.
    const cost = getDirectedUpgradeCost(1, 199);
    expect(cost.gt(0)).toBe(true);
    expect(cost.log10().toNumber()).toBeGreaterThan(370);
  });
});
