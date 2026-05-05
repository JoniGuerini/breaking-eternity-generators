import { useCallback, useEffect, useRef } from 'react';

interface UseHoldToRepeatOptions {
  /** Ação executada uma vez ao começar o hold e repetidamente enquanto segura. */
  onAction: () => void;
  /**
   * Delay (ms) entre o clique inicial e a 2ª ação. Funciona como "grace
   * period": clique curto + soltura nessa janela = exatamente 1 disparo,
   * mesmo que o cursor permaneça sobre o botão. Padrão folgado pra evitar
   * compras acidentais quando o usuário só quer clicar uma vez.
   */
  holdActivationMs?: number;
  /**
   * Tempo total (ms) desde o pressionamento até a cadência acelerar. Após
   * esse limite usa `fastIntervalMs`. Deve ser >= `holdActivationMs`.
   */
  rampMs?: number;
  /** Intervalo (ms) entre disparos durante a fase lenta (após ativação, antes do ramp). */
  initialIntervalMs?: number;
  /** Intervalo (ms) entre disparos depois de `rampMs`. */
  fastIntervalMs?: number;
}

/**
 * Hook de "press-and-hold = repeat action".
 *
 * Ao pressionar (mouse/touch/teclado), executa `onAction` UMA vez de
 * imediato. Se o usuário continuar segurando, agenda a 2ª ação só após
 * `holdActivationMs` (grace period). A partir daí o ritmo é `initialIntervalMs`
 * até atingir `rampMs` desde o início, quando passa pra `fastIntervalMs`.
 *
 * Usa `setTimeout` recursivo (não `setInterval`) pra que a transição
 * de cadência aconteça naturalmente entre disparos, sem precisar
 * cancelar/reagendar com timing exato.
 *
 * Cancela em qualquer evento de soltura/perda de foco. Importante: o
 * cancelamento usa listeners GLOBAIS (`window`) durante o hold ativo —
 * sem isso, soltar o mouse depois de o botão ter virado `disabled`
 * (ex.: comprou tudo, recurso esgotou) NÃO dispararia `mouseup` no
 * botão, e o timer continuaria vivo, gerando "compras fantasma" assim
 * que o jogador acumulasse recurso de novo.
 *
 * A última callback passada é sempre a usada (via ref) — caller não
 * precisa memoizar.
 */
export function useHoldToRepeat({
  onAction,
  holdActivationMs = 450,
  rampMs = 1200,
  initialIntervalMs = 180,
  fastIntervalMs = 67,
}: UseHoldToRepeatOptions) {
  const timeoutRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const firedCountRef = useRef(0);
  const onActionRef = useRef(onAction);
  const activeRef = useRef(false);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  const stop = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (activeRef.current) {
      activeRef.current = false;
      // Espelha a remoção feita em `start` — sem isso, listeners ficam
      // pendurados no window e seguem recebendo eventos para holds
      // futuros (não causa bug funcional, mas vaza handlers).
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('touchcancel', stop);
      window.removeEventListener('blur', stop);
    }
  }, []);

  const scheduleNext = useCallback(() => {
    // Antes do 2º disparo respeitamos o grace period maior; depois disso
    // entramos na cadência normal (lenta -> rápida).
    let interval: number;
    if (firedCountRef.current <= 1) {
      interval = holdActivationMs;
    } else {
      const elapsed = performance.now() - startRef.current;
      interval = elapsed >= rampMs ? fastIntervalMs : initialIntervalMs;
    }
    timeoutRef.current = window.setTimeout(() => {
      // Se o hold já foi encerrado por listener global enquanto o
      // timeout dormia, não dispara nem reagenda.
      if (!activeRef.current) return;
      onActionRef.current();
      firedCountRef.current += 1;
      if (!activeRef.current) return;
      scheduleNext();
    }, interval);
  }, [holdActivationMs, rampMs, initialIntervalMs, fastIntervalMs]);

  const start = useCallback(() => {
    // Já segurando? ignora reentradas (pode acontecer com touch + mouse
    // sintetizado em alguns dispositivos).
    if (activeRef.current) return;
    activeRef.current = true;
    startRef.current = performance.now();
    firedCountRef.current = 0;

    // Listeners GLOBAIS de soltura. Resolve o caso clássico em que o
    // botão vira `disabled` durante o hold (recurso esgotou): nesse
    // estado, `<button disabled>` não recebe mais eventos de mouse,
    // então `onMouseUp` no próprio elemento NUNCA dispararia. Sem
    // esse fallback, ao acumular recurso de novo o timer agendado
    // voltava a comprar sozinho.
    window.addEventListener('mouseup', stop);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);
    window.addEventListener('blur', stop);

    // Disparo imediato — clique curto sempre garante 1 compra.
    onActionRef.current();
    firedCountRef.current = 1;
    if (!activeRef.current) return;
    scheduleNext();
  }, [scheduleNext, stop]);

  // Limpa qualquer timer/listener pendente ao desmontar.
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    handlers: {
      onMouseDown: (e: React.MouseEvent) => {
        // Só botão esquerdo. Botão do meio/direito não inicia repeat.
        if (e.button !== 0) return;
        start();
      },
      onTouchStart: (e: React.TouchEvent) => {
        // Evita "ghost click" do mouse após touch.
        e.preventDefault();
        start();
      },
      // Suporte a teclado: Space/Enter apertados disparam, soltura cancela.
      // `e.repeat` é true em auto-repeat do SO — ignoramos pra não conflitar
      // com nosso próprio timing.
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        if (e.repeat) return;
        e.preventDefault();
        start();
      },
      onKeyUp: (e: React.KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') stop();
      },
    },
  };
}
