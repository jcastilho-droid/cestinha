// Gera o site estático em _site/ a partir de content/ (textos) e data/raw/ (números).
// Uso: node scripts/build.js
// Regras: números SEMPRE vêm de data/raw; content/revisao/ NUNCA é publicado.
import fs from 'node:fs';
import path from 'node:path';
import { P, RAIZ, lerJson, listarDiasRaw, horaBrasilia, dataPorExtenso, dataCurta, dataHoraBrasilia, agoraIso, dataHoraCurta, dataCurtaIso } from './lib/util.js';
import { lerRodada, lerJogo, selosDoJogo, lideresDaRodada, linhaEstatistica } from './lib/dados.js';
import { icone, comIcones, LOGO_ARO } from './lib/icones.js';

// muda a cada publicação: força o navegador a baixar o visual novo
const VERSAO = Date.now().toString(36);

const SITE = {
  nome: 'Cestinha',
  slogan: 'A NBA pra quem dormiu',
  bordao: 'E aí, aqui é o Cestinha',
  url: process.env.SITE_URL || '',
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

function pagina({ titulo, descricao, corpo, raiz = '.', canonical = '', faixa = '', tema = '', ativo = '' }) {
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
${canonical && SITE.url ? `<link rel="canonical" href="${esc(SITE.url + canonical)}">` : ''}
<link rel="icon" href="${raiz}/assets/icone.svg?v=${VERSAO}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,800;1,900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${raiz}/assets/estilo.css?v=${VERSAO}">
<script src="${raiz}/assets/efeitos.js?v=${VERSAO}" defer></script>
</head>
<body${tema ? ` style="${tema}"` : ''}>
<div class="fundo-deco" aria-hidden="true">
  <span class="brilho b1"></span><span class="brilho b2"></span><span class="brilho b3"></span>
</div>
<aside class="trilho trilho-esq" aria-hidden="true">
  <span class="vertical">CESTINHA</span>
  <span class="trilho-bola">${icone('bola', 'ic')}</span>
  <span class="vertical pequeno">A NBA PRA QUEM DORMIU</span>
</aside>
${trilhoEscudos(raiz)}
<header class="topo">
  <div class="topo-dentro">
    <a class="marca logo" href="${raiz}/index.html" aria-label="Cestinha, página inicial">${LOGO_ARO}<span class="logo-texto">CESTINHA</span></a>
    <nav class="menu" aria-label="Seções">
      <a href="${raiz}/index.html"${ativo === 'rodada' ? ' class="ativo"' : ''}>${icone('bola')}<span>Rodada</span></a>
      <a href="${raiz}/times/index.html"${ativo === 'times' ? ' class="ativo"' : ''}>${icone('escudo')}<span>Times</span></a>
    </nav>
  </div>
  ${faixa}
</header>
<main>
${comIcones(corpo)}
</main>
<footer class="rodape">
  <div class="rodape-dentro">
    <div class="rodape-topo">
      <p class="rodape-marca logo">${LOGO_ARO}<span class="logo-texto">CESTINHA</span></p>
      <p class="rodape-bordao">${esc(SITE.bordao)}</p>
    </div>
    <p>${icone('grafico')} Placar e estatísticas: ESPN. ${icone('raio')} Textos: o Cestinha (IA), com checagem automática dos números.</p>
    <p>${icone('relogio')} Horários de Brasília. Atualizado em ${esc(dataHoraBrasilia(agoraIso()))}. Logos dos times exibidos só para identificação.</p>
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
  return `<${tag} class="card-jogo${epico ? ' epico' : ''}"${href} data-luz style="--c1:${cor(j.visitante)};--c2:${cor(j.casa)}">
    ${j.arena?.foto ? `<div class="card-arena" style="--foto:url('${esc(j.arena.foto)}')"><span>${icone('arena')} ${esc(j.arena.nome)}</span></div>` : ''}
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
      ${logo(p.time, 56)}
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
  return `<section class="decisivos">
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
        <div class="carta-arte">${camisaSvg(c1, c2, numeroDaCamisa(t.id, p.nome))}<span class="carta-logo">${logo(t, 34)}</span></div>
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
  return `<section class="lideres">
  <h2 class="titulo-secao"><span>Líderes da noite</span></h2>
  <div class="grade-lideres">
    ${lideres.categorias.map((c) => `<a class="lider" href="${raiz}/jogo/${c.p.jogo}.html" style="--c1:${cor(c.p.time)}">
      <span class="lider-cat">${esc(c.rotulo)}</span>
      <span class="lider-valor">${esc(c.valor(c.p))}</span>
      <span class="lider-nome">${logo(c.p.time, 18)}${esc(c.p.nome)}</span>
    </a>`).join('')}
  </div>
</section>`;
}

function blocoEpicos(jogos, raiz) {
  const epicos = jogos.filter((j) => selosDoJogo(j).some((s) => s.epico));
  if (!epicos.length) return '';
  return `<section class="epicos">
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

function blocoRodada(dia, rodada, raiz) {
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
  return `
<section class="rodada">
  ${hero}
  <div class="duas-colunas">
    <div class="coluna-principal">
      ${resumo ? `<article class="resumo-rodada"><h2 class="titulo-secao"><span>Acordei e perdi</span><small>o resumo da noite</small></h2><div class="texto">${markdown(resumo.corpo)}</div></article>` : ''}
    </div>
    <aside class="coluna-lateral">
      ${lideres ? cardDestaque(lideres, raiz) : ''}
    </aside>
  </div>
  ${lideres ? blocoDecisivos(lideres, raiz) : ''}
  ${blocoEpicos(jogos, raiz)}
  <h2 class="titulo-secao"><span>Todos os jogos</span></h2>
  <div class="grade-jogos">
    ${ordem.map((j) => cardJogo(j, raiz)).join('\n')}
  </div>
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

function paginaJogo(j, faixa) {
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
${texto ? `<article class="resenha">
  <div class="selos">${selo(texto.status)}</div>
  <h1>${esc(texto.titulo)}</h1>
  ${texto.subtitulo ? `<p class="subtitulo">${esc(texto.subtitulo)}</p>` : ''}
  <div class="texto">${markdown(texto.corpo)}</div>
</article>` : `<article class="resenha vazio"><h1>${esc(titulo)}</h1><p class="subtitulo">A resenha do Cestinha chega em breve. Enquanto isso, os números:</p></article>`}
${destaquesDoJogo(j)}
${comparativo(j)}
<h2 class="titulo-secao"><span>Box score</span></h2>
${tabelaBox(j.visitante)}
${tabelaBox(j.casa)}
<p class="legenda">AR: arremessos de quadra · 3P: bolas de três · LL: lances livres · RB: roubos de bola · TOC: tocos · ERR: erros. Titulares em negrito.</p>
<section class="fontes"><h2 class="titulo-secao"><span>Fontes</span></h2><ul>${fontes.map((f) => `<li>${f}</li>`).join('')}</ul></section>`;
  return pagina({ titulo: `${titulo} | Cestinha`, descricao: texto?.subtitulo || `${j.visitante.nome} x ${j.casa.nome}: placar e box score.`, corpo, raiz, canonical: `/jogo/${j.id}.html`, faixa });
}

// ---------- times ----------
const PASTA_TIMES = path.join(RAIZ, 'data', 'times');
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
      times.set(String(t.id), t);
    }
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
  <p class="subtitulo">Os 30 times da NBA, separados por conferência e divisão. Clique no escudo para ver elenco, estatísticas, últimos resultados e próximos jogos.</p>
  <div class="hero-escudos" aria-hidden="true">${[...times.values()].slice(0, 30).map((t) => logoTime(t, 30)).join('')}</div>
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

// ---------- gerar ----------
fs.rmSync(P.site, { recursive: true, force: true });
fs.mkdirSync(path.join(P.site, 'jogo'), { recursive: true });
fs.mkdirSync(path.join(P.site, 'rodada'), { recursive: true });
fs.cpSync(path.join(RAIZ, 'site', 'assets'), path.join(P.site, 'assets'), { recursive: true });
if (fs.existsSync(path.join(RAIZ, 'site', 'CNAME'))) fs.copyFileSync(path.join(RAIZ, 'site', 'CNAME'), path.join(P.site, 'CNAME'));
fs.writeFileSync(path.join(P.site, '.nojekyll'), '');

let nJogos = 0;
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
    fs.writeFileSync(path.join(P.site, 'jogo', `${j.id}.html`), paginaJogo(j, faixaPlacares(jogos, '..')));
    nJogos++;
  }
}

// Home: a rodada mais recente que já tem jogo finalizado (senão, a mais recente)
const comFinal = dias.filter((d) => d.rodada.jogos.some((j) => j.status === 'final'));
const atual = (comFinal.length ? comFinal : dias).at(-1);
const corpoHome = atual
  ? blocoRodada(atual.dia, atual.rodada, '.') + listaAnteriores(atual.dia, '.')
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
fs.writeFileSync(path.join(P.site, '404.html'), pagina({
  titulo: 'Não achei | Cestinha', descricao: 'Página não encontrada.',
  corpo: '<section class="rodada"><article class="hero"><p class="sobretitulo">Erro 404</p><h1>Airball!</h1><p class="subtitulo">Essa página não existe. Volte para a página inicial pelo logo lá em cima.</p></article></section>',
}));

console.log(`Site gerado em _site/: ${dias.length} rodada(s), ${nJogos} página(s) de jogo, ${times.size} time(s), ${textosJogo.size} resenha(s), ${textosRodada.size} resumo(s) de rodada.`);
