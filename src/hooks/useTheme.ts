import { useCallback, useEffect, useState } from 'react';

/**
 * Tema visual da aplicação.
 *
 * Cinco temas disponíveis, todos definidos como blocos `[data-theme='...']`
 * em tokens.css. O default é `dark` (corresponde ao bloco `:root`); os
 * demais sobrescrevem variáveis quando aplicados em `<html>`.
 *
 * Persistência: localStorage, chave `breaking_eternity_theme_v1`.
 *  - Mesma chave usada antes (compatível com saves que persistiam só
 *    'dark'/'light').
 *  - Versionada por convenção, igual aos saves.
 *
 * Sem auto-detect via `prefers-color-scheme`: a escolha aqui é manual,
 * por decisão do usuário.
 */
export type Theme =
  | 'dark'
  | 'light'
  | 'midnight'
  | 'terracotta'
  | 'forest'
  | 'crimson'
  | 'glacier'
  | 'carbon'
  | 'lavender'
  | 'dune'
  | 'synthwave'
  | 'mono'
  | 'phosphor'
  | 'sepia';

/**
 * Os "clássicos": preto e branco. Apresentados em destaque no topo do seletor.
 *
 * Mesmo sendo apenas mais 2 entre os 12 temas, eles têm peso conceitual
 * diferente — são o "default sem firula" pra quem não quer perder tempo
 * escolhendo paleta. A separação visual no modal sinaliza isso.
 */
export const CLASSIC_THEMES: readonly Theme[] = ['dark', 'light'];

/**
 * A "coleção": variações temáticas com identidade própria. Cada uma
 * representa uma direção visual distinta (frio, quente, saturado, sóbrio,
 * etc.) — a ordem aqui é puramente estética (alterna humores frios e
 * quentes pra ficar agradável de varrer com o olho).
 */
export const COLLECTION_THEMES: readonly Theme[] = [
  'midnight',
  'terracotta',
  'forest',
  'crimson',
  'glacier',
  'carbon',
  'lavender',
  'dune',
  'synthwave',
  'mono',
  'phosphor',
  'sepia',
];

/** Lista canônica completa, na ordem em que aparecem no seletor. */
export const THEMES: readonly Theme[] = [...CLASSIC_THEMES, ...COLLECTION_THEMES];

/**
 * Amostras visuais de cada tema. Usadas pelo seletor pra mostrar a paleta
 * antes de aplicar — os valores aqui são uma cópia _frozen_ das variáveis
 * mais representativas de cada bloco em tokens.css.
 *
 * Manter sincronizado com tokens.css: se mudar `--bg`, `--bg-card`, `--text`,
 * `--accent` ou `--danger` lá, atualize aqui também. A duplicação é
 * intencional — assim os swatches funcionam mesmo antes do tema estar
 * "carregado" no DOM, sem ler `getComputedStyle` (que daria flicker).
 */
export interface ThemeSwatches {
  bg: string;
  bgCard: string;
  text: string;
  accent: string;
  danger: string;
}

export const THEME_SWATCHES: Record<Theme, ThemeSwatches> = {
  dark: {
    bg: '#0a0a0a',
    bgCard: '#161616',
    text: '#ececec',
    accent: '#ffffff',
    danger: '#d97a6a',
  },
  light: {
    bg: '#f5f3ee',
    bgCard: '#ffffff',
    text: '#1a1a1a',
    accent: '#000000',
    danger: '#c25f4f',
  },
  midnight: {
    bg: '#0b1220',
    bgCard: '#152033',
    text: '#dde6f5',
    accent: '#7ec5ff',
    danger: '#ff7a8a',
  },
  terracotta: {
    bg: '#1f1612',
    bgCard: '#2c2018',
    text: '#f0e3d3',
    accent: '#e8a86b',
    danger: '#e25c4a',
  },
  forest: {
    bg: '#0e1612',
    bgCard: '#15201b',
    text: '#dfe8df',
    accent: '#c19868',
    danger: '#e07a6a',
  },
  crimson: {
    bg: '#1a0a0d',
    bgCard: '#26111a',
    text: '#f0d9d4',
    accent: '#d4a55a',
    danger: '#ff8a7a',
  },
  glacier: {
    bg: '#e8edf2',
    bgCard: '#ffffff',
    text: '#1c2733',
    accent: '#3f5973',
    danger: '#c44a52',
  },
  carbon: {
    bg: '#000000',
    bgCard: '#0d0d0d',
    text: '#e6e6e6',
    accent: '#e63946',
    danger: '#ff4d5e',
  },
  lavender: {
    bg: '#1a1622',
    bgCard: '#241f30',
    text: '#e6dff0',
    accent: '#b8a6d9',
    danger: '#e88a99',
  },
  dune: {
    bg: '#2a2218',
    bgCard: '#352b1f',
    text: '#f5e9d3',
    accent: '#d4b896',
    danger: '#d97a5a',
  },
  synthwave: {
    bg: '#0d0a1a',
    bgCard: '#1a1530',
    text: '#f0e8ff',
    accent: '#ff5cc8',
    danger: '#ff5577',
  },
  mono: {
    bg: '#fafafa',
    bgCard: '#ffffff',
    text: '#0a0a0a',
    accent: '#d4f000',
    danger: '#000000',
  },
  phosphor: {
    bg: '#080a08',
    bgCard: '#0d120e',
    text: '#7eff9c',
    accent: '#5fff8a',
    danger: '#ff8a4a',
  },
  sepia: {
    bg: '#f3ead7',
    bgCard: '#fbf5e6',
    text: '#3a2a1c',
    accent: '#8c4a2b',
    danger: '#9c2a2a',
  },
};

const STORAGE_KEY = 'breaking_eternity_theme_v1';
const DEFAULT_THEME: Theme = 'dark';

function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value);
}

/** Lê o tema persistido. Fallback pro default se ausente/inválido. */
export function loadStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isTheme(raw)) return raw;
  } catch {
    // Ambientes sem localStorage (sandbox, modo privado): usa default.
  }
  return DEFAULT_THEME;
}

/**
 * Aplica o tema no `<html>` e persiste. Operação síncrona, sem React.
 *
 * Convenção: o tema default (`dark`) é codificado como AUSÊNCIA do atributo
 * `data-theme` — assim o bloco `:root` em tokens.css dita a paleta. Qualquer
 * outro tema seta `data-theme="..."` correspondente.
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Silencioso — sandbox/privado.
  }
}

/**
 * Hook de tema. Mantém o estado em React e sincroniza com `<html>` +
 * localStorage. Retorna `theme` e `setTheme(theme)`.
 */
export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => loadStoredTheme());

  // Aplica o tema inicial (e qualquer mudança subsequente) no DOM.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
