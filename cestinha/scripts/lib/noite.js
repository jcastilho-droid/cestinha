// "Se você só puder assistir a um jogo hoje...": escolhe os candidatos a jogo da noite.
// Sem IA: dá pontos para cada jogo do dia com critérios fixos e monta os fatos de cada um.
// A tarefa agendada só escolhe entre os 3 primeiros e explica o porquê (prompt, modo jogo_da_noite).
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, lerJson, horaBrasilia } from './util.js';

// Selos que podem aparecer no site (o texto só pode usar os que o jogo realmente tem)
export const MOTIVOS = ['Rivalidade', 'Boa fase', 'Briga na tabela', 'Duelo de estrelas', 'Brasileiro em quadra'];

// Clássicos da NBA (lista fixa; edite à vontade, sempre com siglas da ESPN)
const RIVALIDADES = [
  ['BOS', 'LAL'], ['BOS', 'PHI'], ['BOS', 'NY'], ['BOS', 'MIA'], ['NY', 'BKN'], ['NY', 'MIA'], ['NY', 'IND'],
  ['LAL', 'LAC'], ['LAL', 'GS'], ['CHI', 'DET'], ['DAL', 'SA'], ['HOU', 'SA'], ['GS', 'CLE'],
];
const ehRivalidade = (a, b) => RIVALIDADES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export const diaBR = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
export const hojeBR = () => diaBR(new Date().toISOString());

function sequenciaTexto(s) {
  const m = /^([WL])(\d+)$/.exec(s || '');
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === 'W' ? `${n} ${n === 1 ? 'vitória' : 'vitórias seguidas'}` : `${n} ${n === 1 ? 'derrota' : 'derrotas seguidas'}`;
}
const pct = (c) => (c ? c.v / Math.max(1, c.v + c.d) : 0);
const vitoriasUlt10 = (c) => Number(String(c?.ultimos10 || '0-0').split('-')[0]) || 0;

function fichaDoTime(sigla, brasileiros) {
  const t = lerJson(path.join(RAIZ, 'data', 'times', `${sigla}.json`));
  if (!t) return null;
  const c = t.classificacao || {};
  const ativos = (t.elenco || []).filter((p) => p.medias && p.medias.jogos >= 3);
  const fora = (t.elenco || []).filter((p) => p.lesao?.status === 'Out');
  const estrela = ativos.filter((p) => p.lesao?.status !== 'Out').sort((a, b) => Number(b.medias.pts) - Number(a.medias.pts))[0];
  const desfalques = fora.filter((p) => p.medias && Number(p.medias.pts) >= 12).map((p) => ({ nome: p.nome, media_pts: p.medias.pts, status: 'fora (lesão)' }));
  const brs = (t.elenco || []).filter((p) => brasileiros.has(p.nome) && p.lesao?.status !== 'Out').map((p) => p.nome);
  return {
    _c: c,
    time: t.nome_curto,
    sigla: t.sigla,
    conferencia: t.conferencia,
    campanha: `${c.v ?? 0}-${c.d ?? 0}`,
    posicao_na_conferencia: c.posicao ?? null,
    sequencia: sequenciaTexto(c.sequencia),
    ultimos_10_jogos: c.ultimos10 || null,
    saldo_de_pontos_por_jogo: c.saldo || null,
    estrela: estrela ? { nome: estrela.nome, medias: `${estrela.medias.pts} pts, ${estrela.medias.reb} reb, ${estrela.medias.ast} ast por jogo` , _pts: Number(estrela.medias.pts) } : null,
    desfalques,
    brasileiros: brs,
  };
}

// Todos os jogos do dia (no horário de Brasília) que ainda não terminaram, com pontos e fatos.
export function candidatosDaNoite(dataBR = hojeBR()) {
  const agenda = lerJson(path.join(RAIZ, 'data', 'agenda.json'));
  const brasileiros = new Set(lerJson(path.join(RAIZ, 'config', 'brasileiros.json'))?.jogadores || []);
  const jogos = (agenda?.jogos || []).filter((j) => diaBR(j.inicio_utc) === dataBR && j.status !== 'final' && j.status !== 'adiado');
  const lista = [];
  for (const j of jogos) {
    const v = fichaDoTime(j.visitante.sigla, brasileiros);
    const c = fichaDoTime(j.casa.sigla, brasileiros);
    if (!v || !c) continue;
    const motivos = [];
    let pontos = (pct(v._c) + pct(c._c)) * 2;
    const mesmaConf = v.conferencia === c.conferencia;
    const tabela = mesmaConf && v.posicao_na_conferencia <= 10 && c.posicao_na_conferencia <= 10 && Math.abs(v.posicao_na_conferencia - c.posicao_na_conferencia) <= 3;
    if (tabela) { motivos.push('Briga na tabela'); pontos += 3; }
    const embalados = [v, c].filter((x) => /^W([3-9]|\d\d)$/.test(x._c.sequencia || '') || vitoriasUlt10(x._c) >= 7);
    if (embalados.length) { motivos.push('Boa fase'); pontos += embalados.length * 1.5; }
    if (v.estrela?._pts >= 24 && c.estrela?._pts >= 24) { motivos.push('Duelo de estrelas'); pontos += 2; }
    else if (Math.max(v.estrela?._pts || 0, c.estrela?._pts || 0) >= 27) pontos += 1;
    if (v.brasileiros.length || c.brasileiros.length) { motivos.push('Brasileiro em quadra'); pontos += 2; }
    const rival = ehRivalidade(v.sigla, c.sigla);
    if (rival) { motivos.push('Rivalidade'); pontos += 2; }
    if (pct(v._c) > 0.5 && pct(c._c) > 0.5) pontos += 2;
    const limpar = (x) => { const { _c, ...resto } = x; if (resto.estrela) { const { _pts, ...e } = resto.estrela; resto.estrela = e; } return resto; };
    lista.push({
      id_jogo: j.id,
      partida: `${v.time} x ${c.time}`,
      horario_brasilia: horaBrasilia(j.inicio_utc).replace(':', 'h'),
      inicio_utc: j.inicio_utc,
      visitante: limpar(v),
      mandante: limpar(c),
      mesma_conferencia: mesmaConf,
      rivalidade_classica: rival,
      tv_eua: j.tv_eua || [],
      motivos_possiveis: motivos,
      pontuacao: Math.round(pontos * 10) / 10,
    });
  }
  return lista.sort((a, b) => b.pontuacao - a.pontuacao || a.inicio_utc.localeCompare(b.inicio_utc));
}

export function entradaNoite(dataBR = hojeBR()) {
  const todos = candidatosDaNoite(dataBR);
  return {
    tipo: 'jogo_da_noite',
    dados: {
      data: dataBR,
      total_de_jogos: todos.length,
      candidatos: todos.slice(0, 3),
      outros_jogos: todos.slice(3).map((x) => `${x.partida} (${x.horario_brasilia})`),
      fonte: 'ESPN (agenda, classificação e médias da temporada)',
    },
    contexto: { selos_permitidos: MOTIVOS, observacao: 'Escolha UM dos candidatos. Médias são da temporada; campanhas e posições são de antes do jogo.' },
  };
}

export const PASTA_NOITE = path.join(RAIZ, 'content', 'jogo-da-noite');
export function jogoDaNoitePublicado(dataBR) {
  const arq = path.join(PASTA_NOITE, `${dataBR}.json`);
  return fs.existsSync(arq) ? lerJson(arq) : null;
}
