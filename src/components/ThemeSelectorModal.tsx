import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CLASSIC_THEMES,
  COLLECTION_THEMES,
  THEME_SWATCHES,
  useTheme,
  type Theme,
} from '../hooks/useTheme';

interface ThemeSelectorModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de seleção de tema visual.
 *
 * Reutiliza o esqueleto de `ResetModal` (mesma estrutura backdrop+card,
 * fechamento por ESC e clique no backdrop). O conteúdo é uma grade de
 * `ThemeCard`s — cada card mostra uma amostra da paleta com o nome do
 * tema, e selecionar um aplica imediatamente.
 *
 * Diferente do reset, este modal não tem ação destrutiva: clicar num
 * card já confirma e fecha. O cancelar (ESC/backdrop) só descarta a
 * intenção sem alterar o tema atual.
 */
export function ThemeSelectorModal({ open, onClose }: ThemeSelectorModalProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSelect(next: Theme) {
    setTheme(next);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal modal--theme"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-modal-title"
      >
        <h2 className="modal-title" id="theme-modal-title">
          {t('modal.themeTitle')}
        </h2>
        <p className="modal-body">{t('modal.themeBody')}</p>
        {/* Conteúdo rolável: em viewports pequenas o modal não cabe inteiro
            sem scroll externo no body (que está desligado), então o scroll
            vira interno do próprio container de seções. */}
        <div className="theme-modal__content">
          <ThemeSection
            label={t('theme.sectionClassic')}
            themes={CLASSIC_THEMES}
            currentTheme={theme}
            onSelect={handleSelect}
          />
          <ThemeSection
            label={t('theme.sectionCollection')}
            themes={COLLECTION_THEMES}
            currentTheme={theme}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}

interface ThemeSectionProps {
  label: string;
  themes: readonly Theme[];
  currentTheme: Theme;
  onSelect: (theme: Theme) => void;
}

/**
 * Seção horizontal do seletor (rótulo + grade de cards). Existem duas:
 *   - "Clássicos": 2 cards (Dark, Light), em destaque acima.
 *   - "Coleção": demais temas, com identidade individual.
 *
 * O rótulo é discreto (sem fundo, só uppercase pequeno), pra não competir
 * com o título do modal. Visualmente seções idênticas — a importância dos
 * clássicos vem só da posição (topo) e do nome.
 */
function ThemeSection({ label, themes, currentTheme, onSelect }: ThemeSectionProps) {
  return (
    <section className="theme-section">
      <h3 className="theme-section__label">{label}</h3>
      <div className="theme-grid">
        {themes.map((id) => (
          <ThemeCard
            key={id}
            themeId={id}
            isCurrent={id === currentTheme}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

interface ThemeCardProps {
  themeId: Theme;
  isCurrent: boolean;
  onSelect: (theme: Theme) => void;
}

/**
 * Card de tema individual — exibe paleta + nome, e seleciona ao clicar.
 *
 * O preview tenta evocar o "feel" do tema sem reproduzir a UI inteira:
 *  - Bloco grande de fundo (`bg`).
 *  - Mini-card sobreposto (`bg-card`) com texto curto (`text`).
 *  - Strip de swatches inline (accent + danger) pra mostrar as cores
 *    de identidade.
 *
 * Quando o card representa o tema atual, recebe `is-current` que adiciona
 * a borda de acento e exibe a etiqueta "Atual".
 */
function ThemeCard({ themeId, isCurrent, onSelect }: ThemeCardProps) {
  const { t } = useTranslation();
  const swatches = THEME_SWATCHES[themeId];
  const name = t(`theme.names.${themeId}`);
  const description = t(`theme.descriptions.${themeId}`);

  return (
    <button
      type="button"
      className={`theme-card${isCurrent ? ' is-current' : ''}`}
      onClick={() => onSelect(themeId)}
      aria-label={t('theme.selectAriaLabel', { name })}
      aria-pressed={isCurrent}
    >
      {/*
       * Preview: bloco com cor de fundo do tema + um mini-card sobreposto
       * imitando o card de gerador. Evoca a UI sem ser literal.
       */}
      <div
        className="theme-card__preview"
        style={{ backgroundColor: swatches.bg }}
      >
        <div
          className="theme-card__preview-card"
          style={{
            backgroundColor: swatches.bgCard,
            color: swatches.text,
          }}
        >
          <span
            className="theme-card__preview-label"
            style={{ color: swatches.text, opacity: 0.55 }}
          >
            Aa
          </span>
          <span
            className="theme-card__preview-accent"
            style={{ backgroundColor: swatches.accent }}
            aria-hidden="true"
          />
        </div>
        <div className="theme-card__swatches" aria-hidden="true">
          <span
            className="theme-card__swatch"
            style={{ backgroundColor: swatches.bg, borderColor: swatches.text }}
          />
          <span
            className="theme-card__swatch"
            style={{ backgroundColor: swatches.bgCard, borderColor: swatches.text }}
          />
          <span
            className="theme-card__swatch"
            style={{ backgroundColor: swatches.accent }}
          />
          <span
            className="theme-card__swatch"
            style={{ backgroundColor: swatches.danger }}
          />
        </div>
      </div>
      <div className="theme-card__meta">
        <div className="theme-card__name-row">
          <span className="theme-card__name">{name}</span>
          {isCurrent && (
            <span className="theme-card__badge">{t('theme.current')}</span>
          )}
        </div>
        <div className="theme-card__description">{description}</div>
      </div>
    </button>
  );
}
