import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';
import { ThemePaletteButton } from './ThemePaletteButton';

interface AppSidebarProps {
  onRequestReset: () => void;
  onRequestThemeSelect: () => void;
}

/**
 * Sidebar fixa no canto superior esquerdo da viewport.
 * Contém o branding (título + subtítulo) e o botão de reiniciar progresso.
 *
 * Em telas estreitas (≤ 1100px) o CSS reposiciona como bloco normal no topo
 * do conteúdo principal — comportamento de "empilhar" pra não cortar.
 */
export function AppSidebar({ onRequestReset, onRequestThemeSelect }: AppSidebarProps) {
  const { t } = useTranslation();
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__top">
        <h1 className="app-sidebar__title">{t('app.title')}</h1>
        <div className="app-sidebar__subtitle">{t('app.subtitle')}</div>
        <button
          type="button"
          className="btn btn--link btn--link-danger app-sidebar__reset"
          onClick={onRequestReset}
          aria-label={t('actions.resetAriaLabel')}
        >
          ↺ {t('actions.reset')}
        </button>
      </div>
      <div className="app-sidebar__footer">
        <span className="app-sidebar__version">{t('app.version')}</span>
        <LanguageToggle />
        <ThemePaletteButton onClick={onRequestThemeSelect} />
      </div>
    </aside>
  );
}
