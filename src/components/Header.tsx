import { ResourceDisplay } from './ResourceDisplay';

/**
 * Cabeçalho da coluna principal — agora apenas o bloco de Recurso Base.
 *
 * O título do jogo e o botão de reiniciar foram movidos pro `<AppSidebar />`
 * fixo no canto superior esquerdo da viewport.
 */
export function Header() {
  return (
    <header>
      <ResourceDisplay />
    </header>
  );
}
