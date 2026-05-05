import { describe, expect, it } from 'vitest';
import { formatInt, formatNum } from './format';

describe('formatNum', () => {
  it.each([
    [0, '0.00'],
    [5.4271, '5.43'],
    [9.99, '9.99'],
    [42.7, '42.7'],
    [999, '999'],
    [1234, '1.234'],
    [9999, '9.999'],
    [12345, '12.35\u00a0K'],
    [1500000, '1.50\u00a0M'],
    [999500, '999.50\u00a0K'],
    // anti-overflow: 999.995 deveria virar 1000.00 K — promove pra 1.00 M
    [999995, '1.00\u00a0M'],
    [1e9, '1.00\u00a0B'],
    [1e12, '1.00\u00a0T'],
    [1e33, '1.00\u00a0aa'],
    [1e36, '1.00\u00a0ab'],
    [1e108, '1.00\u00a0az'],
    [-1234, '-1.234'],
  ])('formatNum(%p) === %p', (input, expected) => {
    expect(formatNum(input)).toBe(expected);
  });

  it('coerce null para 0.00', () => {
    expect(formatNum(null)).toBe('0.00');
  });

  it('coerce NaN para 0.00', () => {
    expect(formatNum(NaN)).toBe('0.00');
  });

  it('coerce undefined para 0.00', () => {
    expect(formatNum(undefined)).toBe('0.00');
  });

  it('aceita strings com decimais grandes (acima do teto float64)', () => {
    const out = formatNum('1.5e400');
    // Não deve travar, não deve retornar NaN, deve ter sufixo alfabético.
    expect(out).not.toContain('NaN');
    expect(out).not.toContain('Infinity');
    // 1.5e400: log10 ≈ 400.176, group = 133. Os primeiros 11 grupos (0-10)
    // são nomeados; group 133 cai bem dentro da faixa alfabética.
    expect(out).toMatch(/^[0-9.]+\u00a0[a-z]+$/);
  });

  it('string inválida cai pra 0', () => {
    expect(formatNum('banana')).toBe('0.00');
  });

  describe('valores pequenos (rates de geradores tier alto)', () => {
    it.each([
      // Faixa < 1: até 3 decimais com TRIM de zeros à direita
      // (precisão sem ruído visual — 0.085 mostra 0.085, não 0.09).
      [0.5, '0.5'],
      [0.1, '0.1'],
      [0.085, '0.085'],
      [0.072, '0.072'],
      [0.05, '0.05'],
      [0.01, '0.01'],
      // 0.005 e 0.001 — três casas significativas
      [0.005, '0.005'],
      [0.001, '0.001'],
      // < 0.001 → 4 decimais (com trim)
      [0.0009, '0.0009'],
      [0.0004, '0.0004'],
      // ≥ 1e-5 → 5 decimais
      [0.00009, '0.00009'],
      // ≥ 1e-7 → 7 decimais
      [0.0000001, '0.0000001'],
      // < 1e-8 → notação científica
      [1e-9, '1.00e-9'],
      [1.234e-12, '1.23e-12'],
    ])('formatNum(%p) === %p', (input, expected) => {
      expect(formatNum(input)).toBe(expected);
    });

    it('valores ≥ 1 mantêm 2 casas fixas (sem trim)', () => {
      // Mantém visual "humano" na faixa principal de leitura.
      expect(formatNum(1.5)).toBe('1.50');
      expect(formatNum(1.0)).toBe('1.00');
    });

    it('zero exato continua "0.00" (sem virar científica)', () => {
      expect(formatNum(0)).toBe('0.00');
    });

    it('formato preserva sinal pra negativos pequenos', () => {
      expect(formatNum(-0.005)).toBe('-0.005');
    });
  });

  describe('locale awareness (1.000–9.999)', () => {
    it('locale en usa vírgula como separador de milhar', () => {
      expect(formatNum(1234, 'en')).toBe('1,234');
      expect(formatNum(9999, 'en')).toBe('9,999');
    });

    it('locale en-US idem', () => {
      expect(formatNum(1234, 'en-US')).toBe('1,234');
    });

    it('locale pt-BR (default explícito) usa ponto', () => {
      expect(formatNum(1234, 'pt-BR')).toBe('1.234');
    });

    it('faixas abaixo de 1.000 ignoram locale (fixed decimals)', () => {
      // 5.43 é toFixed(2) — ponto sempre, independente de locale.
      expect(formatNum(5.4271, 'en')).toBe('5.43');
      expect(formatNum(5.4271, 'pt-BR')).toBe('5.43');
    });

    it('sufixos K/M/B/etc também são fixos (toFixed), independente de locale', () => {
      expect(formatNum(12345, 'en')).toBe('12.35\u00a0K');
      expect(formatNum(12345, 'pt-BR')).toBe('12.35\u00a0K');
    });
  });
});

describe('formatInt', () => {
  it.each([
    [0, '0'],
    [1234, '1.234'],
    [12345, '12.35\u00a0K'],
    [-1234, '-1.234'],
  ])('formatInt(%p) === %p', (input, expected) => {
    expect(formatInt(input)).toBe(expected);
  });

  it('coerce null para 0', () => {
    expect(formatInt(null)).toBe('0');
  });

  it('respeita locale en pra separador de milhar', () => {
    expect(formatInt(1234, 'en')).toBe('1,234');
    expect(formatInt(1234, 'pt-BR')).toBe('1.234');
  });
});
