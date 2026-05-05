import { describe, expect, it } from 'vitest';
import { D, createGenerator } from './config';
import {
  claimMilestones,
  collectAndClaimMilestones,
  currentThreshold,
  nextThreshold,
  pendingMilestonesFor,
  progressRatio,
  tierFor,
} from './milestones';
import type { Generator } from './types';

/**
 * Marcos: cada potência de 10 cruzada pelo `count` concede +1 PM.
 * O save guarda o maior tier reivindicado por gerador. Aqui validamos
 * a função pura `tierFor` e os helpers de reivindicação.
 */

function makeGen(id: number, count: number | string): Generator {
  const gen = createGenerator(id, true);
  gen.count = D(count);
  return gen;
}

describe('tierFor', () => {
  it('count 0 ou negativo → tier 0', () => {
    expect(tierFor(D(0))).toBe(0);
  });

  it('count < 10 → tier 0', () => {
    expect(tierFor(D(1))).toBe(0);
    expect(tierFor(D(9.99))).toBe(0);
  });

  it('count = 10 → tier 1 (primeiro marco)', () => {
    expect(tierFor(D(10))).toBe(1);
  });

  it('escada de potências de 10', () => {
    expect(tierFor(D(99))).toBe(1);
    expect(tierFor(D(100))).toBe(2);
    expect(tierFor(D(999))).toBe(2);
    expect(tierFor(D(1000))).toBe(3);
    expect(tierFor(D(1e6))).toBe(6);
    expect(tierFor(D(1e9))).toBe(9);
  });

  it('suporta Decimals enormes', () => {
    expect(tierFor(D('1e100'))).toBe(100);
    expect(tierFor(D('1e1000'))).toBe(1000);
  });

  it('arredondamento: 9.999... ainda é tier 0, 10 exato é tier 1', () => {
    expect(tierFor(D(9.999))).toBe(0);
    expect(tierFor(D(10))).toBe(1);
  });
});

describe('pendingMilestonesFor', () => {
  it('zero quando count abaixo do próximo marco', () => {
    const gen = makeGen(1, 5);
    expect(pendingMilestonesFor(gen, 0)).toBe(0);
  });

  it('um marco pendente quando count cruza próximo threshold', () => {
    const gen = makeGen(1, 50);
    expect(pendingMilestonesFor(gen, 0)).toBe(1);
  });

  it('múltiplos marcos quando count salta vários tiers', () => {
    // Caso típico de retro-compat: save antigo com Gen2 em 5000, claimed=0
    // → ganha 3 PMs (10, 100, 1000).
    const gen = makeGen(1, 5000);
    expect(pendingMilestonesFor(gen, 0)).toBe(3);
  });

  it('zero se claimed >= currentTier', () => {
    const gen = makeGen(1, 50);
    expect(pendingMilestonesFor(gen, 1)).toBe(0);
  });

  it('nunca negativo (count caiu abaixo do já reivindicado)', () => {
    const gen = makeGen(1, 5); // tier 0
    expect(pendingMilestonesFor(gen, 3)).toBe(0);
  });
});

describe('claimMilestones', () => {
  it('soma os PMs de todos os geradores e atualiza claimed', () => {
    const gens = [makeGen(1, 200), makeGen(2, 50), makeGen(3, 5)];
    const claimed: Record<number, number> = {};
    const total = claimMilestones(gens, claimed);
    // Gen1 cruzou tier 1 e 2 → +2; Gen2 cruzou tier 1 → +1; Gen3 nada.
    expect(total).toBe(3);
    expect(claimed[1]).toBe(2);
    expect(claimed[2]).toBe(1);
    // Gen3 não foi escrito (defensivo: ausência === 0).
    expect(claimed[3]).toBeUndefined();
  });

  it('é idempotente: chamar de novo sem mudar count concede 0 PM', () => {
    const gens = [makeGen(1, 200)];
    const claimed: Record<number, number> = {};
    expect(claimMilestones(gens, claimed)).toBe(2);
    expect(claimMilestones(gens, claimed)).toBe(0);
  });

  it('respeita claimed pré-existente (saves migrados)', () => {
    const gens = [makeGen(1, 200)];
    const claimed: Record<number, number> = { 1: 1 };
    expect(claimMilestones(gens, claimed)).toBe(1); // só o tier 2 novo
    expect(claimed[1]).toBe(2);
  });
});

describe('collectAndClaimMilestones', () => {
  it('retorna 1 evento por tier (não por gerador)', () => {
    const gens = [makeGen(1, 200)];
    const claimed: Record<number, number> = {};
    const events = collectAndClaimMilestones(gens, claimed);
    expect(events).toEqual([
      { genId: 1, tier: 1, thresholdLog10: 1 },
      { genId: 1, tier: 2, thresholdLog10: 2 },
    ]);
  });

  it('emite eventos em ordem por gerador, dentro do gerador por tier asc', () => {
    const gens = [makeGen(1, 100), makeGen(2, 1000)];
    const claimed: Record<number, number> = {};
    const events = collectAndClaimMilestones(gens, claimed);
    expect(events.map((e) => `${e.genId}:${e.tier}`)).toEqual([
      '1:1',
      '1:2',
      '2:1',
      '2:2',
      '2:3',
    ]);
  });
});

describe('thresholds e progressRatio', () => {
  it('nextThreshold escala 10^(tier+1)', () => {
    expect(nextThreshold(0).eq(10)).toBe(true);
    expect(nextThreshold(1).eq(100)).toBe(true);
    expect(nextThreshold(5).eq(1e6)).toBe(true);
  });

  it('currentThreshold é 1 quando nada foi reivindicado', () => {
    expect(currentThreshold(0).eq(1)).toBe(true);
    expect(currentThreshold(2).eq(100)).toBe(true);
  });

  it('progressRatio: linear count / nextThreshold', () => {
    // Tier 0 (próximo marco = 10): count = 2 → 20%, count = 5 → 50%,
    // count = 10 → 100%. Garante a leitura intuitiva no primeiro marco.
    expect(progressRatio(D(2), 0)).toBeCloseTo(0.2, 5);
    expect(progressRatio(D(5), 0)).toBeCloseTo(0.5, 5);
    expect(progressRatio(D(10), 0)).toBeCloseTo(1, 5);
  });

  it('progressRatio escala com o tier (linear dentro de cada janela)', () => {
    // Tier 1 (próximo marco = 100): count = 50 → 50%
    expect(progressRatio(D(50), 1)).toBeCloseTo(0.5, 5);
    // Tier 2 (próximo marco = 1000): count = 200 → 20%
    expect(progressRatio(D(200), 2)).toBeCloseTo(0.2, 5);
  });

  it('progressRatio clampa em [0, 1]', () => {
    expect(progressRatio(D(0), 0)).toBe(0);
    expect(progressRatio(D(-5), 0)).toBe(0);
    expect(progressRatio(D(1000), 0)).toBe(1);
  });
});
