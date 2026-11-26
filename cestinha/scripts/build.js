// Gera o site estático em _site/ a partir de content/ (textos) e data/raw/ (números).
// Uso: node scripts/build.js
// Regras: números SEMPRE vêm de data/raw; content/revisao/ NUNCA é publicado.
import fs from 'node:fs';
import path from 'node:path';
import { P, RAIZ, lerJson, listarDiasRaw, horaBrasilia, dataPorExtenso, dataCurta, dataHoraBrasilia, agoraIso, dataHoraCurta, dataCurtaIso } from './lib/util.js';
import { lerRodada, lerJogo, selosDoJogo, lideresDaRodada, linhaEstatistica } from './lib/dados.js';
import { icone, comIcones, LOGO_ARO } from './lib/icones.js';
import { gerarCartoes } from './cartoes.js';
import { gerarCestinhaStats } from './stats.js';
import { VERBETES, CATEGORIAS, exemplosReais } from './lib/verbetes.js';

const MENU = [['rodada', 'index.html', 'bola', 'Rodada'], ['agenda', 'agenda.html', 'calendario', 'Agenda'], ['classificacao', 'classificacao.html', 'trofeu', 'Tabela'], ['times', 'times/index.html', 'escudo', 'Times'], ['stats', 'stats.html', 'trofeu', 'Stats'], ['aprenda', 'aprenda.html', 'cesta', 'Aprenda']];

// muda a cada publicação: força o navegador a baixar o visual novo
const VERSAO = Date.now().toString(36);

const SITE = {
  nome: 'Cestinha',
  slogan: 'A NBA pra quem dormiu',
  bordao: 'E aí, aqui é o Cestinha',
  url: (process.env.SITE_URL || 'https://jcastilho-droid.github.io/cestinha').replace(/\/$/, ''),
};

// ---------- utilitários de HTML ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>');
}

