/*
 * scripts/build-favicon.mjs
 *
 * Gera o favicon do projeto (`public/favicon.svg`) extraindo os outlines
 * reais dos glifos "B" e "E" do Fraunces (mesma fonte do título do jogo)
 * e embutindo como <path> num SVG estatico — sem dependência de fonte do
 * sistema, sem renderização de <text>.
 *
 * Esse script só roda quando você quer regerar o favicon. Não faz parte
 * do build do app.
 *
 * Uso:
 *   node scripts/build-favicon.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import wawoff2 from 'wawoff2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'public', 'favicon.svg');

const GOOGLE_FONTS_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@144,500&display=swap';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36';

async function fetchLatinFontUrl() {
  const res = await fetch(GOOGLE_FONTS_CSS_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Google Fonts CSS request failed: ${res.status}`);
  const css = await res.text();
  const latinBlockMatch = css.match(/\/\*\s*latin\s*\*\/\s*@font-face\s*\{[\s\S]*?\}/);
  if (!latinBlockMatch) throw new Error('Could not locate /* latin */ block in CSS');
  const urlMatch = latinBlockMatch[0].match(/url\((https:\/\/[^)]+\.woff2)\)/);
  if (!urlMatch) throw new Error('Could not locate woff2 URL in latin block');
  return urlMatch[1];
}

async function loadFraunces() {
  const url = await fetchLatinFontUrl();
  console.log('Fonte:', url);
  const woff2Buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const ttfBuf = Buffer.from(await wawoff2.decompress(woff2Buf));
  return opentype.parse(
    ttfBuf.buffer.slice(ttfBuf.byteOffset, ttfBuf.byteOffset + ttfBuf.byteLength)
  );
}

/**
 * Converte os comandos de path do opentype.js em string `d` SVG.
 * O opentype.js já produz coordenadas em sistema SVG (Y aumenta pra baixo).
 */
function commandsToD(commands) {
  const out = [];
  for (const c of commands) {
    switch (c.type) {
      case 'M':
        out.push(`M${c.x.toFixed(2)} ${c.y.toFixed(2)}`);
        break;
      case 'L':
        out.push(`L${c.x.toFixed(2)} ${c.y.toFixed(2)}`);
        break;
      case 'C':
        out.push(
          `C${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x2.toFixed(2)} ${c.y2.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`
        );
        break;
      case 'Q':
        out.push(`Q${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`);
        break;
      case 'Z':
        out.push('Z');
        break;
    }
  }
  return out.join(' ');
}

async function main() {
  const font = await loadFraunces();

  const B = font.charToGlyph('B');
  const E = font.charToGlyph('E');
  if (!B || !E) throw new Error('Glyph B or E missing from Fraunces subset');

  // O segundo argumento `fontSize` do opentype.js trata 1 unidade = "1 em
  // em pixels". Escolhemos um fontSize de trabalho alto pra termos boa
  // resolução nas medições (zero impacto no resultado final, é só pra
  // calcular bboxes em pixels antes de escalar de volta pro viewBox).
  const FS = 1000;

  // Mede cada glifo desenhado na baseline em (0,0) com fontSize FS.
  // bbox.x1/x2/y1/y2 saem em PIXELS (em FS). Y aumenta pra baixo no SVG;
  // os glifos maiúsculos têm `y1 < 0` (topo, acima da baseline) e
  // `y2 ≈ 0` (base, na baseline).
  const bbB = B.getPath(0, 0, FS).getBoundingBox();
  const bbE = E.getPath(0, 0, FS).getBoundingBox();

  console.log('B bbox (px @ FS=1000):', bbB);
  console.log('E bbox (px @ FS=1000):', bbE);

  // Tracking entre B e E em pixels (no mesmo sistema de FS=1000). 30px @
  // 1000 ≈ 3% do em — espaçamento apertado, próprio de monograma.
  const tracking = 30;

  const minY = Math.min(bbB.y1, bbE.y1);
  const maxY = Math.max(bbB.y2, bbE.y2);
  const blockWidth = (bbB.x2 - bbB.x1) + tracking + (bbE.x2 - bbE.x1);
  const blockHeight = maxY - minY;

  console.log(`Bloco BE @ FS=1000: ${blockWidth.toFixed(0)} x ${blockHeight.toFixed(0)} px`);

  // ViewBox e área útil (com padding nas bordas).
  const VIEW = 64;
  const PAD = 6;
  const useful = VIEW - 2 * PAD;

  // Fator pra reduzir o bloco @ FS=1000 ao tamanho do viewBox.
  const ratio = Math.min(useful / blockWidth, useful / blockHeight);

  // fontSize final que aplicamos ao desenhar pro SVG.
  const finalFS = FS * ratio;

  const drawnW = blockWidth * ratio;
  const drawnH = blockHeight * ratio;

  const offsetX = (VIEW - drawnW) / 2;
  const offsetY = (VIEW - drawnH) / 2;

  // Posições dos glifos no sistema final (já em pixels do viewBox).
  const bX = offsetX - bbB.x1 * ratio;
  const eX =
    offsetX + (bbB.x2 - bbB.x1) * ratio + tracking * ratio - bbE.x1 * ratio;
  const baselineY = offsetY - minY * ratio;

  const dB = commandsToD(B.getPath(bX, baselineY, finalFS).commands);
  const dE = commandsToD(E.getPath(eX, baselineY, finalFS).commands);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}">
  <path fill="#ffffff" fill-rule="evenodd" d="${dB}"/>
  <path fill="#ffffff" fill-rule="evenodd" d="${dE}"/>
</svg>
`;

  await fs.writeFile(OUTPUT_PATH, svg, 'utf8');
  console.log(
    `Favicon escrito: ${path.relative(PROJECT_ROOT, OUTPUT_PATH)} | bloco renderizado: ${drawnW.toFixed(1)} x ${drawnH.toFixed(1)} px`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
