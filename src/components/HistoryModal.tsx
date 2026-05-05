import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Decimal from 'break_eternity.js';
import type { HistoryEvent } from '../game/history';
import { useHistory } from '../hooks/useHistory';
import { formatNum } from '../utils/format';
import { formatPlaytime } from '../utils/playtime';

/** Threshold (10^tier) como Decimal — usado pra renderizar marcos no log. */
function thresholdValue(tier: number): Decimal {
  return new Decimal(10).pow(tier);
}

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Filtros disponíveis na UI. `all` é o default; os demais correspondem
 * a um único `kind` (ou um agrupamento pequeno no caso de `system`).
 *
 * Compras de gerador e compras de melhoria viraram filtros distintos
 * porque ações diferentes do jogador, mesmo que ambas sejam "comprar
 * algo", merecem leitura separada.
 */
type Filter = 'all' | 'purchases' | 'upgrades' | 'milestones' | 'unlocks' | 'system';

/**
 * Modal de histórico — full-screen, mesma variante visual do modal de
 * melhorias (`.modal--upgrades`). Lista cronológica reversa (mais
 * recente no topo) com chips de filtro no cabeçalho.
 *
 * Decisões:
 *   - Sem virtualização. O log é potencialmente grande (sem cap), mas
 *     `content-visibility: auto` nos itens cuida do custo de paint
 *     offscreen, e a lista raramente passa de algumas centenas pra um
 *     jogador real numa sessão.
 *   - Tempo relativo é re-calculado a cada render do modal (que é
 *     raro — só quando o usuário interage). Sem timer interno: se o
 *     modal está fechado, nem dá pra perceber o tempo "envelhecendo".
 */
