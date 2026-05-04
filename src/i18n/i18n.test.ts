import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectInitialLanguage, persistLanguage } from './index';

/**
 * Testes do detector de idioma inicial. Cobre as 3 fontes em ordem de
 * prioridade: localStorage > navigator.language > default.
 */

let store: Record<string, string> = {};

function makeMockStorage() {
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
}

function stubNavigatorLanguage(lang: string | undefined) {
  vi.stubGlobal('navigator', { language: lang });
}

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', makeMockStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectInitialLanguage', () => {
  it('respeita pt-BR salvo em localStorage', () => {
    store['breaking_eternity_lang_v1'] = 'pt-BR';
    stubNavigatorLanguage('en-US');
    expect(detectInitialLanguage()).toBe('pt-BR');
  });

  it('respeita en salvo em localStorage', () => {
    store['breaking_eternity_lang_v1'] = 'en';
    stubNavigatorLanguage('pt-BR');
    expect(detectInitialLanguage()).toBe('en');
  });

  it('ignora valor inválido em localStorage e cai no navegador', () => {
    store['breaking_eternity_lang_v1'] = 'xx';
    stubNavigatorLanguage('en-US');
    expect(detectInitialLanguage()).toBe('en');
  });

  it('detecta en-US do navegador como en', () => {
    stubNavigatorLanguage('en-US');
    expect(detectInitialLanguage()).toBe('en');
  });

  it('detecta pt-PT do navegador como pt-BR (prefixo pt)', () => {
    stubNavigatorLanguage('pt-PT');
    expect(detectInitialLanguage()).toBe('pt-BR');
  });

  it('cai no default (pt-BR) quando navegador é desconhecido', () => {
    stubNavigatorLanguage('ja-JP');
    expect(detectInitialLanguage()).toBe('pt-BR');
  });

  it('cai no default quando navigator.language não existe', () => {
    stubNavigatorLanguage(undefined);
    expect(detectInitialLanguage()).toBe('pt-BR');
  });
});

describe('persistLanguage', () => {
  it('grava em localStorage', () => {
    persistLanguage('en');
    expect(store['breaking_eternity_lang_v1']).toBe('en');
  });

  it('não lança quando localStorage falha', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('storage unavailable');
      },
      removeItem: () => {},
    });
    expect(() => persistLanguage('pt-BR')).not.toThrow();
  });
});
