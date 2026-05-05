import { ResourceDisplay } from './ResourceDisplay';
import { UpgradePointsDisplay } from './UpgradePointsDisplay';

/**
 * Cabeçalho da coluna principal — bloco de Recurso Base com um chip
 * compacto de Pontos de Melhoria à direita.
 *
 * O título do jogo e o botão de reiniciar foram movidos pro `<AppSidebar />`
 * fixo no canto superior esquerdo da viewport.
 */
export function Header() {
  return (
    <header className="resource-block">
      <ResourceDisplay />
      <UpgradePointsDisplay />
    </header>
  );
}
