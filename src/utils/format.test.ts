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
});
