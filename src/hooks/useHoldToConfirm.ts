import { useCallback, useEffect, useRef, useState } from 'react';

interface UseHoldToConfirmOptions {
  /** Duração total do hold em milissegundos. */
  durationMs: number;
  /** Callback disparado quando o hold completa. */
  onComplete: () => void;
}

interface UseHoldToConfirmReturn {
  /** Progresso atual em [0, 1]. Atualiza ~60Hz enquanto pressionado. */
  progress: number;
  /** True enquanto o usuário está pressionando (mesmo que ainda não tenha completado). */
  isHolding: boolean;
  /** Handlers prontos pra spread no <button>. */
  handlers: {
    onMouseDown: () => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onKeyUp: (e: React.KeyboardEvent) => void;
  };
}

/**
 * Hook genérico de "press & hold to confirm".
 *
 * Mantém um requestAnimationFrame ativo enquanto o botão está pressionado
 * pra atualizar `progress` em alta cadência (sem flicker da animação CSS).
 * Quando completa, chama `onComplete` UMA vez e reseta o estado. Se soltar
 * antes, o progresso volta a zero instantaneamente — sem ease-out, pra deixar
 * claro que o gesto foi cancelado.
 *
 * Suporta mouse, touch e teclado (Space/Enter mantém pressionado).
 */
export function useHoldToConfirm({
  durationMs,
  onComplete,
}: UseHoldToConfirmOptions): UseHoldToConfirmReturn {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  // Refs pra valores que o rAF precisa ler sem disparar re-renders.
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // Mantém a callback atualizada sem reiniciar o loop.
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    completedRef.current = false;
    setProgress(0);
    setIsHolding(false);
  }, []);

  const tick = useCallback(
    (now: number) => {
      const elapsed = now - startRef.current;
      const ratio = Math.min(1, elapsed / durationMs);
      setProgress(ratio);

      if (ratio >= 1) {
        // Completou: dispara uma vez, limpa estado.
        if (!completedRef.current) {
          completedRef.current = true;
          rafRef.current = null;
          // Pequeno delay pra UI mostrar o "100% preenchido" antes de fechar.
          // 80ms é o ponto doce: rápido o suficiente pra parecer responsivo,
          // longo o suficiente pra registrar visualmente.
          window.setTimeout(() => {
            onCompleteRef.current();
            // Reset de UI vai junto — caso o caller não desmonte o componente.
            setProgress(0);
            setIsHolding(false);
            completedRef.current = false;
          }, 80);
        }
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [durationMs]
  );

  const start = useCallback(() => {
    if (rafRef.current !== null || completedRef.current) return;
    setIsHolding(true);
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // Garante limpeza do rAF quando o componente desmontar no meio do hold.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    progress,
    isHolding,
    handlers: {
      onMouseDown: start,
      onMouseUp: cancel,
      // Cancela ao sair do botão pra evitar "segurar fora e voltar".
      onMouseLeave: cancel,
      onTouchStart: (e) => {
        // Evita o "ghost click" / scroll iniciar enquanto segura.
        e.preventDefault();
        start();
      },
      onTouchEnd: cancel,
      onTouchCancel: cancel,
      onKeyDown: (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (!e.repeat) start();
        }
      },
      onKeyUp: (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          cancel();
        }
      },
    },
  };
}
