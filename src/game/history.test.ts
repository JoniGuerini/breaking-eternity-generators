import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Decimal from 'break_eternity.js';
import {
  clearHistory,
  getHistorySnapshot,
  loadHistory,
  recordGeneratorBought,
  recordGeneratorUnlocked,
  recordMilestoneClaimed,
  recordOfflineGain,
  recordSaveStart,
  recordUpgradeBought,
  serializeHistory,
  subscribeHistory,
} from './history';

/**
 * Cobre os pontos críticos:
 *  - Agregação dentro da janela (mesmo tipo + mesmo genId).
 *  - Agregação NÃO ocorre fora da janela ou entre tipos diferentes.
 *  - Snapshot muda de identidade a cada mutação (pra useSyncExternalStore).
 *  - Persistência aceita formato salvo e ignora corrompido.
 */

beforeEach(() => {
  clearHistory();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('history / agregação', () => {
  it('compras consecutivas do mesmo Gen mesclam num único evento', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    recordGeneratorBought(1, new Decimal(10));
    vi.advanceTimersByTime(100);
    recordGeneratorBought(1, new Decimal(15));
    vi.advanceTimersByTime(100);
    recordGeneratorBought(1, new Decimal(23));

    const events = getHistorySnapshot();
    expect(events.length).toBe(1);
    const ev = events[0];
    if (ev.kind !== 'generator_bought') throw new Error('kind incorreto');
    expect(ev.count).toBe(3);
    // Soma dos custos: 10 + 15 + 23 = 48
    expect(new Decimal(ev.totalCost).toNumber()).toBe(48);
  });

  it('compras de Gens DIFERENTES não mesclam', () => {
    recordGeneratorBought(1, new Decimal(10));
    recordGeneratorBought(2, new Decimal(20));
    expect(getHistorySnapshot().length).toBe(2);
  });

  it('compras fora da janela de merge não mesclam', () => {
    recordGeneratorBought(1, new Decimal(10));
    // Janela é 350ms — 1s passou, deve ser evento novo.
    vi.advanceTimersByTime(1000);
    recordGeneratorBought(1, new Decimal(15));
    expect(getHistorySnapshot().length).toBe(2);
  });

  it('upgrade_bought mescla preservando fromLevel original e atualizando toLevel', () => {
    recordUpgradeBought(1, 0, new Decimal(5));
    vi.advanceTimersByTime(50);
    recordUpgradeBought(1, 1, new Decimal(15));
    vi.advanceTimersByTime(50);
    recordUpgradeBought(1, 2, new Decimal(45));

    const events = getHistorySnapshot();
    expect(events.length).toBe(1);
    const ev = events[0];
    if (ev.kind !== 'upgrade_bought') throw new Error('kind incorreto');
    expect(ev.fromLevel).toBe(0); // Preserva o original
    expect(ev.toLevel).toBe(3); // Atualiza pra última compra
    expect(new Decimal(ev.totalCost).toNumber()).toBe(65);
  });

  it('eventos de tipos diferentes nunca mesclam, mesmo dentro da janela', () => {
    recordGeneratorBought(1, new Decimal(10));
    recordUpgradeBought(1, 0, new Decimal(5));
    expect(getHistorySnapshot().length).toBe(2);
  });

  it('unlock, save_start e offline_gain nunca mesclam', () => {
    recordGeneratorUnlocked(2);
    recordGeneratorUnlocked(2);
    recordSaveStart(false);
    recordSaveStart(true);
    recordOfflineGain(60, new Decimal(100));
    recordOfflineGain(60, new Decimal(100));

    expect(getHistorySnapshot().length).toBe(6);
  });
});

describe('history / snapshot identity', () => {
  it('cada mutação produz uma nova referência de array', () => {
    const before = getHistorySnapshot();
    recordGeneratorBought(1, new Decimal(10));
    const after = getHistorySnapshot();
    expect(after).not.toBe(before);
  });

  it('agregação também produz nova referência (pra useSyncExternalStore)', () => {
    recordGeneratorBought(1, new Decimal(10));
    const before = getHistorySnapshot();
    vi.advanceTimersByTime(50);
    recordGeneratorBought(1, new Decimal(20));
    const after = getHistorySnapshot();
    // Mesma length (mesclou), mas referência diferente.
    expect(after.length).toBe(before.length);
    expect(after).not.toBe(before);
  });

  it('subscribe recebe notificação a cada mutação', () => {
    const cb = vi.fn();
    const unsub = subscribeHistory(cb);

    recordGeneratorBought(1, new Decimal(10));
    expect(cb).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    recordGeneratorBought(1, new Decimal(20)); // mescla, ainda notifica
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
    recordGeneratorBought(2, new Decimal(50));
    // Não notifica após unsub.
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe('history / persistência', () => {
  it('serialize devolve cópia rasa (mutar não afeta o estado)', () => {
    recordGeneratorBought(1, new Decimal(10));
    const serialized = serializeHistory();
    expect(serialized.length).toBe(1);
    serialized.push({
      id: 'fake',
      ts: 0,
      kind: 'save_start',
      fromReset: false,
    });
    expect(getHistorySnapshot().length).toBe(1);
  });

  it('loadHistory aceita array serializado e reidrata', () => {
    recordGeneratorBought(1, new Decimal(10));
    recordSaveStart(true);
    const serialized = serializeHistory();

    clearHistory();
    expect(getHistorySnapshot().length).toBe(0);

    loadHistory(serialized);
    expect(getHistorySnapshot().length).toBe(2);
  });

  it('loadHistory ignora itens malformados sem quebrar', () => {
    const garbage = [
      null,
      'string solta',
      { foo: 'bar' }, // sem kind/id/ts
      { id: 'a', ts: 0, kind: 'tipo_inexistente' }, // kind desconhecido
      { id: 'b', ts: 1, kind: 'save_start', fromReset: false }, // válido
    ];
    loadHistory(garbage);
    const events = getHistorySnapshot();
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe('save_start');
  });

  it('loadHistory com não-array vira lista vazia', () => {
    loadHistory(null);
    expect(getHistorySnapshot().length).toBe(0);
    loadHistory(undefined);
    expect(getHistorySnapshot().length).toBe(0);
    loadHistory({ foo: 'bar' });
    expect(getHistorySnapshot().length).toBe(0);
  });

  it('clearHistory zera tudo', () => {
    recordGeneratorBought(1, new Decimal(10));
    recordSaveStart(true);
    expect(getHistorySnapshot().length).toBe(2);
    clearHistory();
    expect(getHistorySnapshot().length).toBe(0);
  });
});

describe('history / milestones', () => {
  it('marcos contíguos do mesmo gerador agregam', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    recordMilestoneClaimed(1, 1);
    vi.advanceTimersByTime(100);
    recordMilestoneClaimed(1, 2);
    vi.advanceTimersByTime(100);
    recordMilestoneClaimed(1, 3);

    const events = getHistorySnapshot();
    expect(events.length).toBe(1);
    const ev = events[0];
    if (ev.kind !== 'milestone_claimed') throw new Error('kind incorreto');
    expect(ev.fromTier).toBe(0);
    expect(ev.toTier).toBe(3);
  });

  it('marcos de geradores diferentes NÃO agregam', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    recordMilestoneClaimed(1, 1);
    vi.advanceTimersByTime(100);
    recordMilestoneClaimed(2, 1);
    expect(getHistorySnapshot().length).toBe(2);
  });

  it('marcos não-contíguos do mesmo gerador NÃO agregam', () => {
    // Gap defensivo — se algum bug fizer um tier ser pulado, queremos ver
    // duas linhas em vez de uma agregação enganosa.
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    recordMilestoneClaimed(1, 1);
    vi.advanceTimersByTime(100);
    recordMilestoneClaimed(1, 5);
    expect(getHistorySnapshot().length).toBe(2);
  });
});
