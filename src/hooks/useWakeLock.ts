import { useEffect } from 'react';

/**
 * Mantém a tela acordada enquanto a aba estiver visível.
 *
 * O lock é liberado automaticamente pelo navegador quando a aba perde
 * visibilidade — comportamento normal da Wake Lock API. Re-pedimos ao
 * voltar pra `visible`. Falhas são silenciosas (alguns navegadores
 * recusam fora de gesto do usuário ou em janelas não-https).
 */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function request() {
      if (cancelled) return;
      if (lock !== null) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => {
          lock = null;
        });
      } catch {
        // navegador pode recusar — silencioso
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void request();
      }
    }

    void request();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      lock?.release().catch(() => {});
      lock = null;
    };
  }, []);
}