// Markdown simples: parágrafos, ## títulos, listas, **negrito**, *itálico*, links.
function markdown(md) {
  const linhas = String(md || '').replace(/\r/g, '').split('\n');
  const out = [];
  let lista = null;
  let par = [];
  const fecharPar = () => { if (par.length) { out.push(`<p>${inline(par.join(' '))}</p>`); par = []; } };
  const fecharLista = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  for (const l of linhas) {
    const t = l.trim();
    let m;
    if (!t) { fecharPar(); fecharLista(); continue; }
    if ((m = t.match(/^#{1,4}\s+(.*)$/))) { fecharPar(); fecharLista(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    if ((m = t.match(/^[-*•]\s+(.*)$/)) || (m = t.match(/^\d+[.)]\s+(.*)$/))) {
      fecharPar();
      const tipo = /^\d/.test(t) ? 'ol' : 'ul';
      if (lista !== tipo) { fecharLista(); out.push(`<${tipo}>`); lista = tipo; }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    fecharLista();
    par.push(t);
  }
  fecharPar(); fecharLista();
  return out.join('\n');
}

function selo(status) {
  if (!status || status === 'N/A') return '';
  const cls = { CONFIRMADO: 'ok', REPORTADO: 'rep', RUMOR: 'rumor' }[status] || 'rep';
  return `<span class="selo selo-${cls}">${esc(status)}</span>`;
}

function selosEpicos(selos, max = 3) {
  return selos.slice(0, max).map((s) => `<span class="tag tag-${s.id}">${esc(s.rotulo)}</span>`).join('');
}

// Logo em versão para fundo escuro (a ESPN publica as duas)
const logoEscuro = (url) => (url ? url.replace('/500/scoreboard/', '/500-dark/scoreboard/') : '');
function logo(t, tam = 32) {
  if (!t.logo) return `<span class="sigla" style="width:${tam}px;height:${tam}px">${esc(t.sigla)}</span>`;
  return `<img class="logo" src="${esc(logoEscuro(t.logo))}" alt="${esc(t.nome_curto)}" width="${tam}" height="${tam}" loading="lazy" onerror="this.onerror=null;this.src='${esc(t.logo)}'">`;
}
const cor = (t) => (t?.cor && /^#[0-9a-f]{6}$/i.test(t.cor) ? t.cor : '#ff7a1a');

function trilhoEscudos(raiz) {
  if (typeof times === 'undefined' || !times.size || !indiceTimes?.classificacao) return '';
  const grupo = (conf) => (indiceTimes.classificacao[conf] || []).map((l) => times.get(l.id)).filter(Boolean)
    .map((t) => `<a href="${raiz}/times/${slugTime(t)}.html" title="${esc(t.nome)}" style="--t1:${t.cor || '#ff7a1a'}">${logo({ logo: t.logo, sigla: t.sigla, nome_curto: t.nome_curto }, 26)}</a>`).join('');
  return `<aside class="trilho trilho-dir" aria-label="Times">
    <span class="trilho-rot">Leste</span>${grupo('Leste')}<span class="trilho-rot">Oeste</span>${grupo('Oeste')}
  </aside>`;
}

function pagina(o) { return paginaBruta(o).replace(/@@RAIZ@@/g, o.raiz || '.'); }
function paginaBruta({ titulo, descricao, corpo, raiz = '.', canonical = '', faixa = '', tema = '', ativo = '', imagem = '' }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<meta name="theme-color" content="#0a0d12">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:locale" content="pt_BR">
<meta property="og:type" content="website">
${canonical ? `<meta property="og:url" content="${esc(SITE.url + canonical)}">` : ''}
${imagem ? `<meta property="og:image" content="${esc(imagem)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(imagem)}">` : ''}
${canonical && SITE.url ? `<link rel="canonical" href="${esc(SITE.url + canonical)}">` : ''}
<link rel="icon" href="${raiz}/assets/icone.svg?v=${VERSAO}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,800;1,900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${raiz}/assets/estilo.css?v=${VERSAO}">
<script src="${raiz}/assets/efeitos.js?v=${VERSAO}" defer></script>
<link rel="stylesheet" href="${raiz}/assets/visual-v6.css?v=${VERSAO}">
<script src="${raiz}/assets/visual-v6.js?v=${VERSAO}" defer></script>
<link rel="stylesheet" href="${raiz}/assets/stats.css?v=${VERSAO}">
<script src="${raiz}/assets/stats.js?v=${VERSAO}" defer></script>
</head>
<body${tema ? ` style="${tema}"` : ''}>
<div class="fundo-deco" aria-hidden="true">
  <span class="brilho b1"></span><span class="brilho b2"></span><span class="brilho b3"></span>
</div>

${trilhoEscudos(raiz)}
<header class="topo">
  <div class="topo-dentro">
    <a class="marca logo" href="${raiz}/index.html" aria-label="Cestinha, página inicial">${LOGO_ARO}<span class="logo-texto">CESTINHA</span></a>
    <div class="topo-acoes">
      <nav class="menu" aria-label="Seções">${MENU.map(([id, href, ic, rot]) => `<a href="${raiz}/${href}"${ativo === id ? ' class="ativo"' : ''}>${icone(ic)}<span>${rot}</span></a>`).join('')}</nav>
      <a class="meu-time-atalho" href="#" hidden aria-label="Meu time"></a>
      <button class="botao-spoiler" type="button" aria-pressed="false" title="Modo sem spoiler: esconde placares e resultados">${icone('olho')}<span>Sem spoiler</span></button>
    </div>
  </div>
  ${faixa}
</header>
<main>
${comIcones(corpo)}
</main>
<nav class="barra-inferior" aria-label="Seções">${MENU.map(([id, href, ic, rot]) => `<a href="${raiz}/${href}"${ativo === id ? ' class="ativo"' : ''}>${icone(ic)}<span>${rot}</span></a>`).join('')}</nav>
<div class="aviso-spoiler" hidden>${icone('olho')} Modo sem spoiler ligado: toque num bloco borrado para revelar.</div>
<footer class="rodape">
  <div class="rodape-dentro">
    <div class="rodape-topo">
      <p class="rodape-marca logo">${LOGO_ARO}<span class="logo-texto">CESTINHA</span></p>
      <p class="rodape-bordao">${esc(SITE.bordao)}</p>
    </div>
    <p class="rodape-links"><a href="${raiz}/agenda.html">Agenda</a><a href="${raiz}/classificacao.html">Classificação</a><a href="${raiz}/times/index.html">Times</a><a href="${raiz}/brasileiros.html">Brasileiros na NBA</a><a href="${raiz}/aprenda.html">Me explica essa NBA</a>${powerRankings.length ? `<a href="${raiz}/power-ranking.html">Power ranking</a>` : ''}</p>
    <p>${icone('grafico')} Placar e estatísticas: ESPN. ${icone('raio')} Textos: o Cestinha (IA), com checagem automática dos números.</p>
    <p>${icone('relogio')} Horários de Brasília. Atualizado em ${esc(dataHoraBrasilia(agoraIso()))}. Logos dos times exibidos só para identificação.</p>
    <p class="rodape-autor">Desenvolvido por <b>Jonathan Castilho</b> · <span>LiveMode</span></p>
  </div>
</footer>
</body>
</html>
`;
}

// ---------- dados ----------
const textosJogo = new Map();
const textosRodada = new Map();
for (const [dir, mapa] of [[P.jogos, textosJogo], [P.rodadas, textosRodada]]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const t = lerJson(path.join(dir, f));
    if (t && (!t.alertas || t.alertas.length === 0)) mapa.set(f.replace(/\.json$/, ''), t); // segurança extra
  }
}

const dias = listarDiasRaw()
  .map((d) => ({ dia: d, rodada: lerRodada(d) }))
  .filter((x) => x.rodada && x.rodada.jogos.length);

// jogo completo (com box score) quando existe; senão o resumo do placar
function jogoDoDia(dia, base) {
  const j = (base.status === 'final' && lerJogo(dia, base.id)) || structuredClone(base);
  j.data_rodada = dia;
  if (j.status === 'final' && j.casa.vencedor == null) {
    j.casa.vencedor = j.casa.placar > j.visitante.placar;
    j.visitante.vencedor = !j.casa.vencedor;
  }
  return j;
}

function situacao(j) {
  if (j.status === 'final') return j.periodo > 4 ? (j.periodo === 5 ? 'Final · prorrogação' : `Final · ${j.periodo - 4} prorrogações`) : 'Final';
  if (j.status === 'em_andamento') return 'Ao vivo';
  if (j.status === 'adiado') return 'Adiado';
  return `${horaBrasilia(j.inicio_utc)}`;
}

// ---------- componentes ----------
function faixaPlacares(jogos, raiz) {
  if (!jogos.length) return '';
  return `<nav class="faixa" aria-label="Placares da rodada"><div class="faixa-trilho">
  ${jogos.map((j) => {
    const final = j.status === 'final';
    const tag = j.casa.jogadores ? 'a' : 'div';
    const href = j.casa.jogadores ? ` href="${raiz}/jogo/${j.id}.html"` : '';
    const lin = (t) => `<span class="fx-time${final && t.vencedor ? ' venceu' : ''}">${logo(t, 18)}<span>${esc(t.sigla)}</span><b>${t.placar ?? ''}</b></span>`;
    return `<${tag} class="fx-jogo"${href}>${lin(j.visitante)}${lin(j.casa)}<span class="fx-sit">${esc(final ? (j.periodo > 4 ? 'PRORR.' : 'FINAL') : situacao(j))}</span></${tag}>`;
  }).join('')}
  </div></nav>`;
}

function linhaTime(t, final) {
  const venceu = final && t.vencedor;
  return `<div class="linha-time${venceu ? ' venceu' : ''}">
    ${logo(t, 34)}
    <span class="nome">${esc(t.nome_curto)}<small>${esc(t.campanha || '')}</small></span>
    <span class="pontos">${t.placar ?? ''}</span>
  </div>`;
}

function cardJogo(j, raiz) {
  const final = j.status === 'final';
  const texto = textosJogo.get(j.id);
  const selos = selosDoJogo(j);
  const temPagina = !!j.casa.jogadores;
  const tag = temPagina ? 'a' : 'div';
  const href = temPagina ? ` href="${raiz}/jogo/${j.id}.html"` : '';
  const epico = selos.some((s) => s.epico);
  const protagonista = protagonistaJogo(j);
  return `<${tag} class="card-jogo${epico ? ' epico' : ''}"${href} data-luz data-times="${esc(j.visitante.sigla)} ${esc(j.casa.sigla)}" style="--c1:${cor(j.visitante)};--c2:${cor(j.casa)}">
    ${j.arena?.foto ? `<div class="card-arena" style="--foto:url('${esc(j.arena.foto)}')"><span>${icone('arena')} ${esc(j.arena.nome)}</span>${protagonista ? `${fotoPessoa(protagonista.nome, 'v6-jogo-foto')}<b class="v6-hero-label">EM DESTAQUE · ${esc(protagonista.nome)}</b>` : ''} </div>` : ''}
    <div class="card-topo"><span class="situacao">${esc(situacao(j))}<em>${esc(dataHoraCurta(j.inicio_utc))}</em></span><span class="tags">${selosEpicos(selos, 2)}</span></div>
    ${linhaTime(j.visitante, final)}
    ${linhaTime(j.casa, final)}
    ${texto ? `<p class="card-titulo">${esc(texto.titulo)}</p>` : final ? '<p class="card-titulo espera">Resenha chegando…</p>' : ''}
  </${tag}>`;
}

function cardDestaque(lideres, raiz) {
  const p = lideres.destaque;
  return `<a class="destaque-noite" data-tilt href="${raiz}/jogo/${p.jogo}.html" style="--c1:${cor(p.time)}">
    <div class="dn-rotulo">${icone('coroa')} Destaque da noite</div>
    <div class="dn-corpo">
      ${fotoPessoa(p.nome, 'v6-destaque-foto') || logo(p.time, 56)}
      <div><p class="dn-nome">${esc(p.nome)}</p><p class="dn-time">${esc(p.time.nome)}</p></div>
    </div>
    <div class="dn-numeros">
      <div><b>${p.pts}</b><span>PTS</span></div>
      <div><b>${p.reb}</b><span>REB</span></div>
      <div><b>${p.ast}</b><span>AST</span></div>
      <div class="dn-fg"><b>${esc(p.fg)}</b><span>ARREM.</span></div>
    </div>
  </a>`;
}

function fotoPessoa(nome, classe = 'v6-foto') {
  const normalizar = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const alvo = normalizar(nome);
  let id = '';
  if (typeof times !== 'undefined') for (const time of times.values()) {
    const pessoa = (time.elenco || []).find(p => normalizar(p.nome) === alvo);
    if (pessoa && /^\d+$/.test(String(pessoa.id))) { id = String(pessoa.id); break; }
  }
  return id ? `<img class="${classe}" src="https://a.espncdn.com/i/headshots/nba/players/full/${id}.png" alt="Retrato de ${esc(nome)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
}

function protagonistaJogo(j) {
  const candidatos = [...(j.casa?.jogadores || []), ...(j.visitante?.jogadores || [])]
    .filter(p => Number.isFinite(Number(p.pts)) && fotoPessoa(p.nome))
    .sort((a, b) => Number(b.pts) - Number(a.pts));
  return candidatos[0] || null;
}

function numeroDaCamisa(timeId, nome) {
  const t = typeof times !== 'undefined' ? times.get(String(timeId)) : null;
  const semAc = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return t?.elenco?.find((p) => semAc(p.nome) === semAc(nome))?.numero ?? '';
}

function camisaSvg(cor1, cor2, numero) {
  return `<svg class="camisa-svg" viewBox="0 0 120 130" aria-hidden="true">
    <path d="M38 6h44c0 10 8 18 18 18l14 8-6 26-14-4v72H26V54l-14 4-6-26 14-8C30 24 38 16 38 6z" fill="${cor1}" stroke="${cor2}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M38 6c2 12 10 20 22 20s20-8 22-20" fill="none" stroke="${cor2}" stroke-width="5"/>
    <path d="M26 54v72M94 54v72" stroke="${cor2}" stroke-width="3" opacity=".5"/>
    <text x="60" y="98" text-anchor="middle" font-family="Anton, Barlow Condensed, sans-serif" font-size="44" fill="#fff" stroke="${cor2}" stroke-width="1.5">${esc(numero)}</text>
  </svg>`;
}

function blocoDecisivos(lideres, raiz) {
  if (!lideres?.decisivos?.length) return '';
  return `<section class="decisivos sec-decisivos">
  <h2 class="titulo-secao"><span>Os decisivos da noite</span><small>as melhores atuações pelo Game Score</small></h2>
  <div class="grade-cartas">
    ${lideres.decisivos.map((p, i) => {
      const t = p.time;
      const tc = typeof times !== 'undefined' ? times.get(String(t.id)) : null;
      const c1 = t.cor || '#ff7a1a';
      const c2 = tc?.cor_alt || '#ffffff';
      return `<a class="carta" href="${raiz}/jogo/${p.jogo}.html" style="--c1:${c1};--c2:${c2}" data-tilt>
        <span class="carta-pos">#${i + 1}</span>
        <span class="carta-gs"><b>${p.gs.toFixed(1)}</b><small>GAME SCORE</small></span>
        <div class="carta-arte">${fotoPessoa(p.nome, 'v6-carta-foto') || camisaSvg(c1, c2, numeroDaCamisa(t.id, p.nome))}<span class="carta-logo">${logo(t, 34)}</span></div>
        <div class="carta-info">
          <b class="carta-nome">${esc(p.nome)}</b>
          <span class="carta-time">${esc(t.nome_curto)}</span>
          <div class="carta-stats"><div><b>${p.pts}</b><small>PTS</small></div><div><b>${p.reb}</b><small>REB</small></div><div><b>${p.ast}</b><small>AST</small></div><div><b>${esc(p.fg)}</b><small>ARR</small></div></div>
        </div>
      </a>`;
    }).join('')}
  </div>
  <p class="legenda">Game Score: índice criado pelo analista John Hollinger que soma pontos, rebotes, assistências, roubos e tocos e desconta arremessos errados, erros e faltas.</p>
</section>`;
}

function blocoLideres(lideres, raiz) {
  return `<section class="lideres sec-lideres">
  <h2 class="titulo-secao"><span>Líderes da noite</span></h2>
  <div class="grade-lideres">
    ${lideres.categorias.map((c) => `<a class="lider" href="${raiz}/jogo/${c.p.jogo}.html" style="--c1:${cor(c.p.time)}">
      <span class="lider-cat">${esc(c.rotulo)}</span>
      <span class="lider-valor">${esc(c.valor(c.p))}</span>
      <span class="lider-nome">${logo(c.p.time, 18)}${esc(c.p.nome)}</span>
      ${fotoPessoa(c.p.nome, 'v6-lider-foto')}
    </a>`).join('')}
  </div>
</section>`;
}

function blocoEpicos(jogos, raiz) {
  const epicos = jogos.filter((j) => selosDoJogo(j).some((s) => s.epico));
  if (!epicos.length) return '';
  return `<section class="epicos sec-epicos">
  <h2 class="titulo-secao"><span>Jogos épicos</span><small>prorrogação, virada, decisão no detalhe, 40+ pontos, triplo-duplo</small></h2>
  <div class="trilho-epicos">
    ${epicos.map((j) => {
      const texto = textosJogo.get(j.id);
      const venc = j.casa.vencedor ? j.casa : j.visitante;
      const perd = j.casa.vencedor ? j.visitante : j.casa;
      return `<a class="card-epico" data-tilt href="${raiz}/jogo/${j.id}.html" style="--c1:${cor(venc)};--c2:${cor(perd)}">
        <span class="tags">${selosEpicos(selosDoJogo(j).filter((s) => s.epico))}</span>
        <span class="ep-data">${esc(dataHoraCurta(j.inicio_utc))}</span>
        <div class="ep-placar">${logo(venc, 40)}<b>${venc.placar}</b><span>x</span><b class="perdeu">${perd.placar}</b>${logo(perd, 40)}</div>
        <p>${esc(texto?.titulo || `${venc.nome_curto} vence ${perd.nome_curto}`)}</p>
      </a>`;
    }).join('')}
  </div>
</section>`;
}

function numerosDaRodada(jogos) {
  const finais = jogos.filter((j) => j.status === 'final');
  if (!finais.length) return '';
  const pontos = finais.reduce((s, j) => s + j.casa.placar + j.visitante.placar, 0);
  const maior = finais.reduce((m, j) => Math.max(m, j.casa.placar, j.visitante.placar), 0);
  const ot = finais.filter((j) => j.periodo > 4).length;
  return `<div class="numeros-rodada">
    <div>${icone('bola')}<b data-contar="${finais.length}">${finais.length}</b><span>jogos</span></div>
    <div>${icone('cesta')}<b data-contar="${pontos}">${pontos}</b><span>pontos</span></div>
    <div>${icone('raio')}<b data-contar="${maior}">${maior}</b><span>maior placar</span></div>
    <div>${icone('relogio')}<b data-contar="${ot}">${ot}</b><span>${ot === 1 ? 'prorrogação' : 'prorrogações'}</span></div>
  </div>`;
}

function blocoRodada(dia, rodada, raiz, home = false) {
  const resumo = textosRodada.get(dia);
  const jogos = rodada.jogos.map((b) => jogoDoDia(dia, b));
  const ordem = [...jogos].sort((a, b) => (textosJogo.get(b.id)?.importancia || 0) - (textosJogo.get(a.id)?.importancia || 0) || a.inicio_utc.localeCompare(b.inicio_utc));
  const finalizados = jogos.filter((j) => j.status === 'final').length;
  const completos = jogos.filter((j) => j.casa.jogadores);
  const lideres = lideresDaRodada(completos);
  const palco = [...jogos].filter((j) => j.arena?.foto).sort((a, b) => (textosJogo.get(b.id)?.importancia || 0) - (textosJogo.get(a.id)?.importancia || 0))[0];
  const fotoHero = palco ? ` style="--foto:url('${esc(palco.arena.foto)}')"` : '';
  const creditoHero = palco ? `<span class="credito-foto">${icone('arena')} ${esc(palco.arena.nome)} · foto ESPN</span>` : '';
  const hero = resumo
    ? `<article class="hero com-foto"${fotoHero}>${creditoHero}
        
        <p class="sobretitulo">${icone('calendario')} Rodada de ${esc(dataPorExtenso(dia))}</p>
        <div class="selos">${selo(resumo.status)}</div>
        <h1>${esc(resumo.titulo)}</h1>
        ${resumo.subtitulo ? `<p class="subtitulo">${esc(resumo.subtitulo)}</p>` : ''}
      </article>`
    : `<article class="hero com-foto"${fotoHero}>${creditoHero}
        
        <p class="sobretitulo">${icone('calendario')} Rodada de ${esc(dataPorExtenso(dia))}</p>
        <h1>${finalizados === jogos.length ? 'O resumo da rodada sai daqui a pouco' : 'Rodada em andamento'}</h1>
        <p class="subtitulo">${esc(SITE.bordao)} ${finalizados} de ${jogos.length} jogos finalizados.</p>
      </article>`;
  const top3 = ordem.filter((j) => textosJogo.get(j.id)).slice(0, 3);
  const trintaSeg = top3.length ? `<section class="sec-30s em-30s">
    <p class="em-30s-rot">${icone('relogio')} Em 30 segundos</p>
    <ul>${top3.map((j) => `<li><a href="${raiz}/jogo/${j.id}.html">${esc(textosJogo.get(j.id).titulo)}</a></li>`).join('')}
    ${lideres ? `<li class="em-30s-dest">Destaque: <b>${esc(lideres.destaque.nome)}</b>, ${esc(linhaEstatistica(lideres.destaque))}</li>` : ''}</ul>
  </section>` : '';
  return `
<section class="rodada">
  ${home ? `<section class="meu-cestinha" hidden data-v="${VERSAO}"></section>` : ''}
  ${hero}
  ${trintaSeg}
  ${home ? blocoJogoDaNoite(raiz) : ''}
  ${blocoHojeANoite(raiz)}
  <div class="duas-colunas sec-resumo">
    <div class="coluna-principal">
      ${resumo ? `<article class="resumo-rodada"><h2 class="titulo-secao"><span>Acordei e perdi</span><small>o resumo da noite</small></h2><div class="texto">${comGlossario(markdown(resumo.corpo))}</div></article>` : ''}
    </div>
    <aside class="coluna-lateral">
      ${lideres ? cardDestaque(lideres, raiz) : ''}
    </aside>
  </div>
  ${lideres ? blocoDecisivos(lideres, raiz) : ''}
  ${blocoEpicos(jogos, raiz)}
  <section class="sec-jogos">
    <h2 class="titulo-secao"><span>Todos os jogos</span></h2>
    <div class="grade-jogos">
      ${ordem.map((j) => cardJogo(j, raiz)).join('\n')}
    </div>
  </section>
  ${lideres ? blocoLideres(lideres, raiz) : ''}
</section>`;
}

function listaAnteriores(atual, raiz) {
  const outros = dias.filter((d) => d.dia !== atual).reverse().slice(0, 30);
  if (!outros.length) return '';
  return `<section class="anteriores">
  <h2 class="titulo-secao"><span>Rodadas anteriores</span></h2>
  <ul>${outros.map((d) => `<li><a href="${raiz}/rodada/${d.dia}.html"><span>${esc(dataPorExtenso(d.dia))}</span><span class="qtd">${d.rodada.jogos.length} jogos →</span></a></li>`).join('')}</ul>
</section>`;
}

function tabelaBox(t) {
  const linhas = (t.jogadores || []).map((p) => `<tr class="${p.titular ? 'titular' : ''}">
    <th scope="row">${esc(p.nome)}</th><td>${p.min ?? ''}</td><td class="forte">${p.pts ?? ''}</td><td>${p.reb ?? ''}</td><td>${p.ast ?? ''}</td>
    <td>${esc(p.fg)}</td><td>${esc(p.tres)}</td><td>${esc(p.ll)}</td><td>${p.rb ?? ''}</td><td>${p.toco ?? ''}</td><td>${p.err ?? ''}</td><td>${p.mais_menos > 0 ? '+' : ''}${p.mais_menos ?? ''}</td></tr>`).join('');
  const e = t.estatisticas || {};
  const ausentes = (t.nao_jogaram || []).map((x) => x.nome).join(', ');
  return `<section class="box" style="--c1:${cor(t)}">
  <h3>${logo(t, 28)}${paginaDoTime(t.id, '..') ? `<a href="${paginaDoTime(t.id, '..')}">${esc(t.nome)}</a>` : esc(t.nome)}</h3>
  <div class="rolagem"><table>
    <thead><tr><th scope="col">Jogador</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>AR</th><th>3P</th><th>LL</th><th>RB</th><th>TOC</th><th>ERR</th><th>+/-</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><th scope="row">Time</th><td></td><td class="forte">${t.placar}</td><td>${esc(e.reb)}</td><td>${esc(e.ast)}</td><td>${esc(e.fg)}</td><td>${esc(e.tres)}</td><td>${esc(e.ll)}</td><td></td><td></td><td>${esc(e.err)}</td><td></td></tr></tfoot>
  </table></div>
  ${ausentes ? `<p class="nota">Não jogaram: ${esc(ausentes)}</p>` : ''}
</section>`;
}

function destaquesDoJogo(j) {
  const cards = [];
  for (const t of [j.visitante, j.casa]) {
    const top = [...(t.jogadores || [])].sort((a, b) => b.pts - a.pts)[0];
    if (top) cards.push(`<div class="mini-destaque" style="--c1:${cor(t)}">${logo(t, 28)}<div><b>${esc(top.nome)}</b><span>${esc(linhaEstatistica(top))}</span></div></div>`);
  }
  return `<div class="mini-destaques">${cards.join('')}</div>`;
}

function comparativo(j) {
  const linhas = [
    ['Arremessos', 'fg', 'fg_pct'], ['Bolas de três', 'tres', 'tres_pct'], ['Lances livres', 'll'],
    ['Rebotes', 'reb'], ['Assistências', 'ast'], ['Erros', 'err'], ['Pontos no garrafão', 'pontos_garrafao'], ['Maior vantagem', 'maior_vantagem'],
  ];
  const v = j.visitante.estatisticas || {};
  const c = j.casa.estatisticas || {};
  const num = (x) => Number(String(x ?? '0').split('-')[0]) || 0;
  return `<section class="comparativo" style="--c1:${cor(j.visitante)};--c2:${cor(j.casa)}">
  <h2 class="titulo-secao"><span>Duelo em números</span></h2>
  <div class="comp-cab"><span>${logo(j.visitante, 22)}${esc(j.visitante.sigla)}</span><span>${esc(j.casa.sigla)}${logo(j.casa, 22)}</span></div>
  ${linhas.map(([rot, k, pct]) => {
    const a = num(v[k]); const b = num(c[k]);
    const tot = a + b || 1;
    const fmt = (e) => `${esc(e[k] ?? '-')}${pct && e[pct] ? ` <small>(${esc(e[pct])}%)</small>` : ''}`;
    return `<div class="comp-linha"><div class="comp-val">${fmt(v)}</div><div class="comp-meio"><span class="comp-rot">${rot}</span><div class="comp-barra"><i style="width:${(a / tot) * 100}%"></i><i style="width:${(b / tot) * 100}%"></i></div></div><div class="comp-val dir">${fmt(c)}</div></div>`;
  }).join('')}
</section>`;
}

function paginaJogo(j, faixa, temCartao = false) {
  const texto = textosJogo.get(j.id);
  const raiz = '..';
  const selos = selosDoJogo(j);
  const nPer = Math.max(j.casa.parciais?.length || 0, j.visitante.parciais?.length || 0);
  const cab = Array.from({ length: nPer }, (_, i) => (i < 4 ? `${i + 1}º` : `P${i - 3}`));
  const parciais = nPer ? `<div class="rolagem"><table class="parciais">
    <thead><tr><th></th>${cab.map((c) => `<th>${c}</th>`).join('')}<th>T</th></tr></thead>
    <tbody>${[j.visitante, j.casa].map((t) => `<tr><th scope="row">${logo(t, 20)} ${esc(t.sigla)}</th>${(t.parciais || []).map((p) => `<td>${p}</td>`).join('')}<td class="forte">${t.placar}</td></tr>`).join('')}</tbody>
  </table></div>` : '';
  const fontes = [`<a href="${esc(j.link_fonte)}" rel="noopener" target="_blank">ESPN: placar e box score</a>`];
  if (j.materia_fonte?.link) fontes.push(`<a href="${esc(j.materia_fonte.link)}" rel="noopener" target="_blank">ESPN: matéria do jogo (em inglês)</a>`);
  const titulo = texto?.titulo || `${j.visitante.nome_curto} ${j.visitante.placar} x ${j.casa.placar} ${j.casa.nome_curto}`;
  const time = (t) => {
    const pag = paginaDoTime(t.id, raiz);
    const tag = pag ? 'a' : 'div';
    return `<${tag} class="time-grande${t.vencedor ? ' venceu' : ''}"${pag ? ` href="${pag}"` : ''}>${logo(t, 72)}<span>${esc(t.nome_curto)}</span><small>${esc(t.campanha || '')}</small></${tag}>`;
  };
  const corpo = `
<nav class="voltar"><a href="${raiz}/rodada/${j.data_rodada}.html">← Rodada de ${esc(dataCurta(j.data_rodada))}</a></nav>
<section class="placar-grande${j.arena?.foto ? ' com-foto' : ''}" style="--c1:${cor(j.visitante)};--c2:${cor(j.casa)}${j.arena?.foto ? `;--foto:url('${esc(j.arena.foto)}')` : ''}">${j.arena?.foto ? `<span class="credito-foto">${icone('arena')} ${esc(j.arena.nome)} · foto ESPN</span>` : ''}
  ${time(j.visitante)}
  <div class="numeros"><span class="${j.visitante.vencedor ? 'venceu' : ''}">${j.visitante.placar}</span><span class="x">x</span><span class="${j.casa.vencedor ? 'venceu' : ''}">${j.casa.placar}</span><small>${esc(situacao(j))}</small></div>
  ${time(j.casa)}
</section>
${selos.length ? `<div class="tags tags-centro">${selosEpicos(selos, 5)}</div>` : ''}
<p class="info-jogo">${esc(dataPorExtenso(j.data_rodada))}, ${esc(horaBrasilia(j.inicio_utc))} (Brasília)${j.local ? ` · ${esc(j.local)}` : ''}</p>
${parciais}
<nav class="stats-link-jogo" aria-label="Estatísticas"><a href="${raiz}/stats.html?jogo=${esc(j.id)}">📊 Explorar estatísticas interativas deste jogo</a></nav>
${texto ? `<article class="resenha">
  <div class="selos">${selo(texto.status)}</div>
  <h1>${esc(texto.titulo)}</h1>
  ${texto.subtitulo ? `<p class="subtitulo">${esc(texto.subtitulo)}</p>` : ''}
  <div class="texto">${comGlossario(markdown(texto.corpo))}</div>
</article>` : `<article class="resenha vazio"><h1>${esc(titulo)}</h1><p class="subtitulo">A resenha do Cestinha chega em breve. Enquanto isso, os números:</p></article>`}
${blocoExtrasTexto(texto)}
${destaquesDoJogo(j)}
${graficoJogo(j)}
${mapaArremessos(j)}
${comparativo(j)}
<h2 class="titulo-secao"><span>Box score</span></h2>
${tabelaBox(j.visitante)}
${tabelaBox(j.casa)}
<p class="legenda">AR: arremessos de quadra · 3P: bolas de três · LL: lances livres · RB: roubos de bola · TOC: tocos · ERR: erros. Titulares em negrito.</p>
${temCartao ? `<section class="compartilhar">
  <h2 class="titulo-secao"><span>Compartilhar</span><small>leve a resenha pro grupo</small></h2>
  <div class="comp-caixa">
    <img src="${raiz}/cartoes/${j.id}.png" alt="Cartão do jogo ${esc(j.visitante.nome_curto)} x ${esc(j.casa.nome_curto)}" loading="lazy" width="1200" height="630">
    <div class="comp-botoes">
      <a class="btn btn-whats" href="https://wa.me/?text=${encodeURIComponent(`${titulo} ${SITE.url}/jogo/${j.id}.html`)}" target="_blank" rel="noopener">${icone('compartilhar')} WhatsApp</a>
      <button class="btn btn-compartilhar" type="button" data-titulo="${esc(titulo)}" data-url="${esc(`${SITE.url}/jogo/${j.id}.html`)}">${icone('link')} Compartilhar link</button>
      <a class="btn" href="${raiz}/cartoes/${j.id}-story.png" download="cestinha-${j.id}-story.png">${icone('baixar')} Imagem para stories</a>
    </div>
  </div>
</section>` : ''}
<section class="fontes"><h2 class="titulo-secao"><span>Fontes</span></h2><ul>${fontes.map((f) => `<li>${f}</li>`).join('')}</ul></section>`;
  return pagina({ titulo: `${titulo} | Cestinha`, descricao: texto?.subtitulo || `${j.visitante.nome} x ${j.casa.nome}: placar e box score.`, corpo, raiz, canonical: `/jogo/${j.id}.html`, faixa, imagem: temCartao ? `${SITE.url}/cartoes/${j.id}.png` : '' });
}

// ---------- times ----------
const PASTA_TIMES = path.join(RAIZ, 'data', 'times');
// Divisões da NBA (fixas): não dependem do texto da ESPN, que às vezes vem num formato diferente
const DIVISAO_DO_TIME = {
  BOS: 'Atlântico', BKN: 'Atlântico', NY: 'Atlântico', PHI: 'Atlântico', TOR: 'Atlântico',
  CHI: 'Central', CLE: 'Central', DET: 'Central', IND: 'Central', MIL: 'Central',
  ATL: 'Sudeste', CHA: 'Sudeste', MIA: 'Sudeste', ORL: 'Sudeste', WSH: 'Sudeste',
  DEN: 'Noroeste', MIN: 'Noroeste', OKC: 'Noroeste', POR: 'Noroeste', UTAH: 'Noroeste', UTA: 'Noroeste',
  GS: 'Pacífico', LAC: 'Pacífico', LAL: 'Pacífico', PHX: 'Pacífico', SAC: 'Pacífico',
  DAL: 'Sudoeste', HOU: 'Sudoeste', MEM: 'Sudoeste', NO: 'Sudoeste', SA: 'Sudoeste',
};
// Arena de cada time: a do jogo em casa mais recente que coletamos
const arenaDoTime = new Map();
for (const d of listarDiasRaw()) {
  for (const f of fs.readdirSync(path.join(P.raw, d)).filter((x) => /^\d+\.json$/.test(x))) {
    const j = lerJson(path.join(P.raw, d, f));
    if (j?.arena?.nome && j.casa?.id) arenaDoTime.set(String(j.casa.id), j.arena);
  }
}
const indiceTimes = lerJson(path.join(PASTA_TIMES, 'index.json'));
const times = new Map();
if (indiceTimes) {
  for (const b of indiceTimes.times) {
    const t = lerJson(path.join(PASTA_TIMES, `${b.sigla}.json`));
    if (t) {
      const ar = arenaDoTime.get(String(t.id));
      t.arena = ar?.nome || null;
      t.arena_foto = ar?.foto || null;
      t.divisao = { nome: DIVISAO_DO_TIME[t.sigla] || t.divisao?.nome || null, posicao: null };
      times.set(String(t.id), t);
    }
  }
}
{
  const porDiv = new Map();
  for (const t of times.values()) {
    const d = t.divisao?.nome; if (!d) continue;
    if (!porDiv.has(d)) porDiv.set(d, []);
    porDiv.get(d).push(t);
  }
  for (const lista of porDiv.values()) {
    lista.sort((a, b) => (b.classificacao?.v ?? 0) / Math.max(1, (b.classificacao?.v ?? 0) + (b.classificacao?.d ?? 0)) - (a.classificacao?.v ?? 0) / Math.max(1, (a.classificacao?.v ?? 0) + (a.classificacao?.d ?? 0)) || (a.classificacao?.posicao ?? 99) - (b.classificacao?.posicao ?? 99));
    lista.forEach((t, i) => { t.divisao.posicao = i + 1; });
  }
}
const slugTime = (t) => String(t.sigla).toLowerCase();
function paginaDoTime(id, raiz) {
  const t = times.get(String(id));
  return t ? `${raiz}/times/${slugTime(t)}.html` : null;
}

// Cor de destaque legível no fundo escuro: usa a cor principal ou a alternativa do time
function luminancia(hex) {
  const n = parseInt(String(hex || '').replace('#', ''), 16);
  if (Number.isNaN(n)) return 0;
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function corDestaque(t) {
  const ok = (c) => c && luminancia(c) >= 0.09;
  if (ok(t.cor)) return t.cor;
  if (ok(t.cor_alt)) return t.cor_alt;
  return '#ff7a1a';
}
function temaDoTime(t) {
  const base = t.cor && /^#[0-9a-f]{6}$/i.test(t.cor) ? t.cor : '#ff7a1a';
  return `--acento:${corDestaque(t)};--t1:${base};--t2:${t.cor_alt || base}`;
}

const STATUS_LESAO = { Out: 'Fora', 'Day-To-Day': 'Dia a dia', Questionable: 'Dúvida', Doubtful: 'Provável desfalque', Probable: 'Provável', Suspension: 'Suspenso' };
const conferenciaNome = (c) => (c === 'Leste' ? 'Conferência Leste' : 'Conferência Oeste');
const sequenciaPt = (s) => (s ? String(s).replace(/^W/, 'V').replace(/^L/, 'D') : '');
const ordinal = (n) => (n ? `${n}º` : '');

function logoTime(t, tam) {
  return logo({ logo: t.logo, sigla: t.sigla, nome_curto: t.nome_curto }, tam);
}

const DIVISOES_ORDEM = { Leste: ['Atlântico', 'Central', 'Sudeste'], Oeste: ['Noroeste', 'Pacífico', 'Sudoeste'] };

function paginaListaTimes() {
  const raiz = '..';
  const conf = indiceTimes.classificacao || {};
  const linhaDe = (id) => [...(conf.Leste || []), ...(conf.Oeste || [])].find((l) => l.id === id) || {};
  const escudo = (t) => {
    const l = linhaDe(t.id);
    return `<a class="escudo-time" href="${raiz}/times/${slugTime(t)}.html" style="--t1:${t.cor || '#ff7a1a'};--t2:${t.cor_alt || t.cor || '#ff7a1a'};--acento:${corDestaque(t)}${t.arena_foto ? `;--foto:url('${esc(t.arena_foto)}')` : ''}" data-tilt>
      <span class="et-luz"></span>
      <span class="et-logo">${logoTime(t, 120)}</span>
      <span class="et-nome">${esc(t.nome_curto)}</span>
      <span class="et-cidade">${esc(t.cidade || '')}</span>
      <span class="et-camp"><b>${l.v ?? '-'}-${l.d ?? '-'}</b>${l.posicao ? `<em>${ordinal(l.posicao)} no ${t.conferencia}</em>` : ''}</span>
    </a>`;
  };
  const galeria = (nomeConf) => `<section class="bloco-conf conf-${nomeConf === 'Leste' ? 'leste' : 'oeste'}">
    <h2 class="titulo-secao"><span>${conferenciaNome(nomeConf)}</span><small>escolha seu time</small></h2>
    ${DIVISOES_ORDEM[nomeConf].map((div) => {
      const lista = [...times.values()].filter((t) => t.conferencia === nomeConf && t.divisao?.nome === div)
        .sort((a, b) => (a.divisao?.posicao || 9) - (b.divisao?.posicao || 9));
      if (!lista.length) return '';
      return `<div class="divisao"><h3 class="divisao-nome"><span>Divisão ${esc(div)}</span></h3><div class="grade-escudos">${lista.map(escudo).join('')}</div></div>`;
    }).join('')}
  </section>`;
  const tabela = (nome) => `<section class="conferencia">
    <h3 class="divisao-nome"><span>${conferenciaNome(nome)}</span></h3>
    <ol class="lista-times">
      ${(conf[nome] || []).map((linha) => {
        const t = times.get(linha.id);
        if (!t) return '';
        return `<li><a class="linha-classif" href="${raiz}/times/${slugTime(t)}.html" style="--t1:${t.cor || '#ff7a1a'};--acento:${corDestaque(t)}">
          <span class="seed">${linha.posicao ?? ''}</span>
          ${logoTime(t, 34)}
          <span class="lc-nome"><b>${esc(t.nome_curto)}</b><small>${esc(t.cidade || '')}</small></span>
          <span class="lc-camp"><b>${linha.v}-${linha.d}</b><small>${esc(sequenciaPt(linha.sequencia))}</small></span>
          <span class="lc-seta">${icone('seta')}</span>
        </a></li>`;
      }).join('')}
    </ol>
  </section>`;
  const corpo = `
<section class="hero hero-times">
  
  <p class="sobretitulo">${icone('trofeu')} Temporada ${esc(temporadaTexto())}</p>
  <h1>Escolha seu time</h1>
  <div class="atalhos-times"><a href="${raiz}/classificacao.html">${icone('trofeu')} Classificação</a><a href="${raiz}/brasileiros.html">${icone('bandeira')} Brasileiros na NBA</a>${powerRankings.length ? `<a href="${raiz}/power-ranking.html">${icone('coroa')} Power ranking</a>` : ''}</div>
  <p class="subtitulo">Os 30 times da NBA, separados por conferência e divisão. Clique no escudo para ver elenco, estatísticas, últimos resultados e próximos jogos.</p>
  <nav class="seletor-times" aria-label="Escolha um time">
    ${['Leste', 'Oeste'].map((conf) => `<div class="st-conf">
      <span class="st-conf-nome">${conf}</span>
      <div class="st-divisoes">${DIVISOES_ORDEM[conf].map((div) => `<div class="st-div">
        <span class="st-div-nome">${esc(div)}</span>
        <div class="st-escudos">${[...times.values()].filter((t) => t.divisao?.nome === div).sort((a, b) => a.nome_curto.localeCompare(b.nome_curto)).map((t) => `<a class="st-escudo" href="${raiz}/times/${slugTime(t)}.html" style="--t1:${t.cor || '#ff7a1a'}" data-nome="${esc(t.nome_curto)}" aria-label="${esc(t.nome)}">${logoTime(t, 40)}</a>`).join('')}</div>
      </div>`).join('')}</div>
    </div>`).join('')}
  </nav>
</section>
${galeria('Leste')}
${galeria('Oeste')}
<h2 class="titulo-secao"><span>Classificação</span><small>do 1º ao 6º vai direto aos playoffs; do 7º ao 10º, play-in</small></h2>
<div class="conferencias">${tabela('Leste')}${tabela('Oeste')}</div>
<p class="legenda">V: vitórias seguidas · D: derrotas seguidas. Fonte: ESPN, atualizado em ${esc(dataHoraBrasilia(indiceTimes.atualizado_em))}.</p>`;
  return pagina({ titulo: 'Times da NBA | Cestinha', descricao: 'Os 30 times da NBA: classificação, elenco, estatísticas e jogos.', corpo, raiz, canonical: '/times/', ativo: 'times' });
}

function temporadaTexto() {
  const algum = [...times.values()][0];
  const jogo = algum?.jogos?.[0];
  if (!jogo) return '';
  const ano = new Date(jogo.data_utc).getUTCFullYear();
  return `${ano}-${String(ano + 1).slice(2)}`;
}

function paginaTime(t) {
  const raiz = '..';
  const c = t.classificacao || {};
  const est = t.estatisticas || {};
  const finalizados = (t.jogos || []).filter((j) => j.finalizado && j.tipo !== 1);
  const ultimos = finalizados.slice(-10).reverse();
  const proximos = (t.jogos || []).filter((j) => !j.finalizado).slice(0, 5);
  const forma = finalizados.slice(-5).map((j) => `<i class="${j.resultado === 'V' ? 'v' : 'd'}">${j.resultado}</i>`).join('');
  const temStats = t.elenco.some((p) => p.medias);
  const lider = (k, rot) => {
    const p = [...t.elenco].filter((x) => x.medias && x.medias.jogos > 0).sort((a, b) => Number(b.medias[k]) - Number(a.medias[k]))[0];
    return p ? `<div class="lider-time" data-luz><span class="lider-cat">${rot}</span><b>${esc(p.medias[k])}</b><span>${esc(p.nome)}</span></div>` : '';
  };
  const linhaJogo = (j) => {
    const adv = times.get(j.adversario?.id) || j.adversario || {};
    const temPagina = fs.existsSync(path.join(P.raw)) && acharDiaDoJogo(j.id);
    const tag = temPagina ? 'a' : 'div';
    const href = temPagina ? ` href="${raiz}/jogo/${j.id}.html"` : '';
    return `<${tag} class="jogo-time${j.resultado ? ` res-${j.resultado}` : ''}"${href}>
      <span class="jt-data">${esc(j.finalizado ? dataCurtaIso(j.data_utc) : dataHoraCurta(j.data_utc))}</span>
      ${j.resultado ? `<span class="jt-res">${j.resultado}</span>` : '<span class="jt-res prox">•</span>'}
      <span class="jt-adv"><small>${j.em_casa ? 'vs' : '@'}</small>${adv.logo ? logoTime(adv, 26) : ''}<b>${esc(adv.nome_curto || '')}</b></span>
      <span class="jt-placar">${j.placar ? `${j.placar.time}-${j.placar.adversario}` : ''}</span>
    </${tag}>`;
  };
  const elenco = t.elenco.map((p) => {
    const m = p.medias;
    const les = p.lesao?.status ? `<span class="lesao">${esc(STATUS_LESAO[p.lesao.status] || p.lesao.status)}</span>` : '';
    return `<div class="atleta" data-luz>
      ${fotoPessoa(p.nome, 'v6-elenco-foto')}
      <span class="camisa">${esc(p.numero ?? '–')}</span>
      <div class="at-info">
        <b>${esc(p.nome)}</b>
        <span>${[p.posicao, p.idade ? `${p.idade} anos` : null, p.altura_m ? `${p.altura_m.replace('.', ',')} m` : null].filter(Boolean).map(esc).join(' · ')}</span>
        ${les}
      </div>
      <div class="at-medias">${m && m.jogos > 0
        ? `<div><b>${esc(m.pts)}</b><small>PTS</small></div><div><b>${esc(m.reb)}</b><small>REB</small></div><div><b>${esc(m.ast)}</b><small>AST</small></div>`
        : '<span class="sem-jogos">Ainda não jogou</span>'}</div>
    </div>`;
  }).join('');
  const corpo = `
<section class="hero-time${t.arena_foto ? ' com-foto' : ''}"${t.arena_foto ? ` style="--foto:url('${esc(t.arena_foto)}')"` : ''}>${t.arena_foto ? `<span class="credito-foto">${icone('arena')} ${esc(t.arena)} · foto ESPN</span>` : ''}
  <span class="hero-time-faixas" aria-hidden="true"></span>
  <img class="marca-dagua" src="${esc(logoEscuro(t.logo))}" alt="" aria-hidden="true">
  <div class="ht-topo">
    ${logoTime(t, 96)}
    <div>
      <p class="sobretitulo">${esc(conferenciaNome(t.conferencia))}${t.divisao ? ` · Divisão ${esc(t.divisao.nome)}` : ''}</p>
      <h1>${esc(t.nome)}</h1>
      <p class="ht-campanha"><b>${c.v ?? '-'}-${c.d ?? '-'}</b>${c.posicao ? ` · ${ordinal(c.posicao)} no ${esc(t.conferencia)}` : ''}${t.divisao ? ` · ${ordinal(t.divisao.posicao)} na divisão` : ''}</p>
    </div>
  </div>
  <button class="botao-meu-time" type="button" data-sigla="${esc(t.sigla)}" data-logo="${esc(logoEscuro(t.logo))}" data-href="${slugTime(t)}.html" data-nome="${esc(t.nome_curto)}">${icone('estrela')}<span>Seguir como meu time</span></button>
  <div class="chips">
    ${forma ? `<span class="chip forma">${icone('fogo')}Últimos 5 ${forma}</span>` : ''}
    ${c.sequencia ? `<span class="chip">${icone('sequencia')}Sequência <b>${esc(sequenciaPt(c.sequencia))}</b></span>` : ''}
    ${c.casa ? `<span class="chip">${icone('casa')}Em casa <b>${esc(c.casa)}</b></span>` : ''}
    ${c.fora ? `<span class="chip">${icone('aviao')}Fora <b>${esc(c.fora)}</b></span>` : ''}
    ${t.tecnico ? `<span class="chip">${icone('apito')}Técnico <b>${esc(t.tecnico)}</b></span>` : ''}
    ${t.arena ? `<span class="chip">${icone('arena')}Arena <b>${esc(t.arena)}</b></span>` : ''}
  </div>
</section>

<h2 class="titulo-secao"><span>Números do time</span><small>médias por jogo na temporada</small></h2>
<div class="numeros-time">
  <div>${icone('cesta')}<b>${esc(c.pontos_pro ?? est.pts ?? '-')}</b><span>pontos feitos</span></div>
  <div>${icone('escudo')}<b>${esc(c.pontos_contra ?? '-')}</b><span>pontos sofridos</span></div>
  <div>${icone('sequencia')}<b>${esc(c.saldo ?? '-')}</b><span>saldo</span></div>
  <div>${icone('alvo')}<b>${esc(est.reb ?? '-')}</b><span>rebotes</span></div>
  <div>${icone('raio')}<b>${esc(est.ast ?? '-')}</b><span>assistências</span></div>
  <div>${icone('bola')}<b>${esc(est.fg_pct ?? '-')}%</b><span>arremessos</span></div>
  <div>${icone('alvo')}<b>${esc(est.tres_pct ?? '-')}%</b><span>bolas de três</span></div>
  <div>${icone('grafico')}<b>${esc(est.ll_pct ?? '-')}%</b><span>lances livres</span></div>
</div>

${temStats ? `<h2 class="titulo-secao"><span>Líderes do time</span></h2>
<div class="lideres-time">${lider('pts', 'Pontos')}${lider('reb', 'Rebotes')}${lider('ast', 'Assistências')}${lider('rb', 'Roubos')}${lider('toco', 'Tocos')}${lider('min', 'Minutos')}</div>` : ''}

<div class="duas-colunas-jogos">
  <section><h2 class="titulo-secao"><span>Últimos jogos</span></h2><div class="lista-jogos-time">${ultimos.map(linhaJogo).join('') || '<p class="legenda">Sem jogos ainda.</p>'}</div></section>
  <section><h2 class="titulo-secao"><span>Próximos jogos</span><small>horário de Brasília</small></h2><div class="lista-jogos-time">${proximos.map(linhaJogo).join('') || '<p class="legenda">Sem jogos marcados.</p>'}</div></section>
</div>

<h2 class="titulo-secao"><span>Elenco</span><small>${t.elenco.length} jogadores, ordenados por pontos por jogo</small></h2>
<div class="elenco">${elenco}</div>

<section class="fontes"><h2 class="titulo-secao"><span>Fonte</span></h2><ul><li><a href="${esc(t.link_fonte)}" rel="noopener" target="_blank">ESPN: página do ${esc(t.nome)}</a></li></ul>
<p class="legenda">Atualizado em ${esc(dataHoraBrasilia(t.atualizado_em))}. Médias da temporada regular.</p></section>`;
  return pagina({ titulo: `${t.nome} | Cestinha`, descricao: `${t.nome}: elenco, estatísticas, últimos jogos e próximos jogos.`, corpo, raiz, canonical: `/times/${slugTime(t)}.html`, tema: temaDoTime(t), ativo: 'times' });
}

let mapaJogoDia = null;
function acharDiaDoJogo(id) {
  if (!mapaJogoDia) {
    mapaJogoDia = new Map();
    for (const d of listarDiasRaw()) {
      for (const f of fs.readdirSync(path.join(P.raw, d))) if (/^\d+\.json$/.test(f)) mapaJogoDia.set(f.replace('.json', ''), d);
    }
  }
  return mapaJogoDia.get(String(id)) || null;
}

// ---------- glossário (dicas ao passar o mouse ou tocar) ----------
const GLOSSARIO = [
  ['play-in', 'Repescagem antes dos playoffs: do 7º ao 10º de cada conferência disputam as duas últimas vagas.'],
  ['playoffs', 'Mata-mata que define o campeão: 16 times, séries de melhor de 7 jogos.'],
  ['triplo-duplo', 'Quando o jogador chega a 10 ou mais em três estatísticas no mesmo jogo (ex.: pontos, rebotes e assistências).'],
  ['duplo-duplo', 'Quando o jogador chega a 10 ou mais em duas estatísticas no mesmo jogo.'],
  ['Game Score', 'Nota de desempenho criada por John Hollinger: soma o que o jogador produziu e desconta erros e arremessos perdidos.'],
  ['garrafão', 'A área pintada embaixo da cesta.'],
  ['bola de três', 'Arremesso de trás da linha dos 3 pontos (7,24 m da cesta).'],
  ['prorrogação', 'Tempo extra de 5 minutos quando o jogo termina empatado.'],
  ['tocos', 'Quando o defensor bloqueia o arremesso do adversário.'],
  ['back-to-back', 'Dois jogos em dias seguidos.'],
];
// Cada verbete do "Me explica essa NBA" vira link (com dica) na primeira vez que aparece no texto.
// @@RAIZ@@ é trocado pelo caminho certo da página em pagina().
const ALIAS_VERBETES = VERBETES.flatMap((v) => v.alias.map((a) => ({ a, v }))).sort((x, y) => y.a.length - x.a.length);
function comGlossario(html) {
  let saida = html;
  const usados = new Set();
  for (const { a, v } of ALIAS_VERBETES) {
    if (usados.has(v.id)) continue;
    const termo = a.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const re = new RegExp(`(^|[^\\p{L}>-])(${termo})(?![\\p{L}-])(?![^<]*>)(?![^<]*</a>)`, 'iu');
    if (!re.test(saida)) continue;
    saida = saida.replace(re, (m, antes, achado) => `${antes}<a class="termo" href="@@RAIZ@@/aprenda.html#${v.id}" data-def="${esc(v.curta)}">${achado}</a>`);
    usados.add(v.id);
  }
  return saida;
}

// ---------- agenda ----------
const agenda = lerJson(path.join(RAIZ, 'data', 'agenda.json'));
const transmissoesBrasil = lerJson(path.join(RAIZ, 'data', 'transmissoes-br.json')) || {};
function transmissoesBR(j) {
  // A grade da ESPN americana nao e prova de onde ver o jogo no Brasil.
  const dia = diaBR(j.inicio_utc);
  const timesJogo = [j.casa?.sigla, j.visitante?.sigla].map(s => String(s || '').toUpperCase()).sort();
  const confirmado = (transmissoesBrasil.registros || []).find(item =>
    item.dia_br === dia &&
    Array.isArray(item.times) &&
    item.times.map(t => String(t).toUpperCase()).sort().join('/') === timesJogo.join('/')
  );
  return {
    canais: confirmado ? [...confirmado.canais, 'NBA League Pass'] : ['NBA League Pass'],
    confirmado: !!confirmado,
    fonte: confirmado?.fonte || null
  };
}
function canalBR(j, classe) {
  const tv = transmissoesBR(j);
  const nota = tv.confirmado ? 'Transmissao no Brasil' : 'Outros canais brasileiros: sem confirmacao';
  return `<span class="${classe}" title="${esc(nota)}">${icone('tv')} <b>Brasil:</b> ${esc(tv.canais.join(' · '))}${tv.confirmado && tv.fonte ? ` <small>• grade verificada</small>` : ` <small>• outros canais a confirmar</small>`}</span>`;
}
const TZ_BR = 'America/Sao_Paulo';
const diaBR = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ_BR }).format(new Date(iso));
const hojeBR = () => diaBR(new Date().toISOString());
function rotuloDia(diaIso) {
  const hoje = hojeBR();
  const amanha = diaBR(new Date(Date.now() + 86400000).toISOString());
  if (diaIso === hoje) return 'Hoje';
  if (diaIso === amanha) return 'Amanhã';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${diaIso}T12:00:00Z`));
}
function linhaAgenda(j, raiz) {
  const t = (x) => times.get(String(x.id)) || x;
  const v = t(j.visitante); const c = t(j.casa);
  const vivo = j.status === 'em_andamento';
  const fim = j.status === 'final';
  const temPagina = fim && acharDiaDoJogo(j.id);
  const tag = temPagina ? 'a' : 'div';
  const href = temPagina ? ` href="${raiz}/jogo/${j.id}.html"` : '';
  return `<${tag} class="jogo-agenda${vivo ? ' vivo' : ''}" data-times="${esc(j.visitante.sigla)} ${esc(j.casa.sigla)}"${href} style="--c1:${v.cor || '#ff7a1a'};--c2:${c.cor || '#ff7a1a'}">
    <span class="ja-hora">${fim ? 'Final' : vivo ? 'Ao vivo' : esc(horaBrasilia(j.inicio_utc))}${!fim && !vivo ? `<small class="contagem" data-inicio="${esc(j.inicio_utc)}"></small>` : ''}</span>
    <span class="ja-time">${logo({ logo: v.logo, sigla: v.sigla, nome_curto: v.nome_curto }, 30)}<b>${esc(v.nome_curto)}</b><small>${esc(j.visitante.campanha || '')}</small>${fim || vivo ? `<em class="pontos-ag">${j.visitante.placar ?? ''}</em>` : ''}</span>
    <span class="ja-x">@</span>
    <span class="ja-time">${logo({ logo: c.logo, sigla: c.sigla, nome_curto: c.nome_curto }, 30)}<b>${esc(c.nome_curto)}</b><small>${esc(j.casa.campanha || '')}</small>${fim || vivo ? `<em class="pontos-ag">${j.casa.placar ?? ''}</em>` : ''}</span>
    ${canalBR(j, 'ja-tv')}
  </${tag}>`;
}
function blocoHojeANoite(raiz) {
  if (!agenda?.jogos?.length) return '';
  const agora = Date.now();
  const proximos = agenda.jogos.filter((j) => j.status !== 'final' && Date.parse(j.inicio_utc) > agora - 4 * 3600e3)
    .sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc));
  if (!proximos.length) return '';
  const dia = diaBR(proximos[0].inicio_utc);
  const doDia = proximos.filter((j) => diaBR(j.inicio_utc) === dia);
  return `<section class="sec-hoje hoje-a-noite">
    <h2 class="titulo-secao"><span>${rotuloDia(dia) === 'Hoje' ? 'Hoje à noite' : `Próxima rodada: ${esc(rotuloDia(dia))}`}</span><small>${doDia.length} jogos · horário de Brasília</small></h2>
    <div class="trilho-hoje">${doDia.map((j) => {
      const v = times.get(String(j.visitante.id)) || j.visitante; const c = times.get(String(j.casa.id)) || j.casa;
      const rec = String(jogoDaNoite?.id_jogo) === String(j.id);
      return `<a class="mini-agenda${rec ? ' recomendado' : ''}" href="${raiz}/agenda.html"${rec ? ' title="Jogo recomendado pelo Cestinha"' : ''} data-times="${esc(j.visitante.sigla)} ${esc(j.casa.sigla)}">
        <span class="ma-hora">${rec ? icone('estrela') : ''}${esc(horaBrasilia(j.inicio_utc))}</span>
        <span class="ma-logos">${logo({ logo: v.logo, sigla: v.sigla, nome_curto: v.nome_curto }, 28)}<i>@</i>${logo({ logo: c.logo, sigla: c.sigla, nome_curto: c.nome_curto }, 28)}</span>
        <span class="ma-nomes">${esc(j.visitante.sigla)} x ${esc(j.casa.sigla)}</span>
        <small class="contagem" data-inicio="${esc(j.inicio_utc)}"></small>
      </a>`;
    }).join('')}</div>
  </section>`;
}
// ---------- O Cestinha escolhe o jogo da noite ----------
const jogoDaNoite = (() => {
  const arq = path.join(RAIZ, 'content', 'jogo-da-noite', `${diaBR(new Date().toISOString())}.json`);
  const t = fs.existsSync(arq) ? lerJson(arq) : null;
  return t && !(t.alertas || []).length ? t : null;
})();
function blocoJogoDaNoite(raiz) {
  const t = jogoDaNoite;
  if (!t) return '';
  const j = agenda?.jogos?.find((x) => String(x.id) === String(t.id_jogo));
  if (!j) return '';
  const v = times.get(String(j.visitante.id)) || j.visitante;
  const c = times.get(String(j.casa.id)) || j.casa;
  const fim = j.status === 'final';
  const vivo = j.status === 'em_andamento';
  const ficha = (tm, base) => {
    const cl = tm.classificacao;
    const href = paginaDoTime(tm.id, raiz);
    return `<a class="jn-time" ${href ? `href="${href}"` : ''}>${logo({ logo: tm.logo, sigla: tm.sigla, nome_curto: tm.nome_curto }, 84)}<b>${esc(tm.nome_curto)}</b><small>${esc(base.campanha || (cl ? `${cl.v}-${cl.d}` : ''))}${cl?.posicao ? ` · ${cl.posicao}º no ${esc(tm.conferencia || '')}` : ''}</small>${fim || vivo ? `<em class="jn-pontos pontos">${base.placar ?? ''}</em>` : ''}</a>`;
  };
  const temPagina = fim && acharDiaDoJogo(j.id);
  return `<section class="jogo-da-noite" style="--c1:${v.cor || '#ff7a1a'};--c2:${c.cor || '#ff7a1a'}" data-times="${esc(j.visitante.sigla)} ${esc(j.casa.sigla)}">
  <p class="jn-rot">${icone('estrela')} Se você só puder assistir a um jogo hoje...</p>
  <div class="jn-grade">
    <div class="jn-confronto">
      ${ficha(v, j.visitante)}
      <div class="jn-meio"><span class="jn-at">@</span><b class="jn-hora">${fim ? 'Final' : vivo ? 'Ao vivo' : esc(horaBrasilia(j.inicio_utc))}</b>${!fim && !vivo ? '<small>horário de Brasília</small>' : ''}<small class="contagem" data-inicio="${esc(j.inicio_utc)}"></small>${canalBR(j, 'jn-tv')}</div>
      ${ficha(c, j.casa)}
    </div>
    <div class="jn-texto">
      <div class="jn-motivos">${(t.motivos || []).map((m) => `<span class="jn-motivo">${esc(m)}</span>`).join('')}</div>
      <h2>${esc(t.titulo)}</h2>
      ${t.subtitulo ? `<p class="jn-sub">${esc(t.subtitulo)}</p>` : ''}
      <div class="texto">${comGlossario(markdown(t.corpo))}</div>
      ${t.ficar_de_olho ? `<p class="jn-olho">${icone('olho')} <b>Fique de olho:</b> ${esc(t.ficar_de_olho)}</p>` : ''}
      ${temPagina ? `<a class="jn-link" href="${raiz}/jogo/${j.id}.html">${icone('lista')} Veja como foi</a>` : ''}
      <small class="jn-nota">Recomendação do Cestinha (opinião), com dados da ESPN.</small>
    </div>
  </div>
</section>`;
}

// ---------- Meu Cestinha: dados do time favorito (a home monta no navegador) ----------
function sequenciaTxt(s) {
  const m = /^([WL])(\d+)$/.exec(s || '');
  if (!m) return '';
  const n = Number(m[2]);
  return m[1] === 'W' ? (n === 1 ? '1 vitória' : `${n} vitórias seguidas`) : (n === 1 ? '1 derrota' : `${n} derrotas seguidas`);
}
function dadosMeuTime() {
  const out = {};
  const adv = (x) => {
    const a = times.get(String(x.adversario?.id));
    return { sigla: a?.sigla || x.adversario?.sigla, nome: a?.nome_curto || x.adversario?.nome_curto, logo: a ? logoEscuro(a.logo) : '', href: a ? `times/${slugTime(a)}.html` : null };
  };
  for (const t of times.values()) {
    const c = t.classificacao || {};
    const jogos = t.jogos || [];
    const fin = jogos.filter((j) => j.finalizado && j.placar);
    const ult = fin.at(-1);
    const prox = jogos.filter((j) => !j.finalizado && Date.parse(j.data_utc) > Date.now() - 3 * 3600e3).sort((a, b) => a.data_utc.localeCompare(b.data_utc))[0];
    const textos = [...fin].reverse().filter((j) => textosJogo.has(String(j.id))).slice(0, 3)
      .map((j) => ({ titulo: textosJogo.get(String(j.id)).titulo, href: `jogo/${j.id}.html`, data: dataCurtaIso(j.data_utc) }));
    const destaques = (t.elenco || []).filter((p) => p.medias && p.medias.jogos >= 3)
      .sort((a, b) => Number(b.medias.pts) - Number(a.medias.pts)).slice(0, 3)
      .map((p) => ({ nome: p.nome, numero: p.numero || '', posicao: p.posicao || '', linha: `${p.medias.pts} pts, ${p.medias.reb} reb, ${p.medias.ast} ast`, lesao: p.lesao?.status === 'Out' ? 'fora' : p.lesao ? 'dúvida' : null }));
    out[t.sigla] = {
      sigla: t.sigla, nome: t.nome, nome_curto: t.nome_curto, cor: t.cor, cor2: t.cor_alt, acento: corDestaque(t),
      logo: logoEscuro(t.logo), href: `times/${slugTime(t)}.html`, conferencia: t.conferencia || '',
      posicao: c.posicao ?? null, campanha: `${c.v ?? 0}-${c.d ?? 0}`, sequencia: sequenciaTxt(c.sequencia), ultimos10: c.ultimos10 || '',
      divisao: t.divisao?.nome ? { nome: t.divisao.nome, posicao: t.divisao.posicao } : null,
      ultimo: ult ? { ...adv(ult), em_casa: ult.em_casa, pts: ult.placar.time, pts_adv: ult.placar.adversario, resultado: ult.resultado, data: dataCurtaIso(ult.data_utc), jogo: acharDiaDoJogo(ult.id) ? `jogo/${ult.id}.html` : null } : null,
      proximo: prox ? { ...adv(prox), em_casa: prox.em_casa, inicio_utc: prox.data_utc } : null,
      destaques, textos,
      recomendado: jogoDaNoite && prox && String(prox.id) === String(jogoDaNoite.id_jogo) ? jogoDaNoite.titulo : null,
    };
  }
  return out;
}

// ---------- Me explica essa NBA ----------
function paginaAprenda() {
  const raiz = '.';
  const ex = exemplosReais();
  const porId = new Map(VERBETES.map((v) => [v.id, v]));
  const cartao = (v) => `<article class="verbete" id="${v.id}" data-cat="${esc(v.cat)}" data-busca="${esc(`${v.termo} ${v.alias.join(' ')} ${v.curta}`.toLowerCase())}">
    <h3><a href="#${v.id}">${esc(v.termo)}</a></h3>
    <p class="vb-curta">${esc(v.curta)}</p>
    <div class="texto">${markdown(v.texto)}</div>
    ${ex[v.id] ? `<div class="vb-pratica"><span>${icone('alvo')} Na prática</span><p>${inline(ex[v.id])}</p></div>` : ''}
    ${v.veja?.length ? `<p class="vb-veja">Veja também: ${v.veja.map((id) => porId.get(id)).filter(Boolean).map((x) => `<a href="#${x.id}">${esc(x.termo)}</a>`).join('')}</p>` : ''}
  </article>`;
  const corpo = `
<section class="hero hero-aprenda">
  <p class="sobretitulo">${icone('cesta')} Aprenda com o Cestinha</p>
  <h1>Me explica essa NBA</h1>
  <p class="subtitulo">Os termos que aparecem nos jogos e nas resenhas, explicados sem complicação. Os exemplos são reais e se atualizam com os jogos.</p>
  <div class="ap-busca"><input type="search" id="busca-verbete" placeholder="Procure um termo: triplo-duplo, play-in, teto salarial..." aria-label="Procurar termo" autocomplete="off"></div>
  <div class="ap-cats" role="group" aria-label="Filtrar por assunto"><button type="button" class="ap-cat ativo" data-cat="">Tudo</button>${CATEGORIAS.map((c) => `<button type="button" class="ap-cat" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
</section>
${CATEGORIAS.map((c) => `<section class="ap-grupo" data-grupo="${esc(c)}">
  <h2 class="titulo-secao"><span>${esc(c)}</span></h2>
  <div class="ap-grade">${VERBETES.filter((v) => v.cat === c).map(cartao).join('')}</div>
</section>`).join('')}
<p class="ap-vazio" hidden>Não achei esse termo. Tente outra palavra.</p>
<p class="legenda">Exemplos calculados automaticamente com dados da ESPN. Atualizado em ${esc(dataHoraBrasilia(agoraIso()))}.</p>`;
  return pagina({ titulo: 'Me explica essa NBA | Cestinha', descricao: 'Glossário da NBA em português: triplo-duplo, play-in, Game Score, teto salarial e mais, com exemplos reais.', corpo, raiz, canonical: '/aprenda.html', ativo: 'aprenda' });
}

function paginaAgenda() {
  const raiz = '.';
  if (!agenda?.jogos?.length) {
    return pagina({ titulo: 'Agenda | Cestinha', descricao: 'Jogos da NBA em horário de Brasília.', raiz, ativo: 'agenda', corpo: '<section class="hero"><p class="sobretitulo">Agenda</p><h1>A agenda aparece depois da próxima coleta</h1></section>' });
  }
  const porDia = new Map();
  for (const j of [...agenda.jogos].sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc))) {
    const d = diaBR(j.inicio_utc);
    if (d < hojeBR()) continue;
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d).push(j);
  }
  const corpo = `
<section class="hero hero-agenda">
  <p class="sobretitulo">${icone('calendario')} Próximos 7 dias</p>
  <h1>Agenda da NBA em horário de Brasília</h1>
  <p class="subtitulo">Todos os jogos com horário de Brasília e contagem regressiva. Marque o seu time na página dele e os jogos dele ficam em destaque aqui.</p>
</section>
${[...porDia].map(([d, js]) => `<section class="dia-agenda">
  <h2 class="titulo-secao"><span>${esc(rotuloDia(d))}</span><small>${js.length} ${js.length === 1 ? 'jogo' : 'jogos'}</small></h2>
  <div class="lista-agenda">${js.map((j) => linhaAgenda(j, raiz)).join('')}</div>
</section>`).join('')}
<p class="legenda">Transmissões para o Brasil: NBA League Pass e canais selecionados conferidos em <a href="https://hoopsbrasil.com.br/nba-2026-27-calendario-de-transmissoes-do-prime-video/" target="_blank" rel="noopener">Prime Video</a> e <a href="https://hoopsbrasil.com.br/nba-2026-27-calendario-de-transmissoes-da-espn-e-disney/" target="_blank" rel="noopener">ESPN/Disney+</a>. A programação está sujeita a alterações; outros canais podem transmitir jogos sem constar nesta lista. Horários e placares: ESPN, atualizados em ${esc(dataHoraBrasilia(agenda.atualizado_em))}.</p>`;
  return pagina({ titulo: 'Agenda da NBA em horário de Brasília | Cestinha', descricao: 'Todos os jogos da NBA dos próximos 7 dias, em horário de Brasília.', corpo, raiz, canonical: '/agenda.html', ativo: 'agenda' });
}

// ---------- classificação ----------
function paginaClassificacao() {
  const raiz = '.';
  const conf = indiceTimes?.classificacao || {};
  const tabela = (nome) => `<section class="tabela-conf">
    <h2 class="titulo-secao"><span>${conferenciaNome(nome)}</span></h2>
    <div class="rolagem"><div class="classif-mobile-head" aria-hidden="true"><span>#</span><span>Time</span><span>V</span><span>D</span><span>%</span></div><table class="classif">
      <thead><tr><th scope="col">#</th><th scope="col" class="esq">Time</th><th>V</th><th>D</th><th>%</th><th>Atrás</th><th>Casa</th><th>Fora</th><th>Últ. 10</th><th>Seq.</th></tr></thead>
      <tbody>${(conf[nome] || []).map((l) => {
        const t = times.get(l.id);
        if (!t) return '';
        const zona = l.posicao <= 6 ? 'z-playoff' : l.posicao <= 10 ? 'z-playin' : 'z-fora';
        return `<tr class="${zona}" data-times="${esc(t.sigla)}"><td class="pos">${l.posicao ?? ''}</td>
          <th scope="row" class="esq"><a href="${raiz}/times/${slugTime(t)}.html">${logoTime(t, 22)}<span>${esc(t.nome_curto)}</span></a></th>
          <td class="forte" data-label="Vitórias">${l.v}</td><td data-label="Derrotas">${l.d}</td><td data-label="Aproveitamento">${esc(l.pct)}</td><td>${esc(l.atras)}</td><td>${esc(l.casa)}</td><td>${esc(l.fora)}</td><td>${esc(l.ultimos10)}</td><td class="seq ${String(l.sequencia).startsWith('W') ? 'sv' : 'sd'}">${esc(sequenciaPt(l.sequencia))}</td><td class="classif-mobile-detalhes"><details class="classif-expansivel"><summary><span>Mais estatísticas</span><span class="classif-extra-hint">Casa · Fora · sequência</span><span class="classif-chevron" aria-hidden="true">⌄</span></summary><div class="classif-extra-grade"><span><small>Atrás</small><b>${esc(l.atras)}</b></span><span><small>Casa</small><b>${esc(l.casa)}</b></span><span><small>Fora</small><b>${esc(l.fora)}</b></span><span><small>Últ. 10</small><b>${esc(l.ultimos10)}</b></span><span><small>Seq.</small><b>${esc(sequenciaPt(l.sequencia))}</b></span></div></details></td></tr>`;
      }).join('')}</tbody>
    </table></div>
  </section>`;
  const corpo = `
<section class="hero hero-tabela">
  <p class="sobretitulo">${icone('trofeu')} Temporada ${esc(temporadaTexto())}</p>
  <h1>Classificação</h1>
  <p class="subtitulo">Veja a classificação em um olhar. Toque em “Mais estatísticas” para conferir casa, fora, últimos jogos e sequência.</p>
  <div class="legenda-zonas"><span class="z z-playoff">Playoffs</span><span class="z z-playin">Play-in</span><span class="z z-fora">Fora</span></div>
</section>
<div class="conferencias">${tabela('Leste')}${tabela('Oeste')}</div>
<p class="legenda">Atrás: jogos de distância para o líder da conferência. Seq.: V = vitórias seguidas, D = derrotas seguidas. Fonte: ESPN, atualizado em ${esc(dataHoraBrasilia(indiceTimes.atualizado_em))}.</p>`;
  return pagina({ titulo: 'Classificação da NBA | Cestinha', descricao: 'Classificação das conferências Leste e Oeste, com zonas de playoffs e play-in.', corpo: comGlossarioSeguro(corpo), raiz, canonical: '/classificacao.html', ativo: 'classificacao' });
}
function comGlossarioSeguro(html) {
  // aplica o glossário só nos parágrafos de texto
  return html.replace(/<p class="subtitulo">([\s\S]*?)<\/p>/g, (m, txt) => `<p class="subtitulo">${comGlossario(txt)}</p>`);
}

// ---------- brasileiros ----------
function paginaBrasileiros() {
  const raiz = '.';
  const lista = [];
  for (const t of times.values()) for (const p of t.elenco || []) if (/bra[sz]il/i.test(p.pais || '')) lista.push({ p, t });
  const jogosDe = (nome) => {
    const out = [];
    for (const d of listarDiasRaw().reverse()) {
      for (const f of fs.readdirSync(path.join(P.raw, d)).filter((x) => /^\d+\.json$/.test(x))) {
        const j = lerJson(path.join(P.raw, d, f));
        for (const lado of ['casa', 'visitante']) {
          const pl = (j?.[lado]?.jogadores || []).find((x) => x.nome === nome);
          if (pl) out.push({ j, pl, lado });
        }
      }
    }
    return out.slice(0, 10);
  };
  const corpo = `
<section class="hero hero-br">
  <p class="sobretitulo">${icone('bandeira')} Torcida brasileira</p>
  <h1>Brasileiros na NBA</h1>
  <p class="subtitulo">Quem nasceu no Brasil e está num elenco da NBA nesta temporada, segundo a ESPN, com médias e os últimos jogos.</p>
</section>
${lista.length ? lista.map(({ p, t }) => {
    const m = p.medias;
    const jogos = jogosDe(p.nome);
    return `<section class="brasileiro" style="--t1:${t.cor || '#009c3b'};--t2:${t.cor_alt || '#ffdf00'}">
      <div class="br-topo">
        ${camisaSvg(t.cor || '#009c3b', t.cor_alt || '#ffdf00', p.numero ?? '')}
        <div><h2>${esc(p.nome)}</h2><p><a href="${raiz}/times/${slugTime(t)}.html">${logoTime(t, 22)} ${esc(t.nome)}</a> · ${esc(p.posicao || '')}${p.idade ? ` · ${p.idade} anos` : ''}${p.altura_m ? ` · ${p.altura_m.replace('.', ',')} m` : ''}</p>
        ${p.lesao?.status ? `<span class="lesao">${esc(STATUS_LESAO[p.lesao.status] || p.lesao.status)}</span>` : ''}</div>
      </div>
      ${m && m.jogos > 0 ? `<div class="numeros-time br-medias">
        <div><b>${m.jogos}</b><span>jogos</span></div><div><b>${esc(m.min)}</b><span>minutos</span></div><div><b>${esc(m.pts)}</b><span>pontos</span></div><div><b>${esc(m.reb)}</b><span>rebotes</span></div>
      </div>` : '<p class="legenda">Ainda não entrou em quadra nesta temporada.</p>'}
      ${jogos.length ? `<h3 class="divisao-nome"><span>Últimos jogos que coletamos</span></h3><div class="lista-jogos-time">${jogos.map(({ j, pl, lado }) => {
        const adv = lado === 'casa' ? j.visitante : j.casa;
        const meu = j[lado];
        return `<a class="jogo-time res-${meu.vencedor ? 'V' : 'D'}" href="${raiz}/jogo/${j.id}.html"><span class="jt-data">${esc(dataCurtaIso(j.inicio_utc))}</span><span class="jt-res">${meu.vencedor ? 'V' : 'D'}</span><span class="jt-adv"><small>${lado === 'casa' ? 'vs' : '@'}</small><b>${esc(adv.nome_curto)}</b></span><span class="jt-placar">${esc(linhaEstatistica(pl))}</span></a>`;
      }).join('')}</div>` : ''}
    </section>`;
  }).join('') : '<p class="legenda">Nenhum brasileiro encontrado nos elencos coletados.</p>'}
<p class="legenda">Lista montada a partir do local de nascimento informado pela ESPN.</p>`;
  return pagina({ titulo: 'Brasileiros na NBA | Cestinha', descricao: 'Os brasileiros na NBA: médias e últimos jogos.', corpo, raiz, canonical: '/brasileiros.html', ativo: 'times' });
}

// ---------- gráfico do jogo e mapa de arremessos ----------
function graficoJogo(j) {
  if (!j.fluxo || j.fluxo.length < 3) return '';
  const T = 2880 + 300 * (j.prorrogacoes || 0);
  const maxAbs = Math.max(8, ...j.fluxo.map(([, d]) => Math.abs(d)));
  const W = 1000; const H = 300; const L = 44; const R = 12; const meio = H / 2; const esc_y = (meio - 22) / maxAbs;
  const X = (t) => L + (Math.min(t, T) / T) * (W - L - R);
  const Y = (d) => meio - d * esc_y;
  let caminho = `M${X(0)},${meio}`;
  let ult = 0;
  for (const [t, d] of j.fluxo) { caminho += ` L${X(t).toFixed(1)},${Y(ult).toFixed(1)} L${X(t).toFixed(1)},${Y(d).toFixed(1)}`; ult = d; }
  caminho += ` L${X(T)},${Y(ult).toFixed(1)}`;
  const area = `${caminho} L${X(T)},${meio} Z`;
  const maxCasa = j.fluxo.reduce((m, [, d]) => Math.max(m, d), 0);
  const maxFora = j.fluxo.reduce((m, [, d]) => Math.min(m, d), 0);
  const ptoCasa = j.fluxo.find(([, d]) => d === maxCasa);
  const ptoFora = j.fluxo.find(([, d]) => d === maxFora);
  const divisoes = [720, 1440, 2160, 2880, ...Array.from({ length: j.prorrogacoes || 0 }, (_, i) => 2880 + 300 * (i + 1))].filter((t) => t < T);
  const rotulos = ['1º', '2º', '3º', '4º', ...Array.from({ length: j.prorrogacoes || 0 }, (_, i) => `P${i + 1}`)];
  const inicios = [0, ...divisoes];
  const cC = cor(j.casa); const cV = cor(j.visitante);
  return `<section class="grafico-jogo">
  <h2 class="titulo-secao"><span>O jogo em um gráfico</span><small>vantagem no placar ao longo da partida</small></h2>
  <div class="gj-caixa">
    <div class="gj-leg"><span style="--c:${cC}">${logo(j.casa, 20)} ${esc(j.casa.nome_curto)} na frente</span><span style="--c:${cV}">${logo(j.visitante, 20)} ${esc(j.visitante.nome_curto)} na frente</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="gj-svg" role="img" aria-label="Gráfico da vantagem no placar ao longo do jogo">
      <defs>
        <clipPath id="acima-${j.id}"><rect x="0" y="0" width="${W}" height="${meio}"/></clipPath>
        <clipPath id="abaixo-${j.id}"><rect x="0" y="${meio}" width="${W}" height="${meio}"/></clipPath>
      </defs>
      ${[-20, -10, 10, 20].filter((v) => Math.abs(v) <= maxAbs).map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="gj-grade"/><text x="${L - 8}" y="${Y(v) + 4}" class="gj-eixo" text-anchor="end">${Math.abs(v)}</text>`).join('')}
      ${divisoes.map((t) => `<line x1="${X(t)}" x2="${X(t)}" y1="10" y2="${H - 10}" class="gj-quarto"/>`).join('')}
      ${inicios.map((t, i) => `<text x="${(X(t) + X(divisoes[i] ?? T)) / 2}" y="${H - 4}" class="gj-eixo" text-anchor="middle">${rotulos[i]}</text>`).join('')}
      <path d="${area}" fill="${cC}" fill-opacity=".55" clip-path="url(#acima-${j.id})"/>
      <path d="${area}" fill="${cV}" fill-opacity=".55" clip-path="url(#abaixo-${j.id})"/>
      <path d="${caminho}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" opacity=".9"/>
      <line x1="${L}" x2="${W - R}" y1="${meio}" y2="${meio}" class="gj-zero"/>
      ${maxCasa > 0 ? `<circle cx="${X(ptoCasa[0])}" cy="${Y(maxCasa)}" r="5" fill="#fff"/><text x="${Math.min(X(ptoCasa[0]) + 8, W - 120)}" y="${Y(maxCasa) - 6}" class="gj-nota">+${maxCasa} ${esc(j.casa.sigla)}</text>` : ''}
      ${maxFora < 0 ? `<circle cx="${X(ptoFora[0])}" cy="${Y(maxFora)}" r="5" fill="#fff"/><text x="${Math.min(X(ptoFora[0]) + 8, W - 120)}" y="${Y(maxFora) + 18}" class="gj-nota">+${-maxFora} ${esc(j.visitante.sigla)}</text>` : ''}
    </svg>
    <p class="legenda">Acima da linha do meio: ${esc(j.casa.nome_curto)} vencendo. Abaixo: ${esc(j.visitante.nome_curto)} vencendo. Quanto mais longe da linha, maior a vantagem.</p>
  </div>
</section>`;
}

function quadraSvg(conteudo, titulo) {
  return `<svg viewBox="0 0 500 470" class="quadra-svg" role="img" aria-label="${esc(titulo)}">
    <rect x="0" y="0" width="500" height="470" class="q-piso"/>
    <g class="q-linhas">
      <rect x="0" y="0" width="500" height="470"/>
      <rect x="170" y="0" width="160" height="190"/>
      <circle cx="250" cy="190" r="60"/>
      <path d="M30 0 V140 A237.5 237.5 0 0 0 470 140 V0"/>
      <path d="M210 52 A40 40 0 0 0 290 52"/>
      <line x1="220" y1="40" x2="280" y2="40"/>
      <path d="M190 470 A60 60 0 0 1 310 470"/>
    </g>
    <circle cx="250" cy="52" r="7.5" class="q-aro"/>
    ${conteudo}
  </svg>`;
}
function mapaArremessos(j) {
  if (!j.arremessos || j.arremessos.length < 10) return '';
  const painel = (lado) => {
    const t = j[lado];
    const ar = j.arremessos.filter((a) => a[3] === (lado === 'casa' ? 'c' : 'v'));
    const acertos = ar.filter((a) => a[2]).length;
    const tres = ar.filter((a) => a[4] === 3);
    const pontos = ar.map(([x, y, ok]) => {
      const cx = (x * 10).toFixed(0); const cy = Math.max(4, (y + 5.2) * 10).toFixed(0); // a cesta fica em y=0 na ESPN
      return ok ? `<circle cx="${cx}" cy="${cy}" r="7" class="a-ok" style="fill:${cor(t)}"/>` : `<path d="M${cx - 5} ${cy - 5}l10 10M${cx - 5} ${+cy + 5}l10 -10" class="a-erro"/>`;
    }).join('');
    return `<div class="painel-arremessos" style="--c1:${cor(t)}">
      <p class="pa-topo">${logo(t, 24)}<b>${esc(t.nome_curto)}</b><span>${acertos}/${ar.length} (${ar.length ? Math.round((acertos / ar.length) * 100) : 0}%) · 3P ${tres.filter((a) => a[2]).length}/${tres.length}</span></p>
      ${quadraSvg(pontos, `Mapa de arremessos do ${t.nome_curto}`)}
    </div>`;
  };
  return `<section class="mapa-arremessos">
  <h2 class="titulo-secao"><span>Mapa de arremessos</span><small>bolinha cheia: cesta · x: erro (sem lances livres)</small></h2>
  <div class="paineis-arremessos">${painel('visitante')}${painel('casa')}</div>
</section>`;
}

// ---------- notas e "por que importa" (quando o Cestinha escrever) ----------
function blocoExtrasTexto(texto) {
  if (!texto) return '';
  const pq = texto.por_que_importa ? `<div class="por-que">${icone('alvo')}<div><b>Por que importa</b><p>${esc(texto.por_que_importa)}</p></div></div>` : '';
  const notas = Array.isArray(texto.notas) && texto.notas.length ? `<section class="notas">
    <h2 class="titulo-secao"><span>Notas do Cestinha</span><small>opinião, de 0 a 10</small></h2>
    <div class="lista-notas">${texto.notas.map((n) => `<div class="nota-jog"><span class="nota-valor ${Number(n.nota) >= 8 ? 'alta' : Number(n.nota) < 5 ? 'baixa' : ''}">${esc(n.nota)}</span><div><b>${esc(n.jogador)}</b><p>${esc(n.comentario || '')}</p></div></div>`).join('')}</div>
  </section>` : '';
  return pq + notas;
}

// ---------- power ranking ----------
const PASTA_POWER = path.join(RAIZ, 'content', 'power-ranking');
const powerRankings = fs.existsSync(PASTA_POWER) ? fs.readdirSync(PASTA_POWER).filter((f) => f.endsWith('.json')).sort().map((f) => lerJson(path.join(PASTA_POWER, f))).filter((x) => x && !(x.alertas || []).length) : [];
function paginaPower(pr) {
  const raiz = '.';
  const corpo = `
<section class="hero hero-power">
  <p class="sobretitulo">${icone('coroa')} Power ranking · opinião do Cestinha</p>
  <h1>${esc(pr.titulo)}</h1>
  ${pr.subtitulo ? `<p class="subtitulo">${esc(pr.subtitulo)}</p>` : ''}
</section>
${pr.corpo ? `<div class="texto power-intro">${comGlossario(markdown(pr.corpo))}</div>` : ''}
<ol class="power-lista">${(pr.ranking || []).map((r) => {
    const t = [...times.values()].find((x) => x.sigla === r.time || x.nome_curto === r.time);
    const seta = r.tendencia === 'sobe' ? '▲' : r.tendencia === 'desce' ? '▼' : '•';
    return `<li class="power-item" style="--t1:${t?.cor || '#ff7a1a'}"><span class="pw-pos">${r.posicao}</span><span class="pw-seta ${r.tendencia || ''}">${seta}</span>${t ? logoTime(t, 40) : ''}<div><b>${esc(t?.nome_curto || r.time)}</b>${t?.classificacao ? `<small>${t.classificacao.v}-${t.classificacao.d}</small>` : ''}<p>${esc(r.comentario || '')}</p></div></li>`;
  }).join('')}</ol>
<p class="legenda">Ranking de opinião do Cestinha. Campanhas: ESPN.</p>`;
  return pagina({ titulo: `${pr.titulo} | Cestinha`, descricao: pr.subtitulo || 'Power ranking do Cestinha.', corpo, raiz, canonical: '/power-ranking.html', ativo: 'times' });
}

// ---------- gerar ----------
fs.rmSync(P.site, { recursive: true, force: true });
fs.mkdirSync(path.join(P.site, 'jogo'), { recursive: true });
fs.mkdirSync(path.join(P.site, 'rodada'), { recursive: true });
fs.cpSync(path.join(RAIZ, 'site', 'assets'), path.join(P.site, 'assets'), { recursive: true });
if (fs.existsSync(path.join(RAIZ, 'site', 'CNAME'))) fs.copyFileSync(path.join(RAIZ, 'site', 'CNAME'), path.join(P.site, 'CNAME'));
fs.writeFileSync(path.join(P.site, '.nojekyll'), '');

let nJogos = 0;
const recentes = new Set(dias.slice(-3).map((d) => d.dia));
const paraCartao = [];
for (const { dia, rodada } of dias) {
  if (!recentes.has(dia)) continue;
  for (const b of rodada.jogos) {
    const j = jogoDoDia(dia, b);
    if (!j.casa.jogadores) continue;
    const top = [...j.casa.jogadores.map((p) => ({ ...p, t: j.casa })), ...j.visitante.jogadores.map((p) => ({ ...p, t: j.visitante }))].sort((a, x) => x.pts - a.pts)[0];
    paraCartao.push({ jogo: j, texto: textosJogo.get(j.id), destaque: top ? `${top.nome} (${top.t.sigla}): ${linhaEstatistica(top)}` : '', dataTxt: dataPorExtenso(dia) });
  }
}
const comCartao = await gerarCartoes(paraCartao, P.site, times);
for (const { dia, rodada } of dias) {
  const jogos = rodada.jogos.map((b) => jogoDoDia(dia, b));
  fs.writeFileSync(path.join(P.site, 'rodada', `${dia}.html`), pagina({
    titulo: `Rodada de ${dataCurta(dia)} | Cestinha`,
    descricao: textosRodada.get(dia)?.subtitulo || `Todos os jogos da NBA de ${dataPorExtenso(dia)}.`,
    corpo: blocoRodada(dia, rodada, '..') + listaAnteriores(dia, '..'),
    raiz: '..',
    canonical: `/rodada/${dia}.html`,
    faixa: faixaPlacares(jogos, '..'),
    ativo: 'rodada',
  }));
  for (const j of jogos.filter((x) => x.casa.jogadores)) {
    fs.writeFileSync(path.join(P.site, 'jogo', `${j.id}.html`), paginaJogo(j, faixaPlacares(jogos, '..'), comCartao.has(j.id)));
    nJogos++;
  }
}

// Home: a rodada mais recente que já tem jogo finalizado (senão, a mais recente)
const comFinal = dias.filter((d) => d.rodada.jogos.some((j) => j.status === 'final'));
const atual = (comFinal.length ? comFinal : dias).at(-1);
const corpoHome = atual
  ? blocoRodada(atual.dia, atual.rodada, '.', true) + listaAnteriores(atual.dia, '.')
  : `<section class="rodada"><article class="hero"><p class="sobretitulo">${esc(SITE.slogan)}</p><h1>${esc(SITE.bordao)}</h1><p class="subtitulo">Assim que rolar jogo, os resumos aparecem aqui.</p></article></section>`;
fs.writeFileSync(path.join(P.site, 'index.html'), pagina({
  titulo: 'Cestinha | A NBA pra quem dormiu',
  descricao: 'Resumo dos jogos da NBA da noite, em português, no tom de resenha.',
  corpo: corpoHome,
  canonical: '/',
  ativo: 'rodada',
  faixa: atual ? faixaPlacares(atual.rodada.jogos.map((b) => jogoDoDia(atual.dia, b)), '.') : '',
}));
if (indiceTimes && times.size) {
  fs.mkdirSync(path.join(P.site, 'times'), { recursive: true });
  fs.writeFileSync(path.join(P.site, 'times', 'index.html'), paginaListaTimes());
  for (const t of times.values()) fs.writeFileSync(path.join(P.site, 'times', `${slugTime(t)}.html`), paginaTime(t));
} else {
  fs.mkdirSync(path.join(P.site, 'times'), { recursive: true });
  fs.writeFileSync(path.join(P.site, 'times', 'index.html'), pagina({ titulo: 'Times | Cestinha', descricao: 'Times da NBA.', raiz: '..', ativo: 'times',
    corpo: '<section class="hero"><p class="sobretitulo">Times</p><h1>Chegando já já</h1><p class="subtitulo">Os dados dos times aparecem depois da próxima coleta.</p></section>' }));
}
fs.writeFileSync(path.join(P.site, 'agenda.html'), paginaAgenda());
fs.writeFileSync(path.join(P.site, 'aprenda.html'), paginaAprenda());
if (times.size) fs.writeFileSync(path.join(P.site, 'assets', 'meu-time.json'), JSON.stringify(dadosMeuTime()));
if (indiceTimes && times.size) {
  fs.writeFileSync(path.join(P.site, 'classificacao.html'), paginaClassificacao());
  fs.writeFileSync(path.join(P.site, 'brasileiros.html'), paginaBrasileiros());
}
if (powerRankings.length) fs.writeFileSync(path.join(P.site, 'power-ranking.html'), paginaPower(powerRankings.at(-1)));
fs.writeFileSync(path.join(P.site, '404.html'), pagina({
  titulo: 'Não achei | Cestinha', descricao: 'Página não encontrada.',
  corpo: '<section class="rodada"><article class="hero"><p class="sobretitulo">Erro 404</p><h1>Airball!</h1><p class="subtitulo">Essa página não existe. Volte para a página inicial pelo logo lá em cima.</p></article></section>',
}));

gerarCestinhaStats({ P, times, dias, jogoDoDia, pagina });

console.log(`Site gerado em _site/: ${dias.length} rodada(s), ${nJogos} página(s) de jogo, ${times.size} time(s), ${textosJogo.size} resenha(s), ${textosRodada.size} resumo(s) de rodada.`);
