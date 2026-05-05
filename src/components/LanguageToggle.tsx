import { useTranslation } from 'react-i18next';
import type { SupportedLanguage } from '../i18n';

/**
 * Alternância entre pt-BR e en. Toggle textual ("PT" / "EN") porque:
 *  - Bandeiras representam países, não idiomas (PT-BR ≠ Brasil-só, EN ≠
 *    EUA-só); usar bandeira é considerado má prática em i18n.
 *  - O texto curto bate visualmente com o `v0.1` ao lado e com o ícone
 *    do tema, mantendo o footer da sidebar coeso.
 *
 * Mostra a sigla do idioma ATUAL; o `aria-label` descreve a ação do
 * clique (alternar para o outro).
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation();

  const isPt = i18n.language.startsWith('pt');
  const next: SupportedLanguage = isPt ? 'en' : 'pt-BR';

  const label = isPt ? t('language.ptShort') : t('language.enShort');
  const ariaLabel = isPt
    ? t('language.switchToEnglish')
    : t('language.switchToPortuguese');

  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={() => i18n.changeLanguage(next)}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {label}
    </button>
  );
}
