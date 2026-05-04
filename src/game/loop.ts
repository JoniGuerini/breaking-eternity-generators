import { persistNow, useGameStore } from './store';

/**
 * Game loop e auto-save. Roda fora da árvore React.
 *
 *  - Tick a 60Hz via requestAnimationFrame, atualiza Decimals diretamente.
 *  - Notifica React (`store.notify()`) numa cadência reduzida (~15Hz)
 *    pra evitar re-render em todo frame.
 *  - Auto-save a cada 5s + ao esconder a aba + ao fechar.
 *  - Flag `isResetting` impede que o `beforeunload` recrie o save logo
 *    após o `removeItem` no reset.
 */

const RENDER_INTERVAL_MS = 1000 / 15;

let rafId: number | null = null;
let saveIntervalId: ReturnType<typeof setInterval> | null = null;
let lastTime = 0;
let lastNotify = 0;
let started = false;
let isResetting = false;

function tick(now: number) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  useGameStore.getState().applyTick(dt);

  if (now - lastNotify >= RENDER_INTERVAL_MS) {
    lastNotify = now;
    useGameStore.getState().notify();
  }

  rafId = requestAnimationFrame(tick);
}

function saveIfAllowed() {
  if (isResetting) return;
  persistNow();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    saveIfAllowed();
  }
}

function handleBeforeUnload() {
  saveIfAllowed();
}

/**
 * Inicia o loop e os listeners de save. Idempotente — chamar mais de
 * uma vez é seguro (ex.: StrictMode em dev monta efeitos duas vezes).
 */
export function startGameLoop(): void {
  if (started) return;
  started = true;

  lastTime = performance.now();
  lastNotify = lastTime;
  rafId = requestAnimationFrame(tick);

  saveIntervalId = setInterval(saveIfAllowed, 5000);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
}

export function stopGameLoop(): void {
  if (!started) return;
  started = false;

  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;

  if (saveIntervalId !== null) clearInterval(saveIntervalId);
  saveIntervalId = null;

  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', handleBeforeUnload);
}

/**
 * Marca que um reset está em andamento. Enquanto verdadeiro, todas as
 * tentativas de salvar são ignoradas — protege contra `beforeunload`
 * recriar o save logo depois do `clearSave()` durante o reload.
 */
export function setResetting(value: boolean): void {
  isResetting = value;
}
