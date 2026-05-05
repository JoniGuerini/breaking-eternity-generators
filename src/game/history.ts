import Decimal from 'break_eternity.js';

/**
 * Sistema de histórico (log) do jogo.
 *
 * Filosofia:
 *   - Vive FORA da Zustand store principal pra não poluir o tick state.
 *   - É um array imutável-ish (push-only) com um `version` próprio que o
 *     React subscreve via hook (similar ao `tick` do jogo).
 *   - Persiste junto com o save, sem cap. Avisamos no console se passar
 *     de uma marca razoável (5000) — o usuário escolheu "sem limite",
 *     mas não queremos surpreender com saves de 10 MB silenciosamente.
 *
 * Agregação:
 *   Compras de gerador/melhoria via press-and-hold viram dezenas de
 *   eventos por segundo. Pra não inflar o log, usamos uma janela de
 *   "merge" curtíssima (300ms): se o último evento for do mesmo tipo
 *   e mesmo `genId` dentro da janela, somamos `count` e `cost` em vez
 *   de empilhar.
 *
 *   Importante: a janela é fixada no LAST event timestamp (não no
 *   primeiro), então um hold contínuo continua agregando indefinidamente
 *   na MESMA entrada. Se o usuário soltar e re-clicar passados 500ms,
 *   uma nova entrada aparece — preserva intuição de "ações distintas".
 */

/* ─────────── Tipos ─────────── */

export type HistoryEventKind =
  | 'generator_bought'
  | 'upgrade_bought'
  | 'generator_unlocked'
  | 'offline_gain'
  | 'save_start';

export interface HistoryEventBase {
  /** Identificador único pra React keys. */
  id: string;
  /** Timestamp wall-clock (ms desde epoch). */
  ts: number;
  kind: HistoryEventKind;
}

export interface GeneratorBoughtEvent extends HistoryEventBase {
  kind: 'generator_bought';
  /** ID do gerador (1-based). */
  genId: number;
  /** Quantas unidades foram compradas neste evento (após agregação). */
  count: number;
  /** Custo total acumulado (Decimal serializado como string). */
  totalCost: string;
}

export interface UpgradeBoughtEvent extends HistoryEventBase {
  kind: 'upgrade_bought';
  genId: number;
  /** Nível antes da primeira compra do burst (informativo). */
  fromLevel: number;
  /** Nível depois das compras do burst. */
  toLevel: number;
  totalCost: string;
}

export interface GeneratorUnlockedEvent extends HistoryEventBase {
  kind: 'generator_unlocked';
  genId: number;
}

export interface OfflineGainEvent extends HistoryEventBase {
  kind: 'offline_gain';
  /** Segundos de offline (wall clock). */
  elapsedSeconds: number;
  /** Recurso ganho durante o offline (Decimal serializado). */
  resourceGained: string;
}

/**
 * Marca o início de uma partida — seja uma partida nova (sem save prévio)
 * ou um restart logo após `clearHistory()` num reset. É sempre o PRIMEIRO
 * evento do log; serve de âncora cronológica pro jogador ler "esta sessão
 * começou em ..." sem precisar abrir uma tela separada.
 */
export interface SaveStartEvent extends HistoryEventBase {
  kind: 'save_start';
  /** Se este save_start foi gerado por um reset manual (true) ou pelo
   *  primeiro boot do jogo (false). Útil pra UI distinguir. */
  fromReset: boolean;
}

export type HistoryEvent =
  | GeneratorBoughtEvent
  | UpgradeBoughtEvent
  | GeneratorUnlockedEvent
  | OfflineGainEvent
  | SaveStartEvent;

/* ─────────── Estado ─────────── */

/**
 * Janela de agregação em ms. Compras feitas dentro deste intervalo do
 * último evento "mergeable" (mesmo tipo + mesmo genId) somam ao último
 * em vez de criar uma nova entrada.
 *
 * 350ms cobre o `fastIntervalMs` (67ms) do hold com folga, e ainda é
 * curto o suficiente pra não confundir cliques distintos.
 */
const MERGE_WINDOW_MS = 350;

/** Soft cap acima do qual logamos um warning (apenas informativo). */
const SOFT_CAP_WARNING = 5000;

let events: HistoryEvent[] = [];

/** Versão monotônica — incrementa a cada mutação visível ao React. */
let version = 0;

const subscribers = new Set<() => void>();

/**
 * Notifica subscribers. Pra agregar, tipicamente atualizamos o último
 * evento (in-place) e bumpamos `version` — assim o React re-renderiza
 * sem precisar rebuild do array inteiro.
 */
function notify(): void {
  version += 1;
  for (const cb of subscribers) cb();
}

let warnedAboutCap = false;
function warnIfOverCap(): void {
  if (warnedAboutCap) return;
  if (events.length >= SOFT_CAP_WARNING) {
    warnedAboutCap = true;
    // Apenas informativo — usuário escolheu "sem limite".
    // eslint-disable-next-line no-console
    console.warn(
      `[history] mais de ${SOFT_CAP_WARNING} eventos acumulados (${events.length}). ` +
        'O save vai crescer proporcionalmente.',
    );
  }
}

/* ─────────── Subscription (React) ─────────── */

/**
 * `useSyncExternalStore`-friendly: chamar `subscribe(cb)` registra `cb`
 * pra ser notificado a cada mutação. Retorna função de unsubscribe.
 */
