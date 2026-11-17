// Confere os textos que o Cestinha escreveu em content/rascunhos/ e decide o destino:
//   sem alertas -> content/jogos/<id>.json ou content/rodadas/<data>.json (vai pro site)
//   com alertas -> content/revisao/ (NÃO vai pro site; o dono olha antes)
// Também faz checagens automáticas: placares, números e nomes citados precisam existir nos dados.
// Por fim marca tudo em data/processed.json para nunca escrever duas vezes.
// Uso: node scripts/finalizar.js
import fs from 'node:fs';
import path from 'node:path';
import { P, lerJson, gravarJson, listarArquivos, agoraIso } from './lib/util.js';
import { acharJogo, lerRodada, lerJogo } from './lib/dados.js';
import { entradaNoite, MOTIVOS, PASTA_NOITE } from './lib/noite.js';

const TIPOS = { jogo: 'resumo_jogo', rodada: 'resumo_rodada', power: 'power_ranking', noite: 'jogo_da_noite' };
const STATUS = ['CONFIRMADO', 'REPORTADO', 'RUMOR', 'N/A'];
const LIMITE_PALAVRAS = { jogo: [50, 200], rodada: [80, 380], power: [10, 160], noite: [40, 150] };

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const palavras = (s) => String(s).split(/\s+/).filter(Boolean).length;

function conferirEstrutura(t, modo) {
  const a = [];
  for (const c of ['titulo', 'corpo']) if (typeof t[c] !== 'string' || !t[c].trim()) a.push(`Campo "${c}" vazio ou ausente.`);
  if (typeof t.subtitulo !== 'string') a.push('Campo "subtitulo" ausente.');
  if (t.tipo !== TIPOS[modo]) a.push(`Tipo "${t.tipo}" diferente do esperado (${TIPOS[modo]}).`);
  if (!STATUS.includes(t.status)) a.push(`Status "${t.status}" inválido.`);
  if (!Number.isInteger(t.importancia) || t.importancia < 1 || t.importancia > 5) a.push('Importância precisa ser um número de 1 a 5.');
  for (const c of ['times', 'jogadores', 'fontes', 'alertas']) if (!Array.isArray(t[c])) a.push(`Campo "${c}" precisa ser uma lista.`);
  const [min, max] = LIMITE_PALAVRAS[modo];
  const n = palavras(t.corpo || '');
  if (n < min || n > max) a.push(`Texto com ${n} palavras (esperado entre ${min} e ${max}).`);
  return a;
}

// Checagem anti-invenção: números e nomes do texto precisam existir nos dados.
function conferirDados(t, jogos) {
  const a = [];
  const texto = `${t.titulo}\n${t.subtitulo}\n${t.corpo}`;

  const placares = new Set();
  for (const j of jogos) {
    placares.add(`${j.casa.placar}-${j.visitante.placar}`);
    placares.add(`${j.visitante.placar}-${j.casa.placar}`);
  }
  for (const m of texto.matchAll(/\b(\d{2,3})\s*(?:a|x|×|–|-)\s*(\d{2,3})\b/g)) {
    const [x, y] = [Number(m[1]), Number(m[2])];
    if (x < 60 || y < 60) continue; // não é placar de jogo (ex.: campanha 11-13)
    if (!placares.has(`${x}-${y}`)) a.push(`Placar "${m[0]}" não bate com os dados.`);
  }

  const jogadores = jogos.flatMap((j) => [...j.casa.jogadores, ...j.visitante.jogadores]);
  const valores = { pts: new Set(), reb: new Set(), ast: new Set() };
  for (const p of jogadores) for (const k of Object.keys(valores)) valores[k].add(p[k]);
  // Só confere o formato padrão do prompt ("32 pts, 11 reb, 8 ast"); "venceu por 30 pontos" não entra.
  for (const m of texto.matchAll(/\b(\d{1,2})\s*(pts|reb|ast)\b/gi)) {
    const k = m[2].toLowerCase();
    if (!valores[k].has(Number(m[1]))) a.push(`Número "${m[0]}" não aparece no box score de nenhum jogador.`);
  }

  const foraDeQuadra = jogos.flatMap((j) => [...(j.casa.nao_jogaram || []), ...(j.visitante.nao_jogaram || [])]);
  const nomes = new Set([...jogadores, ...foraDeQuadra].map((p) => semAcento(p.nome)));
  for (const n of Array.isArray(t.notas) ? t.notas : []) {
    if (!nomes.has(semAcento(n.jogador))) a.push(`Nota para "${n.jogador}", que não aparece no box score.`);
    const v = Number(n.nota);
    if (!(v >= 0 && v <= 10)) a.push(`Nota inválida para "${n.jogador}" (precisa ser de 0 a 10).`);
  }
  for (const nome of t.jogadores || []) {
    if (!nomes.has(semAcento(nome))) a.push(`Jogador "${nome}" não aparece no box score.`);
  }
  return a;
}

