import { useTranslation } from 'react-i18next';

interface ThemePaletteButtonProps {
  onClick: () => void;
}

/**
 * Botão de paleta na sidebar — abre o `ThemeSelectorModal`.
 *
 * Substitui o antigo `ThemeToggle` (sol/lua) agora que dark e light são
 * só 2 entre 5 temas. Ícone de "paleta de cores" comunica que existem
 * múltiplas opções, não só duas.
 *
 * O ícone é SVG inline — coerente com o resto da app (LanguageToggle
 * usa texto puro, ThemeToggle antigo usava SVG inline também).
 *
 * Reaproveita as classes `.theme-toggle` (que já tinham hover/active
 * neutros) pra manter alinhamento visual com o LanguageToggle e o
 * version label.
 */
export function ThemePaletteButton({ onClick }: ThemePaletteButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onClick}
      aria-label={t('theme.openSelector')}
      title={t('theme.openSelector')}
    >
      <PaletteIcon />
    </button>
  );
}

/**
 * Ícone de paleta de pintor — círculo com 4 "tintas" (gotas) ao redor.
 * Stroke `currentColor` pra herdar a cor do botão (responde ao tema).
 *
 * Mantemos 14px pra alinhar com os ícones e textos do footer da sidebar.
 */
function PaletteIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Forma da paleta: oval levemente irregular com um "buraco" pro polegar.
          Usamos um path único pra parecer orgânico, não geométrico. */}
      <path d="M12 3a9 9 0 0 0 0 18 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 1 2-4h1.5A3.5 3.5 0 0 0 21 9.5C21 5.36 16.97 3 12 3Z" />
      {/* As "tintas" — círculos pequenos representando cores diferentes. */}
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}
