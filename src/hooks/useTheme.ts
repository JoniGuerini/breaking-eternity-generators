import { useCallback, useEffect, useState } from 'react';

/**
 * Tema visual da aplicação.
 *
 * Aplicado em runtime via `<html data-theme="light|dark">`. O dark é
 * o default (correspondente ao bloco `:root` em tokens.css); o light
 * é definido pelo seletor `[data-theme="light"]`.
 *
 * Persistência: localStorage, chave `breaking_eternity_theme_v1`.
 *  - Chave nova (não compartilha com saves do jogo) pra evitar conflitos.
 *  - Versionada por convenção, igual aos saves.
 *
 * Sem auto-detect via `prefers-color-scheme`: a escolha aqui é manual,
 * por decisão do usuário.
 */
export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'breaking_eternity_theme_v1';
const DEFAULT_THEME: Theme = 'dark';

/** Lê o tema persistido. Fallback pro default se ausente/inválido. */
export function loadStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    // Ambientes sem localStorage (sandbox, modo privado): usa default.
  }
  return DEFAULT_THEME;
}

/** Aplica o tema no `<html>` e persiste. Operação síncrona, sem React. */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // Remove o atributo no dark pra deixar `:root` (default) ditar a paleta.
    // Isso mantém o CSS limpo e simétrico — `data-theme="dark"` seria
    // redundante.
    root.removeAttribute('data-theme');
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Silencioso — sandbox/privado.
  }
}

/**
 * Hook de tema. Mantém o estado em React e sincroniza com `<html>` +
 * localStorage. Retorna `theme`, `setTheme(theme)` e `toggle()`.
 */
export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => loadStoredTheme());

  // Aplica o tema inicial (e qualquer mudança subsequente) no DOM.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggle };
}
