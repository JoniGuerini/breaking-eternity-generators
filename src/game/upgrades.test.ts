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
 * Hoje só existe a classe DIRECTED; testes de globais/marcos foram
 * removidos junto com a feature.
 */

describe('upgrades / directed', () => {
  it('nível 0 é multiplicador neutro (1.0)', () => {
    expect(getDirectedRateMultiplier(0).toNumber()).toBe(1);
  });

  it('multiplicador escala como 2^L (cada nível dobra)', () => {
    expect(getDirectedRateMultiplier(1).toNumber()).toBeCloseTo(2, 5);
    expect(getDirectedRateMultiplier(3).toNumber()).toBeCloseTo(8, 5);
    expect(getDirectedRateMultiplier(10).toNumber()).toBeCloseTo(1024, 1);
  });

  it('custo do nível 0 é baseCost(N) × 5', () => {
    // baseCost(1) = 1 → custo do primeiro nível = 5.
    const cost = getDirectedUpgradeCost(1, 0);
    expect(cost.toNumber()).toBe(5);
  });

  it('custo triplica a cada nível comprado', () => {
    // baseCost(1) × 5 × 3^L. `toBeCloseTo` porque Decimal.pow internamente
    // usa log/exp e introduz ruído de ponto flutuante mesmo em expoentes
    // inteiros (ex.: 3^5 vira 243.0000...x).
    expect(getDirectedUpgradeCost(1, 1).toNumber()).toBeCloseTo(15, 5);
    expect(getDirectedUpgradeCost(1, 2).toNumber()).toBeCloseTo(45, 5);
    expect(getDirectedUpgradeCost(1, 5).toNumber()).toBeCloseTo(1215, 4);
  });

  it('custo escala com baseCost do gerador', () => {
    // baseCost(2) ≈ 19.95 → custo nível 0 ≈ 99.76
    const cost = getDirectedUpgradeCost(2, 0);
    expect(cost.toNumber()).toBeCloseTo(99.76, 1);
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
  it('custo direcionado em níveis altos usa Decimal corretamente', () => {
    // Em L=50, 3^50 estoura double mas Decimal aguenta.
    // 5 × 3^50 ≈ 5 × 7.18e23 = 3.59e24
    const cost = getDirectedUpgradeCost(1, 50);
    expect(cost.toNumber()).toBeGreaterThan(3e24);
    expect(cost.toNumber()).toBeLessThan(4e24);
  });
});
