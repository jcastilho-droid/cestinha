// Cartões de compartilhamento (WhatsApp, redes): uma imagem PNG por jogo.
//   _site/cartoes/<id>.png        1200x630  (prévia de link no WhatsApp, X, Facebook)
//   _site/cartoes/<id>-story.png  1080x1920 (stories do Instagram/WhatsApp)
// Usa @resvg/resvg-js (gratuito). Se não estiver instalado, o site é gerado sem os cartões.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './lib/util.js';

const FONTES = ['Anton-Regular.ttf', 'Inter-Bold.ttf', 'Inter-Medium.ttf'].map((f) => path.join(RAIZ, 'site', 'assets', f));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const cacheLogos = new Map();
async function logoBase64(url) {
  if (!url) return null;
  const escuro = url.replace('/500/scoreboard/', '/500-dark/scoreboard/');
  if (cacheLogos.has(escuro)) return cacheLogos.get(escuro);
  let dado = null;
  try {
    const r = await fetch(escuro, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (r.ok) dado = `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
  } catch { /* sem rede: usa a sigla */ }
  cacheLogos.set(escuro, dado);
  return dado;
}

// quebra o título em linhas (aproximação pela largura média dos caracteres)
function quebrar(texto, maxCar, maxLinhas) {
  const palavras = String(texto || '').split(/\s+/);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    if ((atual + ' ' + p).trim().length > maxCar) { linhas.push(atual.trim()); atual = p; } else atual += ' ' + p;
  }
  if (atual.trim()) linhas.push(atual.trim());
  if (linhas.length > maxLinhas) { linhas.length = maxLinhas; linhas[maxLinhas - 1] = linhas[maxLinhas - 1].replace(/\s*\S*$/, '') + '…'; }
  return linhas;
}

const ARO = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
  <circle cx="58" cy="22" r="18" fill="#ff7a1a"/>
  <g fill="none" stroke="#3a1a05" stroke-width="2.4"><path d="M40 22h36M58 4v36M47 9c5 4 6 8 6 13s-1 9-6 13M69 9c-5 4-6 8-6 13s1 9 6 13"/></g>
  <ellipse cx="48" cy="58" rx="40" ry="9" fill="none" stroke="#ff7a1a" stroke-width="6"/>
  <g stroke="#fff" stroke-width="2.4" fill="none"><path d="M10 60l12 50M30 66l6 44M48 67v43M66 66l-6 44M86 60l-12 50M16 80h64M20 96h56"/></g></g>`;

function escudo(t, logo, cx, cy, r) {
  if (logo) return `<image href="${logo}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="${r * 0.8}" fill="#2a3547"/><text x="${cx}" y="${cy + r * 0.22}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="${r * 0.55}" fill="#fff">${esc(t.sigla)}</text>`;
}

function svgOg(j, texto, destaque, lv, lc, dataTxt) {
  const v = j.visitante; const c = j.casa;
  const linhas = quebrar(texto?.titulo || `${v.nome_curto} x ${c.nome_curto}`, 46, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${v.cor || '#333'}"/><stop offset=".42" stop-color="#0b0f15"/><stop offset=".58" stop-color="#0b0f15"/><stop offset="1" stop-color="${c.cor || '#333'}"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#f)"/>
  <rect width="1200" height="630" fill="url(#b)"/>
  <g fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="3"><circle cx="600" cy="270" r="120"/><line x1="600" y1="0" x2="600" y2="630"/></g>
  ${ARO(48, 34, 0.42)}<text x="98" y="78" font-family="Anton" font-size="40" fill="#fff" letter-spacing="2">CESTINHA</text>
  <text x="1152" y="74" text-anchor="end" font-family="Inter" font-weight="700" font-size="24" fill="#ffffff" fill-opacity=".75">${esc(dataTxt)}</text>
  ${escudo(v, lv, 200, 280, 95)}${escudo(c, lc, 1000, 280, 95)}
  <text x="200" y="420" text-anchor="middle" font-family="Anton" font-size="34" fill="#fff">${esc(v.nome_curto).toUpperCase()}</text>
  <text x="1000" y="420" text-anchor="middle" font-family="Anton" font-size="34" fill="#fff">${esc(c.nome_curto).toUpperCase()}</text>
  <text x="510" y="320" text-anchor="end" font-family="Anton" font-size="140" fill="#fff" fill-opacity="${v.vencedor ? 1 : 0.55}">${v.placar}</text>
  <text x="600" y="300" text-anchor="middle" font-family="Anton" font-size="44" fill="#fff" fill-opacity=".6">x</text>
  <text x="690" y="320" text-anchor="start" font-family="Anton" font-size="140" fill="#fff" fill-opacity="${c.vencedor ? 1 : 0.55}">${c.placar}</text>
  <text x="600" y="368" text-anchor="middle" font-family="Inter" font-weight="700" font-size="22" fill="#ffa25c" letter-spacing="3">${j.prorrogacoes ? 'FINAL NA PRORROGAÇÃO' : 'FINAL'}</text>
  ${linhas.map((l, i) => `<text x="600" y="${490 + i * 46}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="38" fill="#fff">${esc(l)}</text>`).join('')}
  ${destaque ? `<text x="600" y="${490 + linhas.length * 46 + 10}" text-anchor="middle" font-family="Inter" font-weight="500" font-size="24" fill="#c3ccd8">${esc(destaque)}</text>` : ''}
  <rect x="0" y="618" width="1200" height="12" fill="#ff7a1a"/>
</svg>`;
}

function svgStory(j, texto, destaque, lv, lc, dataTxt) {
  const v = j.visitante; const c = j.casa;
  const linhas = quebrar(texto?.titulo || `${v.nome_curto} x ${c.nome_curto}`, 26, 3);
  const sub = quebrar(texto?.subtitulo || '', 40, 2);
  const yDest = 1430 + linhas.length * 70 + 30 + sub.length * 44 + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.cor || '#333'}"/><stop offset=".38" stop-color="#0b0f15"/><stop offset=".62" stop-color="#0b0f15"/><stop offset="1" stop-color="${c.cor || '#333'}"/></linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#f)"/>
  <rect width="1080" height="1920" fill="#000" fill-opacity=".25"/>
  <g fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="4"><circle cx="540" cy="760" r="180"/><line x1="0" y1="760" x2="1080" y2="760"/></g>
  ${ARO(380, 110, 0.8)}<text x="470" y="200" font-family="Anton" font-size="76" fill="#fff" letter-spacing="3">CESTINHA</text>
  <text x="540" y="290" text-anchor="middle" font-family="Inter" font-weight="700" font-size="34" fill="#fff" fill-opacity=".75">${esc(dataTxt)}</text>
  ${escudo(v, lv, 540, 470, 120)}
  <text x="540" y="650" text-anchor="middle" font-family="Anton" font-size="52" fill="#fff">${esc(v.nome_curto).toUpperCase()}</text>
  <text x="300" y="860" text-anchor="middle" font-family="Anton" font-size="190" fill="#fff" fill-opacity="${v.vencedor ? 1 : 0.55}">${v.placar}</text>
  <text x="540" y="830" text-anchor="middle" font-family="Anton" font-size="60" fill="#fff" fill-opacity=".6">x</text>
  <text x="780" y="860" text-anchor="middle" font-family="Anton" font-size="190" fill="#fff" fill-opacity="${c.vencedor ? 1 : 0.55}">${c.placar}</text>
  <text x="540" y="940" text-anchor="middle" font-family="Inter" font-weight="700" font-size="30" fill="#ffa25c" letter-spacing="4">${j.prorrogacoes ? 'FINAL NA PRORROGAÇÃO' : 'FINAL'}</text>
  <text x="540" y="1040" text-anchor="middle" font-family="Anton" font-size="52" fill="#fff">${esc(c.nome_curto).toUpperCase()}</text>
  ${escudo(c, lc, 540, 1190, 120)}
  ${linhas.map((l, i) => `<text x="540" y="${1430 + i * 70}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="58" fill="#fff">${esc(l)}</text>`).join('')}
  ${sub.map((l, i) => `<text x="540" y="${1430 + linhas.length * 70 + 30 + i * 44}" text-anchor="middle" font-family="Inter" font-weight="500" font-size="34" fill="#c3ccd8">${esc(l)}</text>`).join('')}
  ${destaque ? `<text x="540" y="${Math.min(yDest, 1820)}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="34" fill="#ffa25c">${esc(destaque)}</text>` : ''}
  <text x="540" y="1868" text-anchor="middle" font-family="Inter" font-weight="500" font-size="28" fill="#fff" fill-opacity=".7">A NBA pra quem dormiu</text>
  <rect x="0" y="1900" width="1080" height="20" fill="#ff7a1a"/>
</svg>`;
}

export async function gerarCartoes(lista, pastaSite) {
  let Resvg;
  try {
    ({ Resvg } = await import('@resvg/resvg-js'));
  } catch {
    console.log('[cartões] @resvg/resvg-js não instalado: cartões de compartilhamento pulados.');
    return new Set();
  }
  const pasta = path.join(pastaSite, 'cartoes');
  fs.mkdirSync(pasta, { recursive: true });
  const feitos = new Set();
  const opcoes = (w) => ({ fitTo: { mode: 'width', value: w }, font: { fontFiles: FONTES, loadSystemFonts: false, defaultFontFamily: 'Inter' } });
  for (const { jogo, texto, destaque, dataTxt } of lista) {
    try {
      const lv = await logoBase64(jogo.visitante.logo);
      const lc = await logoBase64(jogo.casa.logo);
      fs.writeFileSync(path.join(pasta, `${jogo.id}.png`), new Resvg(svgOg(jogo, texto, destaque, lv, lc, dataTxt), opcoes(1200)).render().asPng());
      fs.writeFileSync(path.join(pasta, `${jogo.id}-story.png`), new Resvg(svgStory(jogo, texto, destaque, lv, lc, dataTxt), opcoes(1080)).render().asPng());
      feitos.add(jogo.id);
    } catch (e) {
      console.error(`[cartões] jogo ${jogo.id}: ${e.message}`);
    }
  }
  console.log(`[cartões] ${feitos.size} jogo(s) com cartão de compartilhamento.`);
  return feitos;
}
