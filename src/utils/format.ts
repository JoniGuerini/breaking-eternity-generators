import Decimal from 'break_eternity.js';

/* ─────────── Number formatting ───────────
 * Steps (operate on Decimal so there's no upper bound):
 *   - n < 1.000          → up to 2 decimals (small live values)
 *   - n < 10.000         → integer with pt-BR thousand separator (1.234, 9.999)
 *   - 10.000 ≤ n < 1e33  → short-scale suffix: K, M, B, T, Qa, Qi, Sx, Sp, Oc, No
 *   - n ≥ 1e33           → alphabetic suffix replacing what would be Dc onwards:
 *                          aa, ab, ac, …, az, ba, …, zz, aaa, aab, … (Excel-style,
 *                          26 letters per "digit", zero-indexed at 'aa'). One slot
 *                          per power of 1000.
 *
 * Above ~1e308 (the float64 ceiling) we still produce the same family of
 * suffixes because Decimal carries the exponent natively; the alphabetic
 * sequence simply continues forever.
 */
const NAMED_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
const ALPHA_START_INDEX = NAMED_SUFFIXES.length;

/** Excel-style alphabetic label, zero-indexed: 0='a', 25='z', 26='aa', 27='ab', 701='zz', 702='aaa', … */
function alphaLabel(zeroBasedIndex: number): string {
  let n = zeroBasedIndex;
  let out = '';
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function suffixForGroup(group: number): string {
  if (group < ALPHA_START_INDEX) return NAMED_SUFFIXES[group];
  // Skip Dc onwards entirely — start the alphabetic sequence at 'aa' so the
  // first alpha suffix has the same visual weight as the named ones.
  return alphaLabel(group - ALPHA_START_INDEX + 26);
}

/** Coerce any value into a Decimal. null/undefined/NaN/non-numeric all
 *  collapse to dZero so downstream code never crashes on bad data. */
export function toDecimal(value: unknown): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === 'number') {
    if (!isFinite(value)) return new Decimal(0);
    return new Decimal(value);
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      return new Decimal(value);
    } catch {
      return new Decimal(0);
    }
  }
  return new Decimal(0);
}

function formatWithSuffix(n: Decimal): string {
  const log10 = n.log10().toNumber();
  let group = Math.floor(log10 / 3);
  // Compute the 1–999.999 mantissa: 10^(log10 - 3*group)
  let scaled = Math.pow(10, log10 - 3 * group);
  // Anti-overflow: 999.999 arredondaria pra "1000.00 K", então promove o
  // grupo. O `- 1e-9` absorve o ruído de ponto flutuante de log10/pow
  // (ex.: 999995 calcula como 999.9949999999995 em JS, mas o spec quer
  // que ele entre na promoção e vire "1.00 M").
  if (scaled >= 999.995 - 1e-9) {
    group += 1;
    scaled = Math.pow(10, log10 - 3 * group);
  }
  // Espaço entre número e sufixo melhora legibilidade ("12.35 K" em vez
  // de "12.35K"). Use `\u00a0` (non-breaking space) pra evitar quebra
  // de linha entre os dois.
  return scaled.toFixed(2) + '\u00a0' + suffixForGroup(group);
}

/**
 * Locale default usado quando nenhum é fornecido. Mantém o comportamento
 * histórico do projeto (separador de milhar pt-BR = ponto). Componentes
 * que querem respeitar o idioma do usuário passam `i18n.language`.
 */
const DEFAULT_LOCALE = 'pt-BR';

/**
 * Quantos decimais mostrar pra valores positivos pequenos (entre 0 e 10).
 * Cada queda de ordem de magnitude adiciona uma casa decimal — o valor
 * "real" fica sempre visível em vez de virar `0.00` quando a taxa
 * encolhe (importante pra geradores de tiers altos com rate exponencial
 * decrescente, ex.: Gen 20 produz ~0.0039/s).
 *
 * Faixas:
 *   n ≥ 0.01     → 2 casas (atual: "0.10")
 *   ≥ 0.001      → 3 casas ("0.005")
 *   ≥ 0.0001     → 4 casas
 *   ≥ 1e-5       → 5 casas
 *   ...
 *   ≥ 1e-8       → 8 casas (limite — abaixo disso usamos notação científica
 *                  pra evitar strings tipo "0.0000000123" que ninguém lê)
 */
function smallNumberDecimals(value: number): number {
  // value sempre > 0 e < 10 quando esta função é chamada.
  if (value >= 0.01) return 2;
  if (value >= 0.001) return 3;
  if (value >= 1e-4) return 4;
  if (value >= 1e-5) return 5;
  if (value >= 1e-6) return 6;
  if (value >= 1e-7) return 7;
  return 8;
}

/** Threshold abaixo do qual mudamos pra notação científica. */
const SCIENTIFIC_THRESHOLD = 1e-8;

function formatSmallPositive(v: Decimal): string {
  const n = v.toNumber();
  // `toNumber()` colapsa pra 0 abaixo de ~5e-324; nesse caso (e quando
  // estamos abaixo do threshold científico de qualquer forma), usamos
  // a representação exponencial direto do Decimal.
  if (n === 0 || n < SCIENTIFIC_THRESHOLD) {
    // Decimal.toExponential(2) → "1.23e-9", "5.00e-23", etc.
    return v.toExponential(2);
  }
  return n.toFixed(smallNumberDecimals(n));
}

/** Big-number formatter for live/derived values (rates, costs, totals).
 *  Accepts strings too so it can format Decimal-encoded values that
 *  overflow float64. O `locale` opcional troca o separador de milhar
 *  no range 1.000–9.999 (pt-BR usa ".", en usa ","). Sufixos e os
 *  formatos abaixo de 1000 (toFixed) NÃO mudam por locale. */
export function formatNum(
  n: Decimal | number | string | null | undefined,
  locale: string = DEFAULT_LOCALE
): string {
  const v = toDecimal(n);
  if (v.lt(0)) return '-' + formatNum(v.neg(), locale);
  // Zero exato continua "0.00" pra manter o look numérico (sem decair pra
  // notação científica num valor trivial).
  if (v.eq(0)) return '0.00';
  // Valores pequenos (0 < v < 10) ganham casas decimais conforme encolhem.
  // Cobre a faixa "viva" do jogo (rates de geradores tier alto).
  if (v.lt(10)) return formatSmallPositive(v);
  if (v.lt(100)) return v.toNumber().toFixed(1);
  if (v.lt(1000)) return Math.floor(v.toNumber()).toString();
  if (v.lt(10000)) return Math.floor(v.toNumber()).toLocaleString(locale);
  return formatWithSuffix(v);
}

/** Integer formatter for owned counts, action totals, etc. Same suffix
 *  rules as formatNum, but never shows decimals below 10.000. */
export function formatInt(
  n: Decimal | number | string | null | undefined,
  locale: string = DEFAULT_LOCALE
): string {
  const v = toDecimal(n);
  if (v.lt(0)) return '-' + formatInt(v.neg(), locale);
  if (v.lt(10000)) return Math.floor(v.toNumber()).toLocaleString(locale);
  return formatWithSuffix(v);
}
