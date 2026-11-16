// Gera o site estático em _site/ a partir de content/ (textos) e data/raw/ (números).
// Uso: node scripts/build.js
// Regras: números SEMPRE vêm de data/raw; content/revisao/ NUNCA é publicado.
import fs from 'node:fs';
import path from 'node:path';
import { P, RAIZ, lerJson, listarDiasRaw, horaBrasilia, dataPorExtenso, dataCurta, dataHoraBrasilia, agoraIso } from './lib/util.js';
import { lerRodada, lerJogo, selosDoJogo, lideresDaRodada, linhaEstatistica } from './lib/dados.js';

const SITE = {
  nome: 'Cestinha',
  slogan: 'A NBA pra quem dormiu',
  bordao: 'Eae, aqui é o Cestinha!',
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

function pagina({ titulo, descricao, corpo, raiz = '.', canonical = '', faixa = '' }) {
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
<link rel="icon" href="${raiz}/assets/icone.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${raiz}/assets/estilo.css">
</head>
<body>
<header class="topo">
  <div class="topo-dentro">
    <a class="marca" href="${raiz}/index.html"><img src="${raiz}/assets/icone.svg" alt="" width="34" height="34"><span>Cesti<b>nha</b></span></a>
    <span class="slogan">${esc(SITE.slogan)}</span>
  </div>
  ${faixa}
</header>
<main>
${corpo}
</main>
<footer class="rodape">
  <div class="rodape-dentro">
    <p class="rodape-marca">Cesti<b>nha</b></p>
    <p>Placar e estatísticas: ESPN. Textos: o Cestinha (IA), com checagem automática dos números. Logos dos times exibidos só para identificação.</p>
    <p>Horários de Brasília. Atualizado em ${esc(dataHoraBrasilia(agoraIso()))}.</p>
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
  return `<${tag} class="card-jogo${epico ? ' epico' : ''}"${href} style="--c1:${cor(j.visitante)};--c2:${cor(j.casa)}">
    <div class="card-topo"><span class="situacao">${esc(situacao(j))}</span><span class="tags">${selosEpicos(selos, 2)}</span></div>
    ${linhaTime(j.visitante, final)}
    ${linhaTime(j.casa, final)}
    ${texto ? `<p class="card-titulo">${esc(texto.titulo)}</p>` : final ? '<p class="card-titulo espera">Resenha chegando…</p>' : ''}
  </${tag}>`;
}

function cardDestaque(lideres, raiz) {
  const p = lideres.destaque;
  return `<a class="destaque-noite" href="${raiz}/jogo/${p.jogo}.html" style="--c1:${cor(p.time)}">
    <div class="dn-rotulo">Destaque da noite</div>
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
      return `<a class="card-epico" href="${raiz}/jogo/${j.id}.html" style="--c1:${cor(venc)};--c2:${cor(perd)}">
        <span class="tags">${selosEpicos(selosDoJogo(j).filter((s) => s.epico))}</span>
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
    <div><b>${finais.length}</b><span>jogos</span></div>
    <div><b>${pontos}</b><span>pontos</span></div>
    <div><b>${maior}</b><span>maior placar</span></div>
    <div><b>${ot}</b><span>${ot === 1 ? 'prorrogação' : 'prorrogações'}</span></div>
  </div>`;
}

function blocoRodada(dia, rodada, raiz) {
  const resumo = textosRodada.get(dia);
  const jogos = rodada.jogos.map((b) => jogoDoDia(dia, b));
  const ordem = [...jogos].sort((a, b) => (textosJogo.get(b.id)?.importancia || 0) - (textosJogo.get(a.id)?.importancia || 0) || a.inicio_utc.localeCompare(b.inicio_utc));
  const finalizados = jogos.filter((j) => j.status === 'final').length;
  const completos = jogos.filter((j) => j.casa.jogadores);
  const lideres = lideresDaRodada(completos);
  const hero = resumo
    ? `<article class="hero">
        <p class="sobretitulo">Rodada de ${esc(dataPorExtenso(dia))}</p>
        <div class="selos">${selo(resumo.status)}</div>
        <h1>${esc(resumo.titulo)}</h1>
        ${resumo.subtitulo ? `<p class="subtitulo">${esc(resumo.subtitulo)}</p>` : ''}
        ${numerosDaRodada(jogos)}
      </article>`
    : `<article class="hero">
        <p class="sobretitulo">Rodada de ${esc(dataPorExtenso(dia))}</p>
        <h1>${finalizados === jogos.length ? 'O resumo da rodada sai daqui a pouco' : 'Rodada em andamento'}</h1>
        <p class="subtitulo">${esc(SITE.bordao)} ${finalizados} de ${jogos.length} jogos finalizados.</p>
        ${numerosDaRodada(jogos)}
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
  <h3>${logo(t, 28)}${esc(t.nome)}</h3>
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
  const time = (t) => `<div class="time-grande${t.vencedor ? ' venceu' : ''}">${logo(t, 72)}<span>${esc(t.nome_curto)}</span><small>${esc(t.campanha || '')}</small></div>`;
  const corpo = `
<nav class="voltar"><a href="${raiz}/rodada/${j.data_rodada}.html">← Rodada de ${esc(dataCurta(j.data_rodada))}</a></nav>
<section class="placar-grande" style="--c1:${cor(j.visitante)};--c2:${cor(j.casa)}">
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
  faixa: atual ? faixaPlacares(atual.rodada.jogos.map((b) => jogoDoDia(atual.dia, b)), '.') : '',
}));
fs.writeFileSync(path.join(P.site, '404.html'), pagina({
  titulo: 'Não achei | Cestinha', descricao: 'Página não encontrada.',
  corpo: '<section class="rodada"><article class="hero"><p class="sobretitulo">Erro 404</p><h1>Airball!</h1><p class="subtitulo">Essa página não existe. Volte para a página inicial pelo logo lá em cima.</p></article></section>',
}));

console.log(`Site gerado em _site/: ${dias.length} rodada(s), ${nJogos} página(s) de jogo, ${textosJogo.size} resenha(s), ${textosRodada.size} resumo(s) de rodada.`);