const feito = lerJson(P.processados, { jogos: {}, rodadas: {} });
const relatorio = { publicados: [], revisao: [], erros: [] };

const SIGLAS = new Set((lerJson(path.join(P.raw, '..', 'times', 'index.json'))?.times || []).map((t) => t.sigla));
function conferirPower(t) {
  const a = [];
  const r = Array.isArray(t.ranking) ? t.ranking : [];
  if (r.length < 10) a.push('Ranking com menos de 10 times.');
  const vistos = new Set();
  for (const item of r) {
    if (SIGLAS.size && !SIGLAS.has(item.time)) a.push(`Time "${item.time}" não existe (use a sigla da entrada).`);
    if (vistos.has(item.time)) a.push(`Time "${item.time}" repetido no ranking.`);
    vistos.add(item.time);
  }
  return a;
}

// Jogo da noite: o escolhido precisa ser um dos candidatos, com selos e números que existem na entrada.
function conferirNoite(t, data) {
  const a = [];
  const entrada = entradaNoite(data);
  const cand = entrada.dados.candidatos.find((c) => String(c.id_jogo) === String(t.id_jogo));
  if (!cand) return [`"id_jogo" ${t.id_jogo} não está entre os candidatos do dia ${data}.`];
  const motivos = Array.isArray(t.motivos) ? t.motivos : [];
  if (!motivos.length || motivos.length > 3) a.push('Campo "motivos" precisa ter de 1 a 3 selos.');
  for (const mo of motivos) {
    if (!MOTIVOS.includes(mo)) a.push(`Selo "${mo}" não existe (use: ${MOTIVOS.join(', ')}).`);
    else if (!cand.motivos_possiveis.includes(mo)) a.push(`Selo "${mo}" não vale para este jogo (possíveis: ${cand.motivos_possiveis.join(', ') || 'nenhum'}).`);
  }
  if (typeof t.ficar_de_olho !== 'string' || !t.ficar_de_olho.trim()) a.push('Campo "ficar_de_olho" vazio.');
  const fatos = JSON.stringify(cand);
  const texto = `${t.titulo}\n${t.subtitulo}\n${t.corpo}\n${t.ficar_de_olho || ''}`;
  for (const m of texto.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const n = m[0].replace(',', '.');
    if (!fatos.includes(n)) a.push(`Número "${m[0]}" não aparece nos dados do jogo.`);
  }
  const nomes = new Set([cand.visitante, cand.mandante].flatMap((x) => [x.estrela?.nome, ...x.desfalques.map((d) => d.nome), ...x.brasileiros]).filter(Boolean).map(semAcento));
  for (const nome of t.jogadores || []) if (!nomes.has(semAcento(nome))) a.push(`Jogador "${nome}" não aparece nos dados do jogo.`);
  return a;
}

