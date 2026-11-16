// Gera o site estático em _site/ a partir de content/ (textos) e data/raw/ (números).
// Uso: node scripts/build.js
// Regras: números SEMPRE vêm de data/raw; content/revisao/ NUNCA é publicado.
import fs from 'node:fs';
import path from 'node:path';
import { P, RAIZ, lerJson, listarDiasRaw, horaBrasilia, dataPorExtenso, dataCurta, dataHoraBrasilia, agoraIso } from './lib/util.js';
import { lerRodada, lerJogo } from './lib/dados.js';

const SITE = {
  nome: 'Cestinha',
  slogan: 'A NBA pra quem dormiu',
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

// Markdown simples: parágrafos, ## títulos, listas com "-" ou "1.", **negrito**, *itálico*, links.
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

function pagina({ titulo, descricao, corpo, raiz = '.', canonical = '' }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<meta name="theme-color" content="#0b0f14">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:locale" content="pt_BR">
${canonical && SITE.url ? `<link rel="canonical" href="${esc(SITE.url + canonical)}">` : ''}
<link rel="icon" href="${raiz}/assets/icone.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${raiz}/assets/estilo.css">
</head>
<body>
<header class="topo">
  <a class="marca" href="${raiz}/index.html"><img src="${raiz}/assets/icone.svg" alt="" width="32" height="32"><span>Cestinha</span></a>
  <span class="slogan">${esc(SITE.slogan)}</span>
</header>
<main>
${corpo}
</main>
<footer class="rodape">
  <p>Placar e estatísticas: ESPN. Textos: o Cestinha (IA), com checagem automática dos números.</p>
  <p>Horários de Brasília. Atualizado em ${esc(dataHoraBrasilia(agoraIso()))}.</p>
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

function situacao(j) {
  if (j.status === 'final') return j.periodo > 4 ? (j.periodo === 5 ? 'Final (prorrogação)' : `Final (${j.periodo - 4} prorrogações)`) : 'Final';
  if (j.status === 'em_andamento') return 'Em andamento';
  if (j.status === 'adiado') return 'Adiado';
  return `${horaBrasilia(j.inicio_utc)}`;
}

function linhaTime(t, final) {
  const venceu = final && t.vencedor;
  return `<div class="linha-time${venceu ? ' venceu' : ''}">
    ${t.logo ? `<img src="${esc(t.logo)}" alt="" width="28" height="28" loading="lazy">` : `<span class="sigla">${esc(t.sigla)}</span>`}
    <span class="nome">${esc(t.nome_curto)}</span>
    ${t.campanha ? `<span class="campanha">${esc(t.campanha)}</span>` : ''}
    <span class="pontos">${t.placar ?? ''}</span>
  </div>`;
}

function cardJogo(base, raiz) {
  const completo = base.status === 'final' ? lerJogo(base.data_rodada, base.id) : null;
  const j = completo || base;
  const final = j.status === 'final';
  if (final && j.casa.vencedor == null) {
    j.casa.vencedor = j.casa.placar > j.visitante.placar;
    j.visitante.vencedor = !j.casa.vencedor;
  }
  const texto = textosJogo.get(base.id);
  const temPagina = !!completo;
  const tag = temPagina ? 'a' : 'div';
  const href = temPagina ? ` href="${raiz}/jogo/${base.id}.html"` : '';
  return `<${tag} class="card-jogo${texto?.importancia >= 4 ? ' destaque' : ''}"${href}>
    <div class="card-topo"><span class="situacao">${esc(situacao(j))}</span>${texto && texto.importancia >= 4 ? '<span class="tag-destaque">DESTAQUE</span>' : ''}</div>
    ${linhaTime(j.visitante, final)}
    ${linhaTime(j.casa, final)}
    ${texto ? `<p class="card-titulo">${esc(texto.titulo)}</p>` : final ? '<p class="card-titulo espera">Resenha chegando…</p>' : ''}
  </${tag}>`;
}

function blocoRodada(dia, rodada, raiz) {
  const resumo = textosRodada.get(dia);
  const jogos = rodada.jogos.map((j) => ({ ...j, data_rodada: dia }));
  jogos.sort((a, b) => (textosJogo.get(b.id)?.importancia || 0) - (textosJogo.get(a.id)?.importancia || 0) || a.inicio_utc.localeCompare(b.inicio_utc));
  const finalizados = rodada.jogos.filter((j) => j.status === 'final').length;
  return `
<section class="rodada">
  <p class="sobretitulo">Rodada de ${esc(dataPorExtenso(dia))}</p>
  ${resumo ? `<article class="resumo-rodada">
    <div class="selos">${selo(resumo.status)}</div>
    <h1>${esc(resumo.titulo)}</h1>
    ${resumo.subtitulo ? `<p class="subtitulo">${esc(resumo.subtitulo)}</p>` : ''}
    <div class="texto">${markdown(resumo.corpo)}</div>
  </article>` : `<article class="resumo-rodada vazio">
    <h1>${finalizados === rodada.jogos.length ? 'O resumo da rodada sai daqui a pouco' : 'Rodada em andamento'}</h1>
    <p class="subtitulo">${finalizados} de ${rodada.jogos.length} jogos finalizados.</p>
  </article>`}
  <h2 class="titulo-secao">Jogos</h2>
  <div class="grade-jogos">
    ${jogos.map((j) => cardJogo(j, raiz)).join('\n')}
  </div>
</section>`;
}

function listaAnteriores(atual, raiz) {
  const outros = dias.filter((d) => d.dia !== atual).reverse().slice(0, 30);
  if (!outros.length) return '';
  return `<section class="anteriores">
  <h2 class="titulo-secao">Rodadas anteriores</h2>
  <ul>${outros.map((d) => `<li><a href="${raiz}/rodada/${d.dia}.html"><span>${esc(dataPorExtenso(d.dia))}</span><span class="qtd">${d.rodada.jogos.length} jogos</span></a></li>`).join('')}</ul>
</section>`;
}

function tabelaBox(t) {
  const linhas = (t.jogadores || []).map((p) => `<tr class="${p.titular ? 'titular' : ''}">
    <th scope="row">${esc(p.nome)}</th><td>${p.min ?? ''}</td><td class="forte">${p.pts ?? ''}</td><td>${p.reb ?? ''}</td><td>${p.ast ?? ''}</td>
    <td>${esc(p.fg)}</td><td>${esc(p.tres)}</td><td>${esc(p.ll)}</td><td>${p.rb ?? ''}</td><td>${p.toco ?? ''}</td><td>${p.err ?? ''}</td><td>${p.mais_menos > 0 ? '+' : ''}${p.mais_menos ?? ''}</td></tr>`).join('');
  const e = t.estatisticas || {};
  const ausentes = (t.nao_jogaram || []).map((x) => x.nome).join(', ');
  return `<section class="box">
  <h3>${esc(t.nome)}</h3>
  <div class="rolagem"><table>
    <thead><tr><th scope="col">Jogador</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>AR</th><th>3P</th><th>LL</th><th>RB</th><th>TOC</th><th>ERR</th><th>+/-</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><th scope="row">Time</th><td></td><td class="forte">${t.placar}</td><td>${esc(e.reb)}</td><td>${esc(e.ast)}</td><td>${esc(e.fg)}</td><td>${esc(e.tres)}</td><td>${esc(e.ll)}</td><td></td><td></td><td>${esc(e.err)}</td><td></td></tr></tfoot>
  </table></div>
  ${ausentes ? `<p class="nota">Não jogaram: ${esc(ausentes)}</p>` : ''}
</section>`;
}

function paginaJogo(j) {
  const texto = textosJogo.get(j.id);
  const raiz = '..';
  const nPer = Math.max(j.casa.parciais?.length || 0, j.visitante.parciais?.length || 0);
  const cab = Array.from({ length: nPer }, (_, i) => (i < 4 ? `${i + 1}º` : `P${i - 3}`));
  const parciais = nPer ? `<div class="rolagem"><table class="parciais">
    <thead><tr><th></th>${cab.map((c) => `<th>${c}</th>`).join('')}<th>T</th></tr></thead>
    <tbody>${[j.visitante, j.casa].map((t) => `<tr><th scope="row">${esc(t.sigla)}</th>${(t.parciais || []).map((p) => `<td>${p}</td>`).join('')}<td class="forte">${t.placar}</td></tr>`).join('')}</tbody>
  </table></div>` : '';
  const fontes = [`<a href="${esc(j.link_fonte)}" rel="noopener" target="_blank">ESPN: placar e box score</a>`];
  if (j.materia_fonte?.link) fontes.push(`<a href="${esc(j.materia_fonte.link)}" rel="noopener" target="_blank">ESPN: matéria do jogo (em inglês)</a>`);
  const titulo = texto?.titulo || `${j.visitante.nome_curto} ${j.visitante.placar} x ${j.casa.placar} ${j.casa.nome_curto}`;
  const corpo = `
<nav class="voltar"><a href="${raiz}/rodada/${j.data_rodada}.html">← Rodada de ${esc(dataCurta(j.data_rodada))}</a></nav>
<section class="placar-grande">
  <div class="time-grande${j.visitante.vencedor ? ' venceu' : ''}">${j.visitante.logo ? `<img src="${esc(j.visitante.logo)}" alt="" width="56" height="56">` : ''}<span>${esc(j.visitante.nome_curto)}</span><small>${esc(j.visitante.campanha || '')}</small></div>
  <div class="numeros"><span class="${j.visitante.vencedor ? 'venceu' : ''}">${j.visitante.placar}</span><span class="x">x</span><span class="${j.casa.vencedor ? 'venceu' : ''}">${j.casa.placar}</span><small>${esc(situacao(j))}</small></div>
  <div class="time-grande${j.casa.vencedor ? ' venceu' : ''}">${j.casa.logo ? `<img src="${esc(j.casa.logo)}" alt="" width="56" height="56">` : ''}<span>${esc(j.casa.nome_curto)}</span><small>${esc(j.casa.campanha || '')}</small></div>
</section>
<p class="info-jogo">${esc(dataPorExtenso(j.data_rodada))}, ${esc(horaBrasilia(j.inicio_utc))} (Brasília)${j.local ? ` · ${esc(j.local)}` : ''}</p>
${parciais}
${texto ? `<article class="resenha">
  <div class="selos">${selo(texto.status)}</div>
  <h1>${esc(texto.titulo)}</h1>
  ${texto.subtitulo ? `<p class="subtitulo">${esc(texto.subtitulo)}</p>` : ''}
  <div class="texto">${markdown(texto.corpo)}</div>
</article>` : `<article class="resenha vazio"><h1>${esc(titulo)}</h1><p class="subtitulo">A resenha do Cestinha chega em breve. Enquanto isso, os números:</p></article>`}
<h2 class="titulo-secao">Box score</h2>
${tabelaBox(j.visitante)}
${tabelaBox(j.casa)}
<p class="legenda">AR: arremessos de quadra · 3P: bolas de três · LL: lances livres · RB: roubos de bola · TOC: tocos · ERR: erros. Titulares em destaque.</p>
<section class="fontes"><h2 class="titulo-secao">Fontes</h2><ul>${fontes.map((f) => `<li>${f}</li>`).join('')}</ul></section>`;
  return pagina({ titulo: `${titulo} | Cestinha`, descricao: texto?.subtitulo || `${j.visitante.nome} x ${j.casa.nome}: placar e box score.`, corpo, raiz, canonical: `/jogo/${j.id}.html` });
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
  fs.writeFileSync(path.join(P.site, 'rodada', `${dia}.html`), pagina({
    titulo: `Rodada de ${dataCurta(dia)} | Cestinha`,
    descricao: textosRodada.get(dia)?.subtitulo || `Todos os jogos da NBA de ${dataPorExtenso(dia)}.`,
    corpo: blocoRodada(dia, rodada, '..') + listaAnteriores(dia, '..'),
    raiz: '..',
    canonical: `/rodada/${dia}.html`,
  }));
  for (const base of rodada.jogos) {
    const j = lerJogo(dia, base.id);
    if (!j) continue;
    fs.writeFileSync(path.join(P.site, 'jogo', `${j.id}.html`), paginaJogo(j));
    nJogos++;
  }
}

// Home: a rodada mais recente que já tem jogo finalizado (senão, a mais recente)
const comFinal = dias.filter((d) => d.rodada.jogos.some((j) => j.status === 'final'));
const atual = (comFinal.length ? comFinal : dias).at(-1);
const corpoHome = atual
  ? blocoRodada(atual.dia, atual.rodada, '.') + listaAnteriores(atual.dia, '.')
  : '<section class="rodada"><article class="resumo-rodada vazio"><h1>Fala, fala! Aqui é o Cestinha.</h1><p class="subtitulo">Assim que rolar jogo, os resumos aparecem aqui.</p></article></section>';
fs.writeFileSync(path.join(P.site, 'index.html'), pagina({
  titulo: 'Cestinha | A NBA pra quem dormiu',
  descricao: 'Resumo dos jogos da NBA da noite, em português, no tom de resenha.',
  corpo: corpoHome,
  canonical: '/',
}));
fs.writeFileSync(path.join(P.site, '404.html'), pagina({
  titulo: 'Não achei | Cestinha', descricao: 'Página não encontrada.',
  corpo: '<section class="rodada"><article class="resumo-rodada vazio"><h1>Airball!</h1><p class="subtitulo">Essa página não existe. <a href="/">Voltar para a home</a>.</p></article></section>',
}));

console.log(`Site gerado em _site/: ${dias.length} rodada(s), ${nJogos} página(s) de jogo, ${textosJogo.size} resenha(s), ${textosRodada.size} resumo(s) de rodada.`);
