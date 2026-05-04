/**
 * Converte inteiro positivo (1..3999) pra numeral romano.
 * Acima desse range, devolve a representação decimal — não usamos
 * numerais romanos pra geradores muito profundos (a estética perde força).
 */
const ROMAN_TABLE: Array<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 4000) return n.toString();
  let value = Math.floor(n);
  let out = '';
  for (const [num, sym] of ROMAN_TABLE) {
    while (value >= num) {
      out += sym;
      value -= num;
    }
  }
  return out;
}