for (const arq of listarArquivos(P.rascunhos)) {
  const m = arq.match(/^(jogo|rodada|power|noite)-(.+)\.json$/);
  const caminho = path.join(P.rascunhos, arq);
  if (!m) {
    relatorio.erros.push(`${arq}: nome fora do padrão (use jogo-<id>.json, rodada-<AAAA-MM-DD>.json ou power-<AAAA-MM-DD>.json ou noite-<AAAA-MM-DD>.json)`);
    continue;
  }
  const [, modo, ref] = m;
  let texto;
  try {
    texto = lerJson(caminho);
  } catch (e) {
    relatorio.erros.push(`${arq}: ${e.message}`);
    continue;
  }

  if (modo === 'noite') {
    const alertasN = [...(Array.isArray(texto.alertas) ? texto.alertas : []), ...[...conferirEstrutura(texto, modo), ...conferirNoite(texto, ref)].map((x) => `[checagem automática] ${x}`)];
    const finalN = { ...texto, alertas: alertasN, ref: { tipo: 'noite', data: ref }, escrito_em: agoraIso() };
    const destinoN = alertasN.length ? path.join(P.revisao, `noite-${ref}.json`) : path.join(PASTA_NOITE, `${ref}.json`);
    gravarJson(destinoN, finalN);
    fs.unlinkSync(caminho);
    (alertasN.length ? relatorio.revisao : relatorio.publicados).push(alertasN.length ? { arquivo: path.relative(P.content, destinoN), alertas: alertasN } : path.relative(P.content, destinoN));
    feito.jogo_da_noite = feito.jogo_da_noite || {};
    feito.jogo_da_noite[ref] = { em: finalN.escrito_em, destino: alertasN.length ? 'revisao' : 'publicado', id_jogo: texto.id_jogo };
    continue;
  }
  if (modo === 'power') {
    const alertasP = [...(Array.isArray(texto.alertas) ? texto.alertas : []), ...[...conferirEstrutura(texto, modo), ...conferirPower(texto)].map((x) => `[checagem automática] ${x}`)];
    const finalP = { ...texto, alertas: alertasP, ref: { tipo: 'power', data: ref }, escrito_em: agoraIso() };
    const destinoP = alertasP.length ? path.join(P.revisao, `power-${ref}.json`) : path.join(P.content, 'power-ranking', `${ref}.json`);
    gravarJson(destinoP, finalP);
    fs.unlinkSync(caminho);
    (alertasP.length ? relatorio.revisao : relatorio.publicados).push(alertasP.length ? { arquivo: path.relative(P.content, destinoP), alertas: alertasP } : path.relative(P.content, destinoP));
    feito.power = feito.power || {};
    feito.power[ref] = { em: finalP.escrito_em, destino: alertasP.length ? 'revisao' : 'publicado' };
    continue;
  }
  let jogos = [];
  let dataRodada = ref;
  if (modo === 'jogo') {
    const j = acharJogo(ref);
    if (j) { jogos = [j]; dataRodada = j.data_rodada; }
  } else {
    const r = lerRodada(ref);
    if (r) jogos = r.jogos.map((b) => lerJogo(ref, b.id)).filter(Boolean);
  }

  const alertasAuto = jogos.length
    ? [...conferirEstrutura(texto, modo), ...conferirDados(texto, jogos)]
    : [`Dados de ${modo} ${ref} não encontrados em data/raw/.`];
  const alertas = [...(Array.isArray(texto.alertas) ? texto.alertas : []), ...alertasAuto.map((x) => `[checagem automática] ${x}`)];

  const final = {
    ...texto,
    alertas,
    ref: modo === 'jogo' ? { tipo: 'jogo', id_jogo: ref, data_rodada: dataRodada } : { tipo: 'rodada', data_rodada: ref },
    escrito_em: agoraIso(),
  };

  let destino;
  if (alertas.length) {
    destino = path.join(P.revisao, `${modo}-${ref}.json`);
    relatorio.revisao.push({ arquivo: path.relative(P.content, destino), alertas });
  } else {
    destino = path.join(modo === 'jogo' ? P.jogos : P.rodadas, `${ref}.json`);
    relatorio.publicados.push(path.relative(P.content, destino));
  }
  gravarJson(destino, final);
  fs.unlinkSync(caminho);
  (modo === 'jogo' ? feito.jogos : feito.rodadas)[ref] = { em: final.escrito_em, destino: alertas.length ? 'revisao' : 'publicado' };
}

gravarJson(P.processados, feito);
console.log(JSON.stringify(relatorio, null, 2));
if (relatorio.erros.length) process.exitCode = 1;
