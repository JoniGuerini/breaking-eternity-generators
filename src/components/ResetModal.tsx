import { useEffect } from 'react';
import { setResetting } from '../game/loop';
import { useGameStore } from '../game/store';

interface ResetModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal customizado pra confirmação de reset.
 *  - Substitui o `confirm()` nativo (decisão estética).
 *  - Suporta ESC e clique no backdrop pra fechar.
 *  - No confirm: marca `isResetting` no loop, limpa save, refaz estado.
 *    A flag impede que listeners de `beforeunload`/`visibilitychange`
 *    recriem o save durante o processo.
 */
export function ResetModal({ open, onClose }: ResetModalProps) {
  const reset = useGameStore((s) => s.reset);

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

  function handleConfirm() {
    setResetting(true);
    try {
      reset();
    } finally {
      // Liberamos a flag no próximo frame pra dar tempo do reload acontecer
      // se for o caso, ou de evitar saves intermediários.
      setTimeout(() => setResetting(false), 0);
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
        <h2 className="modal-title" id="reset-modal-title">
          Reiniciar progresso?
        </h2>
        <p className="modal-body">
          Isso vai apagar tudo o que você acumulou e começar um novo jogo do zero. Não tem como
          desfazer.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn--danger" onClick={handleConfirm}>
            Reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}
