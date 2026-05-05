import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadStoredTheme } from './useTheme';

/**
 * Testes do helper de leitura do tema. Cobrir o hook React em si exigiria
 * `@testing-library/react` (não instalado neste projeto); mantemos focado
 * na lógica pura de storage/coerção, que é onde os bugs aparecem.
 */

interface MockStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

let store: Record<string, string> = {};

function makeMockStorage(): MockStorage {
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', makeMockStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadStoredTheme', () => {
  it('retorna "dark" quando não há nada salvo (default)', () => {
    expect(loadStoredTheme()).toBe('dark');
  });

  it('retorna "light" quando salvo como light', () => {
    store['breaking_eternity_theme_v1'] = 'light';
    expect(loadStoredTheme()).toBe('light');
  });

  it('retorna "dark" quando salvo como dark', () => {
    store['breaking_eternity_theme_v1'] = 'dark';
    expect(loadStoredTheme()).toBe('dark');
  });

  it.each([
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
  ] as const)('retorna o tema "%s" quando salvo', (theme) => {
    store['breaking_eternity_theme_v1'] = theme;
    expect(loadStoredTheme()).toBe(theme);
  });

  it('volta pro default quando o valor salvo é inválido', () => {
    // Valor sentinela: lixo que nunca poderá virar tema. Evita colisão
    // com nomes futuros — qualquer string que NÃO esteja em THEMES vale.
    store['breaking_eternity_theme_v1'] = '__invalid_theme__';
    expect(loadStoredTheme()).toBe('dark');
  });

  it('volta pro default quando localStorage lança (modo privado/sandbox)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(loadStoredTheme()).toBe('dark');
  });
});
