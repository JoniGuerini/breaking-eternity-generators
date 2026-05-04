import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { setResetting } from '../game/loop';
import { useGameStore } from '../game/store';
import { useHoldToConfirm } from '../hooks/useHoldToConfirm';

interface ResetModalProps {
  open: boolean;
  onClose: () => void;
}

/** Tempo pra completar o "press & hold" do botão Reiniciar. */
const HOLD_DURATION_MS = 1500;

/**
 * Modal customizado pra confirmação de reset.
 *  - Substitui o `confirm()` nativo (decisão estética).
 *  - Suporta ESC e clique no backdrop pra fechar.
 *  - O botão Reiniciar usa "press & hold" (1.5s) pra evitar reset acidental.
 *    Soltar antes do tempo cancela; segurar até o fim dispara o reset.
 *  - No confirm: marca `isResetting` no loop, limpa save, refaz estado.
 *    A flag impede que listeners de `beforeunload`/`visibilitychange`
 *    recriem o save durante o processo.
 */
export function ResetModal({ open, onClose }: ResetModalProps) {
  const { t } = useTranslation();
  const reset = useGameStore((s) => s.reset);

  const handleConfirm = useCallback(() => {
    setResetting(true);
    try {
      reset();
    } finally {
      // Liberamos a flag no próximo frame pra dar tempo do reload acontecer
      // se for o caso, ou de evitar saves intermediários.
      setTimeout(() => setResetting(false), 0);
    }
    onClose();
  }, [reset, onClose]);

  const { progress, isHolding, handlers } = useHoldToConfirm({
    durationMs: HOLD_DURATION_MS,
    onComplete: handleConfirm,
  });

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
        <h2 className="modal-title" id="reset-modal-title">
          {t('modal.resetTitle')}
        </h2>
        <p className="modal-body">{t('modal.resetBody')}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            className="btn btn--danger btn--hold"
            data-holding={isHolding ? 'true' : undefined}
            {...handlers}
          >
            {/*
             * Camada de fill (fundo coral preenchendo da esquerda pra direita).
             * `scaleX` é GPU-friendly e não causa reflow.
             */}
            <span
              className="btn--hold__fill"
              style={{ transform: `scaleX(${progress})` }}
              aria-hidden="true"
            />

            {/*
             * Texto base — coral. Visível na parte que ainda NÃO foi coberta
             * pela barra. Esse é o estado "default" do label.
             */}
            <span className="btn--hold__label">{t('actions.holdToReset')}</span>

            {/*
             * Texto sobreposto — preto. É clipado por `inset(0 (1-p)*100% 0 0)`
             * pra revelar SÓ a parte que está sob a barra preenchida. Como o
             * texto tem que ficar EXATAMENTE no mesmo lugar do label base
             * (mesmo posicionamento absoluto, mesma fonte, mesmo letter-spacing),
             * ele é uma cópia idêntica do nó acima.
             *
             * `aria-hidden` evita que screen readers leiam duas vezes.
             */}
            <span
              className="btn--hold__label btn--hold__label--filled"
              style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
              aria-hidden="true"
            >
              {t('actions.holdToReset')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
