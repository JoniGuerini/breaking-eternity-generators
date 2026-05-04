import { ThemeToggle } from './ThemeToggle';

interface AppSidebarProps {
  onRequestReset: () => void;
}

/**
 * Sidebar fixa no canto superior esquerdo da viewport.
 * Contém o branding (título + subtítulo) e o botão de reiniciar progresso.
 *
 * Em telas estreitas (≤ 1100px) o CSS reposiciona como bloco normal no topo
 * do conteúdo principal — comportamento de "empilhar" pra não cortar.
 */
export function AppSidebar({ onRequestReset }: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__top">
        <h1 className="app-sidebar__title">Breaking Eternity</h1>
        <div className="app-sidebar__subtitle">Generators</div>
        <button
          type="button"
          className="btn btn--link btn--link-danger app-sidebar__reset"
          onClick={onRequestReset}
          aria-label="Reiniciar progresso"
        >
          ↺ Reiniciar
        </button>
      </div>
      <div className="app-sidebar__footer">
        <span className="app-sidebar__version">v0.1</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
