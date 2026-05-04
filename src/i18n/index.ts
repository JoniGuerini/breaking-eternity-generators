import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from '../locales/pt-BR.json';
import en from '../locales/en.json';

/**
 * Configuração do i18n.
 *
 * Estratégia:
 *  - 2 idiomas suportados: `pt-BR` e `en`. Adicionar um novo é só criar o
 *    JSON em `src/locales/` e registrar abaixo.
 *  - Detecção: lê `localStorage` primeiro (chave `breaking_eternity_lang_v1`).
 *    Se ausente, deduz do navegador (`navigator.language`). Fallback: `pt-BR`.
 *  - Persistência: o `LanguageToggle` chama `i18n.changeLanguage()` e nós
 *    mesmos gravamos no localStorage (não usamos o detector oficial pra não
 *    inflar o bundle com `i18next-browser-languagedetector`).
 *  - Sem namespaces — chaves planas no JSON, acessadas por dot-path
 *    (`actions.reset`, `generator.name` etc).
 *  - Sem interpolation escaping: o React já escapa em runtime.
 */

export const STORAGE_KEY = 'breaking_eternity_lang_v1';
export const SUPPORTED_LANGUAGES = ['pt-BR', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'pt-BR';

/**
 * Determina o idioma inicial:
 *   1. Persistido em localStorage, se válido.
 *   2. Match do `navigator.language` (ex.: 'pt-BR' bate exato; 'pt-PT' / 'pt'
 *      cai em 'pt-BR' por prefixo; 'en-US' cai em 'en'; outros caem no
 *      default).
 *   3. Default `pt-BR`.
 */
export function detectInitialLanguage(): SupportedLanguage {
  // 1. localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // sandbox/privado: ignora
  }

  // 2. navigator
  const navLang = (typeof navigator !== 'undefined' && navigator.language) || '';
  if (navLang) {
    const normalized = navLang.toLowerCase();
    // Match exato (case-insensitive) primeiro.
    for (const lang of SUPPORTED_LANGUAGES) {
      if (lang.toLowerCase() === normalized) return lang;
    }
    // Fallback por prefixo: `pt-XX` vira `pt-BR`, `en-XX` vira `en`.
    if (normalized.startsWith('pt')) return 'pt-BR';
    if (normalized.startsWith('en')) return 'en';
  }

  // 3. default
  return DEFAULT_LANGUAGE;
}

/** Persiste a escolha de idioma. Silencioso em ambientes sem localStorage. */
export function persistLanguage(lang: SupportedLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ok, sandbox
  }
}

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    en: { translation: en },
  },
  lng: detectInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    // React já escapa output, então não precisamos do escape do i18n.
    escapeValue: false,
  },
  // Suspense desligado: como já temos os JSONs bundleados (import direto),
  // não precisamos de loading state assíncrono.
  react: {
    useSuspense: false,
  },
});

// Mantém `<html lang>` em sincronia com o idioma atual — ajuda screen readers
// e ferramentas que detectam idioma da página.
function syncHtmlLang(lang: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lang);
  }
}
syncHtmlLang(i18n.language);
i18n.on('languageChanged', (lang) => {
  syncHtmlLang(lang);
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
    persistLanguage(lang as SupportedLanguage);
  }
});

export default i18n;
