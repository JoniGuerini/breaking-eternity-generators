import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

/**
 * Botão de alternância entre dark e light.
 *
 * Mostra o ícone do MODO ATUAL (sol = light, lua = dark), seguindo a
 * convenção que o ícone reflete onde você ESTÁ, não onde irá. O `aria-label`
 * descreve a ação do clique (alternar pro outro modo) pra acessibilidade.
 *
 * Os ícones são SVG inline pra não dependermos de fonte de ícones nem
 * carregamento extra. Tamanho 14px combina com o footer da sidebar.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isLight ? t('theme.switchToDark') : t('theme.switchToLight')}
      title={isLight ? t('theme.lightLabel') : t('theme.darkLabel')}
    >
      {isLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

/**
 * Sol minimalista — círculo central + 8 raios curtos.
 * Stroke `currentColor` pra herdar a cor do botão (e responder ao tema).
 */
function SunIcon() {
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
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
      <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
      <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" />
      <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" />
    </svg>
  );
}

/**
 * Lua crescente — desenhada como um único path de meia-lua.
 * Mesmo stroke `currentColor` que o sol pra simetria visual.
 */
function MoonIcon() {
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
