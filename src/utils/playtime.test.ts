import { describe, expect, it } from 'vitest';
import { formatPlaytime, getPlaytimeSeconds } from './playtime';

describe('formatPlaytime', () => {
  it('valores zero/negativos/inválidos viram "0s"', () => {
    expect(formatPlaytime(0)).toBe('0s');
    expect(formatPlaytime(-10)).toBe('0s');
    expect(formatPlaytime(NaN)).toBe('0s');
    expect(formatPlaytime(Infinity)).toBe('0s');
  });

  it('apenas segundos quando < 1 minuto', () => {
    expect(formatPlaytime(1)).toBe('1s');
    expect(formatPlaytime(45)).toBe('45s');
    expect(formatPlaytime(59)).toBe('59s');
  });

  it('promove para minutos a partir de 60s', () => {
    expect(formatPlaytime(60)).toBe('1m 0s');
    expect(formatPlaytime(125)).toBe('2m 5s');
    expect(formatPlaytime(3599)).toBe('59m 59s');
  });

  it('horas + minutos (segundos somem)', () => {
    expect(formatPlaytime(3600)).toBe('1h 0m');
    expect(formatPlaytime(3725)).toBe('1h 2m');
    expect(formatPlaytime(86399)).toBe('23h 59m');
  });

  it('dias + horas', () => {
    expect(formatPlaytime(86400)).toBe('1d 0h');
    expect(formatPlaytime(90061)).toBe('1d 1h');
    expect(formatPlaytime(604799)).toBe('6d 23h');
  });

  it('semanas + dias', () => {
    expect(formatPlaytime(604800)).toBe('1w 0d');
    expect(formatPlaytime(604800 + 86400 * 3)).toBe('1w 3d');
  });

  it('meses + semanas (mês = 4w)', () => {
    const monthInSeconds = 604800 * 4;
    expect(formatPlaytime(monthInSeconds)).toBe('1mo 0w');
    expect(formatPlaytime(monthInSeconds + 604800 * 2)).toBe('1mo 2w');
  });

  it('anos + meses', () => {
    const yearInSeconds = 604800 * 4 * 12;
    expect(formatPlaytime(yearInSeconds)).toBe('1y 0mo');
    expect(formatPlaytime(yearInSeconds * 2 + 604800 * 4 * 3)).toBe('2y 3mo');
  });

  it('décadas, séculos e milênios', () => {
    const yearInSeconds = 604800 * 4 * 12;
    expect(formatPlaytime(yearInSeconds * 10)).toBe('1dec 0y');
    expect(formatPlaytime(yearInSeconds * 100)).toBe('1c 0dec');
    expect(formatPlaytime(yearInSeconds * 1000)).toBe('1mil 0c');
  });
});

describe('getPlaytimeSeconds', () => {
  it('retorna diferença em segundos floor', () => {
    expect(getPlaytimeSeconds(1000, 5500)).toBe(4);
    expect(getPlaytimeSeconds(1000, 1999)).toBe(0);
    expect(getPlaytimeSeconds(1000, 2000)).toBe(1);
  });

  it('nunca retorna negativo se now < startedAt (relógio voltou)', () => {
    expect(getPlaytimeSeconds(5000, 1000)).toBe(0);
  });
});
