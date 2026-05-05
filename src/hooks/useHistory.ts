import { useSyncExternalStore } from 'react';
import {
  getHistorySnapshot,
  getHistoryVersion,
  subscribeHistory,
  type HistoryEvent,
} from '../game/history';

/**
 * Hook que expõe o array atual de eventos do histórico, re-renderizando
 * o componente sempre que o histórico muda.
 *
 * Usa `useSyncExternalStore` (React 18+) — a API canônica pra integrar
 * stores externos com o ciclo de vida do React. O snapshot retorna uma
 * referência estável enquanto não houver mutações, evitando re-renders
 * desnecessários.
 *
 * Retornamos a tupla `[events, version]` pra que callers possam usar
 * `version` em useMemo deps quando precisar derivar valores filtrados/
 * agrupados.
 */
export function useHistory(): readonly HistoryEvent[] {
  return useSyncExternalStore(subscribeHistory, getHistorySnapshot, getHistorySnapshot);
}

/** Variante que retorna apenas a `version` — útil pra deps de useMemo. */
export function useHistoryVersion(): number {
  return useSyncExternalStore(subscribeHistory, getHistoryVersion, getHistoryVersion);
}