export function HistoryModal({ open, onClose }: HistoryModalProps) {
  const { t, i18n } = useTranslation();
  const events = useHistory();
  const [filter, setFilter] = useState<Filter>('all');
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  /*
   * Auto-scroll estilo chat:
   *
   *  1. Ao abrir o modal, rola até o fim (mensagem mais recente).
   *  2. Quando uma mensagem nova chega E o usuário estava PERTO do fim,
   *     rola pra acompanhar. Se ele rolou pra cima pra ler entradas
   *     antigas, NÃO interrompe a leitura.
   *
   * "Perto do fim" = `scrollHeight - scrollTop - clientHeight < 80px`.
   * 80px de tolerância é o padrão de muitos chats — cobre 1-2 linhas de
   * "almost at the bottom" sem forçar quando o usuário voltou pro topo.
   */
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    // Usar `scrollHeight` AQUI (não setar 0): scrollTop = scrollHeight
    // significa "todo o conteúdo está acima do viewport" → ancora no fim.
    el.scrollTop = el.scrollHeight;
  }, [open]);

  // Auto-scroll incremental — depende do COMPRIMENTO de events, não do
  // array em si. Assim só dispara quando há mensagem nova, não quando
  // só re-renderizamos por causa do tick (filtro/refresh do React).
  const eventsLength = events.length;
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 80) {
      el.scrollTop = el.scrollHeight;
    }
  }, [open, eventsLength]);

  // Aplica filtro mantendo a ordem cronológica NATURAL (mais antiga
  // primeiro). A inversão visual fica por conta do CSS — usamos
  // `flex-direction: column-reverse` na lista. Esse padrão é o truque
  // clássico de "chat-style scroll": o navegador ancora o scroll no
  // FIM por padrão e auto-segue novas mensagens enquanto o usuário
  // estiver perto do final.
  const visible = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((ev) => matchesFilter(ev, filter));
  }, [events, filter]);

  if (!open) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="modal-backdrop modal-backdrop--upgrades"
      onClick={handleBackdropClick}
    >
      <div
        className="modal modal--upgrades"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
      >
        <header className="upgrades-modal__head">
          <div>
            <h2 className="modal-title" id="history-modal-title">
              {t('history.modalTitle')}
            </h2>
            <p className="upgrades-modal__subtitle">
              {t('history.modalBody')}
            </p>
          </div>
          <button
            type="button"
            className="upgrades-modal__close"
            onClick={onClose}
            aria-label={t('history.closeAriaLabel')}
          >
            ×
          </button>
        </header>

        <div className="history-filters" role="tablist" aria-label={t('history.filtersAriaLabel')}>
          <FilterChip current={filter} value="all" onSelect={setFilter} label={t('history.filters.all')} />
          <FilterChip current={filter} value="purchases" onSelect={setFilter} label={t('history.filters.purchases')} />
          <FilterChip current={filter} value="upgrades" onSelect={setFilter} label={t('history.filters.upgrades')} />
          <FilterChip current={filter} value="milestones" onSelect={setFilter} label={t('history.filters.milestones')} />
          <FilterChip current={filter} value="unlocks" onSelect={setFilter} label={t('history.filters.unlocks')} />
          <FilterChip current={filter} value="system" onSelect={setFilter} label={t('history.filters.system')} />
        </div>

        <div
          ref={contentRef}
          className="upgrades-modal__content history-modal__content"
        >
          {visible.length === 0 ? (
            <p className="upgrades-modal__empty">{t('history.empty')}</p>
          ) : (
            <ul className="history-list">
              {visible.map((ev) => (
                <HistoryRow key={ev.id} event={ev} locale={i18n.language} t={t} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Filter logic ─────────── */

function matchesFilter(ev: HistoryEvent, filter: Filter): boolean {
  switch (filter) {
    case 'purchases':
      return ev.kind === 'generator_bought';
    case 'upgrades':
      return ev.kind === 'upgrade_bought';
    case 'milestones':
      return ev.kind === 'milestone_claimed';
    case 'unlocks':
      return ev.kind === 'generator_unlocked';
    case 'system':
      return ev.kind === 'save_start' || ev.kind === 'offline_gain';
    default:
      return true;
  }
}

/* ─────────── Subcomponents ─────────── */

interface FilterChipProps {
  current: Filter;
  value: Filter;
  onSelect: (next: Filter) => void;
  label: string;
}

function FilterChip({ current, value, onSelect, label }: FilterChipProps) {
  const active = current === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`history-chip${active ? ' is-active' : ''}`}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  );
}

interface HistoryRowProps {
  event: HistoryEvent;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

/**
 * Linha de um evento do histórico — visual de log textual (sem ícones,
 * sem cards). A categoria é comunicada por COR do título; o tempo
 * relativo fica à direita pra leitura cronológica.
 */
function HistoryRow({ event, locale, t }: HistoryRowProps) {
  const summary = describeEvent(event, locale, t);
  return (
    <li className={`history-row history-row--${event.kind}`}>
      <div className="history-row__main">
        <span className="history-row__title">{summary.title}</span>
        {summary.detail && (
          <span className="history-row__detail">{summary.detail}</span>
        )}
      </div>
      <span className="history-row__time">{relativeTime(event.ts, t)}</span>
    </li>
  );
}

/* ─────────── Description builders ─────────── */

interface EventSummary {
  title: string;
  detail: string | null;
}

function describeEvent(
  ev: HistoryEvent,
  locale: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): EventSummary {
  switch (ev.kind) {
    case 'generator_bought': {
      const genName = t('generator.name', { id: ev.genId });
      const title =
        ev.count > 1
          ? t('history.events.generatorBoughtMany', { count: ev.count, gen: genName })
          : t('history.events.generatorBoughtOne', { gen: genName });
      return {
        title,
        detail: t('history.events.spent', {
          amount: formatNum(ev.totalCost, locale),
        }),
      };
    }
    case 'upgrade_bought': {
      const genName = t('generator.name', { id: ev.genId });
      const levels = ev.toLevel - ev.fromLevel;
      const title =
        levels > 1
          ? t('history.events.upgradeBoughtMany', {
              count: levels,
              gen: genName,
              level: ev.toLevel,
            })
          : t('history.events.upgradeBoughtOne', {
              gen: genName,
              level: ev.toLevel,
            });
      // Custo agora é em PM, não Recurso Base — usa a chave `spentPm`.
      return {
        title,
        detail: t('history.events.spentPm', {
          amount: formatNum(ev.totalCost, locale),
        }),
      };
    }
    case 'generator_unlocked': {
      const genName = t('generator.name', { id: ev.genId });
      return {
        title: t('history.events.generatorUnlocked', { gen: genName }),
        detail: null,
      };
    }
    case 'milestone_claimed': {
      const genName = t('generator.name', { id: ev.genId });
      const tiers = ev.toTier - ev.fromTier;
      // 1 tier → "Gen N atingiu 100"; >1 → "Gen N atingiu marcos 2-4"
      const title =
        tiers > 1
          ? t('history.events.milestoneClaimedMany', {
              gen: genName,
              from: ev.fromTier + 1,
              to: ev.toTier,
            })
          : t('history.events.milestoneClaimedOne', {
              gen: genName,
              threshold: formatNum(thresholdValue(ev.toTier), locale),
            });
      return {
        title,
        detail: t('history.events.milestoneReward', { count: tiers }),
      };
    }
    case 'offline_gain': {
      const playtime = formatPlaytime(ev.elapsedSeconds, {
        unitLabels: {
          s: t('playtime.units.seconds'),
          m: t('playtime.units.minutes'),
          h: t('playtime.units.hours'),
          d: t('playtime.units.days'),
          w: t('playtime.units.weeks'),
          mo: t('playtime.units.months'),
          y: t('playtime.units.years'),
          dec: t('playtime.units.decades'),
          c: t('playtime.units.centuries'),
          mil: t('playtime.units.millennia'),
        },
        zero: t('playtime.zero'),
      });
      return {
        title: t('history.events.offlineGain', { duration: playtime }),
        detail: t('history.events.gained', {
          amount: formatNum(ev.resourceGained, locale),
        }),
      };
    }
    case 'save_start': {
      return {
        title: ev.fromReset
          ? t('history.events.saveStartReset')
          : t('history.events.saveStartFresh'),
        detail: null,
      };
    }
  }
}

/* ─────────── Relative time ─────────── */

/**
 * Tempo relativo curto, em estilo "há X" — pt-BR e en têm regras
 * próprias na i18n. Granularidade: agora (< 5s), Ns (< 60s), Nmin
 * (< 60min), Nh (< 24h), Nd (resto).
 */
function relativeTime(
  ts: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);

  if (sec < 5) return t('history.relative.now');
  if (sec < 60) return t('history.relative.seconds', { count: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t('history.relative.minutes', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('history.relative.hours', { count: hr });
  const days = Math.floor(hr / 24);
  return t('history.relative.days', { count: days });
}