export function subscribeHistory(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** Snapshot estável (mesma referência enquanto não houver mutação). */
export function getHistorySnapshot(): readonly HistoryEvent[] {
  return events;
}

/** Versão atual — útil pra dependências de useEffect. */
export function getHistoryVersion(): number {
  return version;
}

/* ─────────── Helpers de adição ─────────── */

function makeId(): string {
  // Combina ts + random; suficiente pra unicidade de keys React num save.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Tenta agregar `incoming` no último evento se for "mergeable":
 *  - mesmo `kind`,
 *  - dentro da janela MERGE_WINDOW_MS,
 *  - chaves de identidade compatíveis (ex.: mesmo genId).
 *
 * Retorna o evento mesclado (cópia) se conseguiu agregar, ou `null` se
 * deve ser empurrado como novo. Não muta o array `events` — quem chama
 * é responsável por rebuildar.
 */
function tryMergeWithLast(incoming: HistoryEvent): HistoryEvent | null {
  const last = events[events.length - 1];
  if (!last) return null;
  if (last.kind !== incoming.kind) return null;
  if (incoming.ts - last.ts > MERGE_WINDOW_MS) return null;

  if (last.kind === 'generator_bought' && incoming.kind === 'generator_bought') {
    if (last.genId !== incoming.genId) return null;
    return {
      ...last,
      count: last.count + incoming.count,
      totalCost: new Decimal(last.totalCost).add(incoming.totalCost).toString(),
      ts: incoming.ts,
    };
  }

  if (last.kind === 'upgrade_bought' && incoming.kind === 'upgrade_bought') {
    if (last.genId !== incoming.genId) return null;
    return {
      ...last,
      toLevel: incoming.toLevel,
      totalCost: new Decimal(last.totalCost).add(incoming.totalCost).toString(),
      ts: incoming.ts,
    };
  }

  // Outros tipos (unlocked, reset, offline_gain) nunca mesclam — cada
  // um é uma ocorrência discreta digna de uma linha própria.
  return null;
}

/**
 * Adiciona evento (com possível agregação no último). SEMPRE substitui
 * `events` por um novo array — `useSyncExternalStore` compara snapshots
 * por `Object.is`, então mutar in-place não bastaria pra disparar
 * re-render.
 */
function append(event: HistoryEvent): void {
  const merged = tryMergeWithLast(event);
  if (merged) {
    // Substitui SÓ o último elemento, mas como é um novo array a
    // identidade muda e o React percebe.
    events = [...events.slice(0, -1), merged];
  } else {
    events = [...events, event];
    warnIfOverCap();
  }
  notify();
}

/* ─────────── API pública (chamada pelo store) ─────────── */

export function recordGeneratorBought(genId: number, cost: Decimal): void {
  append({
    id: makeId(),
    ts: Date.now(),
    kind: 'generator_bought',
    genId,
    count: 1,
    totalCost: cost.toString(),
  });
}

export function recordUpgradeBought(
  genId: number,
  fromLevel: number,
  cost: Decimal,
): void {
  append({
    id: makeId(),
    ts: Date.now(),
    kind: 'upgrade_bought',
    genId,
    fromLevel,
    toLevel: fromLevel + 1,
    totalCost: cost.toString(),
  });
}

export function recordGeneratorUnlocked(genId: number): void {
  append({
    id: makeId(),
    ts: Date.now(),
    kind: 'generator_unlocked',
    genId,
  });
}

export function recordOfflineGain(elapsedSeconds: number, resourceGained: Decimal): void {
  append({
    id: makeId(),
    ts: Date.now(),
    kind: 'offline_gain',
    elapsedSeconds,
    resourceGained: resourceGained.toString(),
  });
}

export function recordSaveStart(fromReset: boolean): void {
  append({
    id: makeId(),
    ts: Date.now(),
    kind: 'save_start',
    fromReset,
  });
}

/* ─────────── Persistência ─────────── */

export function serializeHistory(): HistoryEvent[] {
  // Os eventos JÁ estão em forma serializável (Decimals viraram strings na
  // hora do append). Retornar uma cópia rasa pra defensividade.
  return events.slice();
}

/**
 * Aceita o que veio do save e reidrata. Filtra eventos malformados pra
 * não quebrar a UI por causa de save corrompido.
 */
export function loadHistory(raw: unknown): void {
  if (!Array.isArray(raw)) {
    events = [];
    notify();
    return;
  }
  const valid: HistoryEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const ev = item as Partial<HistoryEvent>;
    if (typeof ev.id !== 'string' || typeof ev.ts !== 'number') continue;
    if (typeof ev.kind !== 'string') continue;
    // Aceita os kinds conhecidos. Eventos de tipos desconhecidos (ex.:
    // save de uma versão futura aberta numa antiga) são ignorados em vez
    // de derrubar a aplicação.
    switch (ev.kind) {
      case 'generator_bought':
      case 'upgrade_bought':
      case 'generator_unlocked':
      case 'offline_gain':
      case 'save_start':
        valid.push(item as HistoryEvent);
        break;
      default:
        break;
    }
  }
  events = valid;
  warnedAboutCap = false;
  warnIfOverCap();
  notify();
}

/** Limpa todo o histórico — usado no reset de progresso. */
export function clearHistory(): void {
  events = [];
  warnedAboutCap = false;
  notify();
}
