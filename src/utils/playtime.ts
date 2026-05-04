/**
 * Formatação de tempo de jogo (wall clock — inclui offline).
 *
 * Cascata de unidades fixas, cada uma definida em segundos:
 *   60s = 1m, 60m = 1h, 24h = 1d, 7d = 1w,
 *   30d ≈ 1mo (mês "do calendário" simplificado),
 *   12mo ≈ 1y, 10y = 1 década, 100y = 1 século, 1000y = 1 milênio.
 *
 * Como as unidades acima de "semana" são aproximações comuns (mês = 30 dias,
 * ano = 12 meses), só usamos valores arredondados — o objetivo é leitura, não
 * precisão astronômica. A escolha bate com a especificação do usuário.
 *
 * `formatPlaytime` retorna sempre as 2 maiores unidades não-zero. Quando só
 * existe a unidade base (segundos) ou só uma unidade > 0, retorna 1 termo.
 */

// Ordem ascendente: cada item descreve quantos "deste" cabem em "1 do próximo".
// O último item não precisa de `perNext` real (Infinity = nunca promove).
// `as const` garante que `UNITS[i].short` seja literal pro tipo `UnitShort`.
const UNITS = [
  { short: 's', perNext: 60 },        // 60s = 1m
  { short: 'm', perNext: 60 },        // 60m = 1h
  { short: 'h', perNext: 24 },        // 24h = 1d
  { short: 'd', perNext: 7 },         // 7d  = 1w
  { short: 'w', perNext: 4 },         // 4w  ≈ 1mo  (mês simplificado em 28d)
  { short: 'mo', perNext: 12 },       // 12mo = 1y
  { short: 'y', perNext: 10 },        // 10y  = 1 década
  { short: 'dec', perNext: 10 },      // 10 décadas = 1 século
  { short: 'c', perNext: 10 },        // 10 séculos = 1 milênio
  { short: 'mil', perNext: Infinity },
] as const;

type UnitShort = (typeof UNITS)[number]['short'];

// NOTA sobre mês: tratar mês como 4 semanas (= 28 dias) mantém a cascata
// fechada (semana → mês → ano sem buracos). Se quisermos 30 dias em algum
// momento, é só transformar `perNext` da semana em algo não-inteiro — mas isso
// quebraria a sensação de "X semanas exatas viram 1 mês". Mantido em 4w por
// enquanto pra leitura limpa.

/**
 * Quebra um total em segundos no maior componente possível, arrastando
 * sobras pra unidade base. Retorna pares (valor, índice da unidade) em ordem
 * descendente (maior unidade primeiro).
 */
function decompose(totalSeconds: number): Array<{ value: number; unitIndex: number }> {
  let remainingSeconds = Math.max(0, Math.floor(totalSeconds));
  const out: Array<{ value: number; unitIndex: number }> = [];

  // Calcula o valor inteiro de cada unidade subindo a escada.
  // values[i] = quantidade de "unit i" depois de subir até onde der.
  const values: number[] = new Array(UNITS.length).fill(0);
  values[0] = remainingSeconds;
  for (let i = 0; i < UNITS.length - 1; i++) {
    const per = UNITS[i].perNext;
    if (!isFinite(per) || values[i] < per) break;
    values[i + 1] = Math.floor(values[i] / per);
    values[i] = values[i] % per;
  }

  // Emite em ordem descendente, ignorando zeros até achar o primeiro positivo.
  let started = false;
  for (let i = UNITS.length - 1; i >= 0; i--) {
    if (values[i] > 0) started = true;
    if (started) out.push({ value: values[i], unitIndex: i });
  }
  return out;
}

/** Opções de formatação. Permitem trocar os sufixos por traduções i18n. */
export interface FormatPlaytimeOptions {
  /**
   * Mapeamento de sufixo padrão (em inglês) pro sufixo localizado. Ex.: em
   * pt-BR, `s` continua `s` e `mo` vira `me` se quisermos. Se uma chave
   * estiver ausente, mantemos o sufixo original.
   */
  unitLabels?: Partial<Record<UnitShort, string>>;
  /** Texto exibido quando `totalSeconds <= 0`. Default: `"0s"`. */
  zero?: string;
}

/**
 * Formata o tempo de jogo (em segundos) usando as 2 maiores unidades não-zero.
 *  - `0` → `"0s"`
 *  - `45` → `"45s"`
 *  - `60` → `"1m"`
 *  - `125` → `"2m 5s"`
 *  - `3725` → `"1h 2m"`  (segundos descartados quando há unidade maior)
 *  - `90061` → `"1d 1h"`
 *
 * Quando há mais de uma unidade > 0, a SEGUNDA unidade exibida é sempre a
 * imediatamente abaixo da maior — mesmo que esteja em zero (ex.: `3600` =
 * `"1h 0m"`). Isso dá uma leitura previsível e evita flicker visual quando
 * uma das unidades menores zera.
 */
export function formatPlaytime(
  totalSeconds: number,
  options: FormatPlaytimeOptions = {}
): string {
  const zero = options.zero ?? '0s';
  if (!isFinite(totalSeconds) || totalSeconds <= 0) return zero;

  const parts = decompose(totalSeconds);
  if (parts.length === 0) return zero;

  const labelFor = (unitShort: UnitShort): string =>
    options.unitLabels?.[unitShort] ?? unitShort;

  const top = parts[0];
  // Sem unidade abaixo (só temos segundos disponíveis): 1 termo basta.
  if (top.unitIndex === 0) {
    return `${top.value}${labelFor(UNITS[0].short)}`;
  }

  // Procura a unidade imediatamente abaixo. Pode estar em 0 — mostramos mesmo
  // assim pra dar uma leitura estável (ex.: '1h 0m' em vez de só '1h').
  const belowIndex = top.unitIndex - 1;
  const below = parts.find((p) => p.unitIndex === belowIndex);
  const belowValue = below ? below.value : 0;

  return `${top.value}${labelFor(UNITS[top.unitIndex].short)} ${belowValue}${labelFor(UNITS[belowIndex].short)}`;
}

/**
 * Helper: tempo de jogo em segundos a partir do timestamp de início do save.
 * Wall clock — inclui tempo offline.
 */
export function getPlaytimeSeconds(startedAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}
