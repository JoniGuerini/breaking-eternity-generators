import { applyCatchUpProgress, persistNow, useGameStore } from './store';

/**
 * Game loop e auto-save. Roda fora da árvore React.
 *
 *  - Tick a 60Hz via requestAnimationFrame, atualiza Decimals diretamente.
 *  - Notifica React (`store.notify()`) numa cadência reduzida (~15Hz)
 *    pra evitar re-render em todo frame.
 *  - Auto-save a cada 5s + ao esconder a aba + ao fechar.
 *  - Catch-up automático ao voltar do background: como o rAF é throttled
 *    (ou pausado) quando a aba não está visível, salvamos o timestamp em
 *    `hidden` e, ao voltar a `visible`, aplicamos o progresso correspondente
 *    em offline mode (mesma lógica usada no boot).
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

/**
 * Wall-clock timestamp (`Date.now()`) do momento em que a aba ficou hidden.
 * `null` quando a aba está visível.
 *
 * Usamos `Date.now()` (não `performance.now()`) porque queremos contar TEMPO
 * DE PAREDE: o usuário fica longe X segundos, queremos creditar X segundos
 * de produção. `performance.now()` mede tempo do processo, que pode ser
 * pausado em background dependendo do browser.
 */
let hiddenAt: number | null = null;

/**
 * Janela móvel de timestamps de frame (em `performance.now()`), usada pra
 * calcular FPS instantâneo. Mantemos só os frames do último segundo: o FPS
 * é o tamanho da janela após dropar entradas mais antigas que `now - 1000`.
 *
 * Array nativo é OK aqui — em 60Hz fica com no máximo ~60 entradas e
 * `shift()` em um array pequeno é trivial.
 */
const frameTimestamps: number[] = [];
const FPS_WINDOW_MS = 1000;

function tick(now: number) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // Janela móvel de 1s pra cálculo de FPS.
  frameTimestamps.push(now);
  const cutoff = now - FPS_WINDOW_MS;
  while (frameTimestamps.length > 0 && frameTimestamps[0] < cutoff) {
    frameTimestamps.shift();
  }

  useGameStore.getState().applyTick(dt);

  if (now - lastNotify >= RENDER_INTERVAL_MS) {
    lastNotify = now;
    useGameStore.getState().notify();
  }

  rafId = requestAnimationFrame(tick);
}

/**
 * FPS instantâneo (frames nos últimos ~1s). Retorna 0 se o loop não estiver
 * rodando ou se a aba acabou de voltar do background (janela ainda fria).
 */
export function getCurrentFps(): number {
  return frameTimestamps.length;
}

function saveIfAllowed() {
  if (isResetting) return;
  persistNow();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    // Marca o instante exato em que a aba escondeu, pra calcular delta na volta.
    hiddenAt = Date.now();
    saveIfAllowed();
  } else if (document.visibilityState === 'visible' && hiddenAt !== null) {
    // Catch-up: aplica o progresso correspondente ao tempo que ficou em
    // background. A simulação roda em passos limitados por DT_CAP dentro do
    // store, então cobrir minutos/horas é seguro.
    const elapsedSeconds = (Date.now() - hiddenAt) / 1000;
    hiddenAt = null;
    applyCatchUpProgress(elapsedSeconds);

    // Reseta a base do rAF: sem isso, o próximo `tick` somaria todo o gap
    // como `dt` (que seria clampado pelo DT_CAP, mas ainda assim duplica
    // parte do progresso já creditado pelo catch-up).
    lastTime = performance.now();
    lastNotify = lastTime;
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
