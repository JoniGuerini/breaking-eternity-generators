import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';
import { ThemePaletteButton } from './ThemePaletteButton';

interface AppSidebarProps {
  onRequestReset: () => void;
  onRequestThemeSelect: () => void;
  onRequestUpgrades: () => void;
  onRequestHistory: () => void;
}

/**
 * Sidebar fixa no canto superior esquerdo da viewport.
 * Contém o branding (título + subtítulo) e os botões de menu (reset,
 * melhorias, histórico).
 *
 * Em telas estreitas (≤ 1480px) o CSS reposiciona como bloco normal no
 * topo do conteúdo principal — comportamento de "empilhar" pra não cortar.
 */
export function AppSidebar({
  onRequestReset,
  onRequestThemeSelect,
  onRequestUpgrades,
  onRequestHistory,
}: AppSidebarProps) {
  const { t } = useTranslation();
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__top">
        <h1 className="app-sidebar__title">{t('app.title')}</h1>
        <div className="app-sidebar__subtitle">{t('app.subtitle')}</div>
        <div className="app-sidebar__menu">
          <button
            type="button"
            className="btn btn--link btn--link-danger app-sidebar__menu-item"
            onClick={onRequestReset}
            aria-label={t('actions.resetAriaLabel')}
          >
            ↺ {t('actions.reset')}
          </button>
          <button
            type="button"
            className="btn btn--link app-sidebar__menu-item"
            onClick={onRequestUpgrades}
            aria-label={t('upgrades.openAriaLabel')}
          >
            ✦ {t('upgrades.open')}
          </button>
          <button
            type="button"
            className="btn btn--link app-sidebar__menu-item"
            onClick={onRequestHistory}
            aria-label={t('history.openAriaLabel')}
          >
            ☰ {t('history.open')}
          </button>
        </div>
      </div>
      <div className="app-sidebar__footer">
        <span className="app-sidebar__version">{t('app.version')}</span>
        <LanguageToggle />
        <ThemePaletteButton onClick={onRequestThemeSelect} />
      </div>
    </aside>
  );
}
