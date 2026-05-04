import { describe, expect, it } from 'vitest';
import { toRoman } from './roman';

describe('toRoman', () => {
  it.each([
    [1, 'I'],
    [2, 'II'],
    [3, 'III'],
    [4, 'IV'],
    [5, 'V'],
    [9, 'IX'],
    [10, 'X'],
    [40, 'XL'],
    [49, 'XLIX'],
    [90, 'XC'],
    [100, 'C'],
    [400, 'CD'],
    [500, 'D'],
    [900, 'CM'],
    [1000, 'M'],
    [3999, 'MMMCMXCIX'],
  ])('toRoman(%i) === %p', (input, expected) => {
    expect(toRoman(input)).toBe(expected);
  });

  it('fora do range volta pra decimal', () => {
    expect(toRoman(4000)).toBe('4000');
    expect(toRoman(99999)).toBe('99999');
  });

  it('zero ou negativo retorna "0"', () => {
    expect(toRoman(0)).toBe('0');
    expect(toRoman(-5)).toBe('0');
  });
});
